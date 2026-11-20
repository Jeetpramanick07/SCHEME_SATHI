import io
import os
import re
import wave
import struct
import math
import subprocess
import threading
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Indic Voice Service (AI4Bharat STT & TTS)",
    description="Multilingual Speech-to-Text and Text-to-Speech microservice for Hindi and Marathi (SchemeSaathi)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Hardware Detection
MOCK_VOICE = os.getenv("MOCK_VOICE", "false").lower() in ("true", "1", "yes")
DEVICE = "cpu"

stt_model = None
tts_model = None
tts_tokenizer = None
desc_tokenizer = None
models_loaded = False
inference_lock = threading.Lock()

try:
    import torch
    import torchaudio
    import soundfile as sf
    from transformers import AutoModel, AutoTokenizer
    from parler_tts import ParlerTTSForConditionalGeneration

    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

    if not MOCK_VOICE:
        print(f"[IndicVoiceService] Initializing models on {DEVICE}...")
        # 1. Load STT model (IndicConformer 600M Multilingual)
        STT_REPO = "ai4bharat/indic-conformer-600m-multilingual"
        print(f"[IndicVoiceService] Loading STT model: {STT_REPO}")
        stt_model = AutoModel.from_pretrained(STT_REPO, trust_remote_code=True).to(DEVICE)
        stt_model.eval()

        # 2. Load TTS model (Indic Parler-TTS)
        TTS_REPO = "ai4bharat/indic-parler-tts"
        print(f"[IndicVoiceService] Loading TTS model: {TTS_REPO}")
        tts_model = ParlerTTSForConditionalGeneration.from_pretrained(TTS_REPO).to(DEVICE)
        tts_tokenizer = AutoTokenizer.from_pretrained(TTS_REPO)
        desc_tokenizer = AutoTokenizer.from_pretrained(tts_model.config.text_encoder._name_or_path)

        models_loaded = True
        print(f"[IndicVoiceService] Successfully loaded AI4Bharat models on {DEVICE}!")
    else:
        print("[IndicVoiceService] Running in explicit mock mode (MOCK_VOICE=true). Neural weights will not be loaded.")
except Exception as e:
    if MOCK_VOICE:
        print(f"[IndicVoiceService] Notice: Model loading skipped in mock mode ({e}).")
    else:
        print(f"[IndicVoiceService] ERROR: Could not load AI4Bharat models ({e}).")
        print("[IndicVoiceService] MOCK_VOICE is false; service will report 503 / models_loaded=false.")
        models_loaded = False


# Valid per-language speaker personas on Indic Parler-TTS card
SPEAKERS = {
    "mr": "Sunita",
    "hi": "Sunita",
}


def decode_to_16k_mono_wav(raw_bytes: bytes) -> bytes:
    """
    Decodes arbitrary audio input (webm, mp3, m4a, ogg, wav) to 16 kHz 16-bit mono WAV using ffmpeg.
    Falls back to torchaudio if ffmpeg is unavailable.
    """
    try:
        cmd = [
            "ffmpeg", "-y", "-i", "pipe:0",
            "-vn", "-f", "wav", "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le",
            "pipe:1"
        ]
        proc = subprocess.run(cmd, input=raw_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        if proc.returncode == 0 and len(proc.stdout) > 44:
            return proc.stdout
    except Exception:
        pass

    # In-process fallback using soundfile or wave
    try:
        import soundfile as sf
        import numpy as np
        data, sr = sf.read(io.BytesIO(raw_bytes))
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != 16000:
            import torchaudio
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
            tensor_data = torch.from_numpy(data).float().unsqueeze(0)
            resampled = resampler(tensor_data).squeeze(0).numpy()
            data = resampled
        out_buf = io.BytesIO()
        sf.write(out_buf, data, 16000, format="WAV", subtype="PCM_16")
        return out_buf.getvalue()
    except Exception:
        # If it's already a WAV buffer, return as is
        return raw_bytes


def check_wav_duration_seconds(wav_bytes: bytes) -> float:
    """Returns the duration of a WAV file in seconds."""
    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return float(frames) / float(rate) if rate > 0 else 0.0
    except Exception:
        # If wave cannot open, estimate from PCM 16kHz 16-bit mono bytes
        data_len = max(len(wav_bytes) - 44, 0)
        return float(data_len) / 32000.0


def split_sentences_for_tts(text: str, max_chars: int = 200) -> List[str]:
    """
    Splits long Devanagari text into small sentences (<=200 chars) for high-quality TTS.
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    # Split by Devanagari danda, period, exclamation, question mark, newline
    raw_sentences = re.split(r"([।\.\?!;\n]+)", cleaned)
    combined: List[str] = []
    current = ""

    for part in raw_sentences:
        if not part:
            continue
        if re.match(r"^[।\.\?!;\n]+$", part):
            if current:
                current += part
                combined.append(current.strip())
                current = ""
            continue

        if len(current) + len(part) <= max_chars:
            current += part
        else:
            if current:
                combined.append(current.strip())
            # If a single sentence exceeds max_chars, split on commas or spaces
            if len(part) > max_chars:
                comma_parts = re.split(r"(,\s*)", part)
                sub_curr = ""
                for cp in comma_parts:
                    if len(sub_curr) + len(cp) <= max_chars:
                        sub_curr += cp
                    else:
                        if sub_curr:
                            combined.append(sub_curr.strip())
                        sub_curr = cp
                if sub_curr:
                    current = sub_curr
            else:
                current = part

    if current.strip():
        combined.append(current.strip())

    return [s for s in combined if s]


def generate_synthesized_wav_fallback(text: str, sample_rate: int = 16000) -> bytes:
    """Generates acoustic WAV tone for test / mock fallback mode."""
    duration = min(max(len(text) * 0.05, 1.2), 6.0)
    num_samples = int(duration * sample_rate)
    freq = 440.0

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            t = float(i) / sample_rate
            envelope = math.sin(math.pi * (i / num_samples))
            val = int(32767.0 * 0.3 * envelope * math.sin(2.0 * math.pi * freq * t))
            frames.extend(struct.pack("<h", val))

        wav_file.writeframes(frames)

    buf.seek(0)
    return buf.read()


@app.get("/health")
def health_check():
    """Health check: Returns 503 if MOCK_VOICE is false and neural models failed to load."""
    if not MOCK_VOICE and not models_loaded:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "indic-voice-service",
                "engine": "AI4Bharat",
                "device": DEVICE,
                "models_loaded": False,
                "mock_mode": False,
                "detail": "Neural models failed to load and MOCK_VOICE is false",
            }
        )

    return {
        "status": "ok",
        "service": "indic-voice-service",
        "engine": "AI4Bharat",
        "models": {
            "stt": "ai4bharat/indic-conformer-600m-multilingual",
            "tts": "ai4bharat/indic-parler-tts"
        },
        "device": DEVICE,
        "models_loaded": models_loaded,
        "mock_mode": MOCK_VOICE,
        "supported_languages": ["mr", "hi"],
        "target_audience": "Low-literacy and elderly citizens (Nagpur/Vidarbha, Maharashtra)"
    }


@app.get("/voices")
def list_voices():
    return {
        "languages": [
            {"code": "mr", "name": "Marathi (मराठी)", "default_speaker": SPEAKERS["mr"]},
            {"code": "hi", "name": "Hindi (हिंदी)", "default_speaker": SPEAKERS["hi"]}
        ],
        "default_style": (
            "Sunita speaks slowly and clearly in a warm, helpful tone, "
            "with natural pauses and very clear audio quality."
        ),
        "preset_modes": {
            "elderly_friendly": "Speaks slowly and clearly with gentle pauses, optimized for senior citizens and low-literacy listeners.",
            "conversational": "Natural paced conversational tone for mobile app assistance.",
            "announcement": "Authoritative and loud tone for public kiosks and gram panchayat help centres."
        }
    }


@app.post("/stt")
def speech_to_text(
    file: UploadFile = File(...),
    lang: str = Form("mr")
):
    """
    Speech-to-Text: Accepts citizen audio (WAV, MP3, WebM, M4A) and returns Devanagari text.
    Decodes input via ffmpeg to 16kHz mono WAV. Rejects empty audio or >30 seconds.
    """
    if lang not in ("mr", "hi"):
        raise HTTPException(status_code=400, detail=f"Unsupported language code '{lang}'. Use 'mr' (Marathi) or 'hi' (Hindi).")

    raw_bytes = file.file.read()
    if not raw_bytes or len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio payload received.")

    # 1. Decode to 16kHz mono PCM WAV
    wav_bytes = decode_to_16k_mono_wav(raw_bytes)
    if not wav_bytes or len(wav_bytes) == 0:
        raise HTTPException(status_code=400, detail="Unable to decode audio format.")

    # 2. Check maximum permitted duration (30 seconds)
    duration_sec = check_wav_duration_seconds(wav_bytes)
    if duration_sec > 30.0:
        raise HTTPException(status_code=400, detail=f"Audio duration ({duration_sec:.1f}s) exceeds maximum permitted duration of 30 seconds.")

    # 3. Check model availability vs mock mode
    if not models_loaded:
        if not MOCK_VOICE:
            raise HTTPException(status_code=503, detail="Neural STT model is offline and MOCK_VOICE is false.")

        mock_text = (
            "माझे वय ६२ वर्षे आहे आणि मला निराधार पेन्शन योजनेची माहिती हवी आहे."
            if lang == "mr"
            else "मेरी आयु ६२ वर्ष है और मुझे निराधार पेंशन योजना की जानकारी चाहिए।"
        )
        return JSONResponse(
            content={
                "transcript": mock_text,
                "lang": lang,
                "engine": "ai4bharat/indic-conformer-600m-multilingual (mock)",
                "confidence": 0.94
            },
            headers={"X-Mock": "true"}
        )

    # 4. Neural inference with IndicConformer under lock
    try:
        import torch
        import torchaudio

        wav_tensor, sr = torchaudio.load(io.BytesIO(wav_bytes))
        wav_tensor = wav_tensor.to(DEVICE)

        with inference_lock:
            with torch.no_grad():
                result = stt_model(wav_tensor, lang, "ctc")

        if isinstance(result, dict):
            transcript = result.get("transcript", "")
            confidence = result.get("confidence")
        elif isinstance(result, (list, tuple)) and len(result) >= 2:
            transcript = result[0]
            confidence = result[1]
        else:
            transcript = str(result)
            confidence = None

        resp_content = {
            "transcript": transcript,
            "lang": lang,
            "engine": "ai4bharat/indic-conformer-600m-multilingual"
        }
        if confidence is not None:
            resp_content["confidence"] = float(confidence)

        return resp_content
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Speech recognition error: {str(err)}")


@app.post("/tts")
def text_to_speech(
    text: str = Form(...),
    lang: str = Form("mr"),
    slow: Optional[bool] = Form(True),
    custom_style: Optional[str] = Form(None)
):
    """
    Text-to-Speech: Accepts Devanagari text, splits into sentences <=200 chars,
    and synthesizes speech audio (WAV) using Indic Parler-TTS.
    """
    cleaned_text = text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    if lang not in ("mr", "hi"):
        raise HTTPException(status_code=400, detail=f"Unsupported language code '{lang}'. Use 'mr' (Marathi) or 'hi' (Hindi).")

    # 1. Check model availability vs mock mode
    if not models_loaded:
        if not MOCK_VOICE:
            raise HTTPException(status_code=503, detail="Neural TTS model is offline and MOCK_VOICE is false.")

        audio_wav = generate_synthesized_wav_fallback(cleaned_text, sample_rate=16000)
        return Response(content=audio_wav, media_type="audio/wav", headers={"X-Mock": "true"})

    # 2. Production Neural Inference with sentence concatenation under lock
    try:
        import torch
        import numpy as np
        import soundfile as sf

        speaker = SPEAKERS.get(lang, "Sunita")

        if custom_style:
            style_prompt = custom_style
        elif slow:
            style_prompt = (
                f"{speaker} speaks slowly and clearly in a warm, helpful tone, "
                "with natural pauses and very clear audio quality."
            )
        else:
            style_prompt = (
                f"{speaker} speaks clearly in a warm, pleasant voice with natural tone and clear audio quality."
            )

        chunks = split_sentences_for_tts(cleaned_text, max_chars=200)
        audio_segments = []

        with inference_lock:
            desc_inputs = desc_tokenizer(style_prompt, return_tensors="pt").to(DEVICE)
            for chunk in chunks:
                prompt_inputs = tts_tokenizer(chunk, return_tensors="pt").to(DEVICE)
                with torch.no_grad():
                    gen = tts_model.generate(
                        input_ids=desc_inputs.input_ids,
                        attention_mask=desc_inputs.attention_mask,
                        prompt_input_ids=prompt_inputs.input_ids,
                        prompt_attention_mask=prompt_inputs.attention_mask,
                    )
                arr = gen.cpu().numpy().squeeze()
                audio_segments.append(arr)
                # Add 0.2s pause between sentences
                audio_segments.append(np.zeros(int(0.2 * tts_model.config.sampling_rate)))

        if audio_segments:
            final_audio = np.concatenate(audio_segments)
        else:
            final_audio = np.zeros(int(1.0 * tts_model.config.sampling_rate))

        out_buf = io.BytesIO()
        sf.write(out_buf, final_audio, samplerate=tts_model.config.sampling_rate, format="WAV")
        return Response(content=out_buf.getvalue(), media_type="audio/wav")
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Speech synthesis error: {str(err)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[IndicVoiceService] Starting service on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
