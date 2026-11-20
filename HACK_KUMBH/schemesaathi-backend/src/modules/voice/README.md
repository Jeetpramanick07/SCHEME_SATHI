# Indic Voice & Accessibility Stack (`tts_stt`)
### Multilingual Speech-to-Text (STT), Text-to-Speech (TTS), and Large-Text Accessibility for Hindi and Marathi

This module delivers **₹0 per-minute API billing**, data sovereignty, and specialized low-literacy accessibility for government welfare schemes in Maharashtra (Vidarbha / Nagpur focus). It runs **AI4Bharat** open-weight models locally or in lightweight containers with a typed **TypeScript** client wrapper.

---

## 1. Stack Architecture

```
┌────────────────────────────────────────────────────────┐
│     Citizen Portal / Mobile App / CSC Seva Kendra     │
│  - "मोठ्याने ऐका" (Listen Out Loud) Audio Playback     │
│  - Voice Search / Voice Eligibility Questionnaire     │
│  - High-Contrast Large Text Mode (22px / 30px)        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON / Audio Stream
┌──────────────────────────▼─────────────────────────────┐
│             SchemeSaathi Backend (FastAPI / Node.js)   │
│  - /api/v1/voice/stt (Voice to Devanagari text)        │
│  - /api/v1/voice/tts (Devanagari text to WAV speech)   │
│  - /api/v1/voice/schemes/:id/audio (Pre-cached audio)  │
│  - /api/v1/voice/accessible-card (Large-text cards)    │
└──────────────────────────┬─────────────────────────────┘
                           │ fetch() / FormData
┌──────────────────────────▼─────────────────────────────┐
│    Python Inference Microservice (localhost:8000)      │
│  - STT: ai4bharat/indic-conformer-600m-multilingual    │
│    (600M params, 16kHz mono, CTC/RNN-T decoding)       │
│  - TTS: ai4bharat/indic-parler-tts                     │
│    (Devanagari text + Sunita warm/slow speaker persona)│
│  - PyTorch / ONNX Runtime / torchaudio / soundfile     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Models Used

| Capability | Model | License | Notes |
|---|---|---|---|
| **Speech-to-Text (STT)** | `ai4bharat/indic-conformer-600m-multilingual` | MIT License | 22 Indian languages including Marathi (`mr`) and Hindi (`hi`). 16kHz mono audio input. |
| **Text-to-Speech (TTS)** | `ai4bharat/indic-parler-tts` | Apache 2.0 | Natural-language style prompts: *"Sunita speaks slowly and clearly in a warm, helpful tone, with natural pauses..."* |

---

## 3. Directory Layout

```
tts_stt/
├── service/
│   ├── server.py              # FastAPI inference server (STT + TTS + Health + Fallback)
│   ├── requirements.txt       # Python dependencies (PyTorch, torchaudio, parler-tts, etc.)
│   ├── Dockerfile             # Container image with ffmpeg and libsndfile1
│   ├── docker-compose.yml     # One-command microservice startup
│   ├── setup.sh               # Virtual environment setup script (Linux / macOS)
│   └── setup.bat              # Virtual environment setup script (Windows)
├── client/
│   ├── indicVoiceClient.ts    # Typed TypeScript client wrapper (fetch + FormData)
│   └── index.ts               # Client module exports
├── accessibility/
│   ├── large-text.ts          # Large-font presets, contrast tiers, and bureaucracy simplifier
│   ├── scheme-audio-script.ts # Spoken-word script generation tailored for rural listeners
│   └── precompute-scheme-audio.ts # Batch pre-generator caching .wav files for all schemes
├── audio_cache/               # Precomputed static audio files ({scheme_id}_{lang}.wav)
│   └── audio_manifest.json    # Metadata manifest of precomputed static files
├── index.ts                   # Unified TypeScript module entrypoint
└── README.md                  # This documentation
```

---

## 4. Setup & Running the Python Inference Microservice

### Method A: Direct Setup (Virtual Environment)

1. **System Prerequisites**:
   * **FFmpeg**: Required to normalize audio input to 16 kHz mono WAV.
     ```bash
     # Ubuntu / Debian
     sudo apt-get update && sudo apt-get install -y ffmpeg libsndfile1-dev git
     ```
   * **Hugging Face Authentication**:
     Accept terms on the model pages:
     * [ai4bharat/indic-conformer-600m-multilingual](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual)
     * [ai4bharat/indic-parler-tts](https://huggingface.co/ai4bharat/indic-parler-tts)
     Then log in:
     ```bash
     pip install huggingface_hub
     hf auth login
     ```

2. **Run Setup**:
   ```bash
   cd tts_stt/service
   # Linux / macOS
   bash setup.sh

   # Windows
   setup.bat
   ```

3. **Start the Service**:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```

### Method B: Docker Compose

```bash
cd tts_stt/service
docker compose up -d
```

---

## 5. TypeScript Client Wrapper Usage

```typescript
import { IndicVoiceClient } from "./tts_stt/client/indicVoiceClient.js";
import fs from "node:fs/promises";

const voiceClient = new IndicVoiceClient("http://localhost:8000");

// 1. Citizen Voice Query to Devanagari Text (Marathi)
const audioBuffer = await fs.readFile("./user_query.wav");
const sttResult = await voiceClient.transcribeAudio(audioBuffer, "user_query.wav", "mr");
console.log("Transcribed citizen query:", sttResult.transcript);

// 2. Synthesize Welfare Eligibility Advice into Audio (Marathi)
const audioBytes = await voiceClient.synthesizeSpeech(
  "संजय गांधी निराधार योजनेसाठी दरमहा ₹१,५०० ची मदत मिळते.",
  "mr",
  { slow: true } // Slow speech tuned for senior citizens
);
await fs.writeFile("./response_audio.wav", Buffer.from(audioBytes));
```

---

## 6. Low-Literacy & Large-Text Accessibility

### High-Contrast Large-Font Typography Tiers
* **`STANDARD`**: 16px (1.0rem), normal contrast.
* **`LARGE`**: 22px (1.375rem), line-height 1.7, high contrast `#111111` on `#FFFFFA` with red audio badge.
* **`EXTRA_LARGE`**: 30px (1.875rem), line-height 1.9, maximum contrast `#000000` on `#FFFFFF` with bold Devanagari numerals.

### Plain-Language Bureaucracy Simplification
Converts dense official administrative terminology into conversational words:
* *अधिवास प्रमाणपत्र* ➔ *महाराष्ट्रात १५ वर्षे राहिल्याचा दाखला (डोमिसाईल)*
* *थेट लाभ हस्तांतरण (DBT)* ➔ *बँकेत थेट पैसे जमा होणे*
* *संस्थात्मक भूधारक* ➔ *कंपनी किंवा संस्थेच्या नावावर असलेले शेत*
* *दारिद्र्यरेषेखालील (BPL)* ➔ *दारिद्र्यरेषेखालील (पिवळे/बीपीएल) रेशन कार्ड असलेले कुटुंब*

### Precomputing Static Scheme Audio
Run the batch pre-generator to create instant-playback `.wav` files for all schemes:
```bash
# Offline simulated mode (for CI/dev without GPU):
npx tsx src/modules/voice/accessibility/precompute-scheme-audio.ts --allow-mock

# Real neural synthesis (requires running voice service on GPU):
npx tsx src/modules/voice/accessibility/precompute-scheme-audio.ts --force
```
Audio files are saved to `tts_stt/audio_cache/{scheme_id}_{lang}.wav` with an `audio_manifest.json` indexing file sizes, checksums, and exact durations measured directly from WAV headers.

---

## 7. Generating Real Audio Cache via Google Colab (Free T4 GPU)

To generate production-quality neural speech using the AI4Bharat models without paying for dedicated GPU hosting, run the synthesis inside a **free Google Colab T4 GPU instance**:

### Step 1: Open Colab and Select T4 GPU
1. Go to [Google Colab](https://colab.research.google.com/) and create a new notebook.
2. In the menu, navigate to **Runtime ➔ Change runtime type**, select **T4 GPU**, and click **Save**.

### Step 2: Install System and Python Dependencies
```python
# Cell 1: Install system packages and clone repo
!apt-get update && apt-get install -y ffmpeg libsndfile1-dev git nodejs npm
!git clone https://github.com/<YOUR_REPO>/schemesaathi.git /content/schemesaathi
%cd /content/schemesaathi/schemesaathi-backend

# Cell 2: Install Python TTS service requirements
!pip install --upgrade pip
!pip install torch torchaudio soundfile scipy transformers accelerate uvicorn fastapi python-multipart
!pip install git+https://github.com/huggingface/parler-tts.git@0a1e0b3c6606fb202da0170a7bb4ff3f8ccf7547
```

### Step 3: Launch the Python Inference Microservice in Background
```python
# Cell 3: Start the service with CUDA enabled and mock disabled
import os, subprocess, time
env = os.environ.copy()
env["MOCK_VOICE"] = "false"
env["DEVICE"] = "cuda"

server_proc = subprocess.Popen(
    ["uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd="/content/schemesaathi/schemesaathi-backend/tts_stt/service",
    env=env
)
time.sleep(15)  # Wait for models to warm up onto T4 GPU
!curl http://127.0.0.1:8000/health
```

### Step 4: Run Node.js Precompute Script Against the T4 Service
```python
# Cell 4: Install npm packages and execute batch synthesis
!npm install -g pnpm tsx
!pnpm install

!INDIC_VOICE_URL="http://127.0.0.1:8000" npx tsx src/modules/voice/accessibility/precompute-scheme-audio.ts --force
```

### Step 5: Download and Commit the Generated Cache
```python
# Cell 5: Package audio_manifest.json and cache
!zip -r /content/scheme_audio_cache.zip tts_stt/audio_cache/
from google.colab import files
files.download('/content/schemesaathi/schemesaathi-backend/tts_stt/audio_manifest.json')
files.download('/content/scheme_audio_cache.zip')
```
Commit the updated `audio_manifest.json` into git. The WAV files inside `audio_cache/` stay gitignored or can be synced to your production CDN / object store.

