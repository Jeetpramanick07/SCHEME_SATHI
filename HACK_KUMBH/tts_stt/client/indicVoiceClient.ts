export type IndicLangCode = "mr" | "hi";

export interface SttResponse {
  transcript: string;
  lang: IndicLangCode;
  confidence?: number;
  engine?: string;
}

export interface TtsOptions {
  slow?: boolean;
  customStyle?: string;
}

export interface VoiceServiceHealth {
  status: string;
  service: string;
  engine: string;
  models: {
    stt: string;
    tts: string;
  };
  device: string;
  models_loaded: boolean;
  mock_mode: boolean;
  supported_languages: string[];
  target_audience: string;
}

export class IndicVoiceClient {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.INDIC_VOICE_URL ?? "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Health check for the Indic Voice microservice.
   */
  async checkHealth(): Promise<VoiceServiceHealth> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Voice service health check failed with status ${res.status}`);
    }
    return (await res.json()) as VoiceServiceHealth;
  }

  /**
   * Transcribe citizen spoken audio (Marathi or Hindi) into Devanagari text.
   * Model: ai4bharat/indic-conformer-600m-multilingual (CTC/RNN-T).
   *
   * @param audioBuffer - Binary audio payload (WAV, WebM, MP3)
   * @param filename - Source audio filename (e.g. query.wav)
   * @param lang - Target language ('mr' for Marathi, 'hi' for Hindi)
   */
  async transcribeAudio(
    audioBuffer: Buffer | Uint8Array,
    filename = "query.wav",
    lang: IndicLangCode = "mr"
  ): Promise<SttResponse> {
    const formData = new FormData();
    const arrayBuffer = Uint8Array.from(audioBuffer).buffer;
    const blob = new Blob([arrayBuffer], { type: "audio/wav" });

    formData.append("file", blob, filename);
    formData.append("lang", lang);

    const res = await fetch(`${this.baseUrl}/stt`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`STT request failed with status ${res.status}: ${errText}`);
    }

    return (await res.json()) as SttResponse;
  }

  /**
   * Synthesize Devanagari plain-language text into clear WAV speech, returning response metadata.
   */
  async synthesizeSpeechWithMeta(
    devanagariText: string,
    lang: IndicLangCode = "mr",
    options: TtsOptions = { slow: true }
  ): Promise<{ buffer: ArrayBuffer; isMock: boolean }> {
    if (!devanagariText || devanagariText.trim().length === 0) {
      throw new Error("Text parameter cannot be empty for speech synthesis");
    }

    const formData = new FormData();
    formData.append("text", devanagariText.trim());
    formData.append("lang", lang);
    if (options.slow !== undefined) {
      formData.append("slow", String(options.slow));
    }
    if (options.customStyle) {
      formData.append("custom_style", options.customStyle);
    }

    const res = await fetch(`${this.baseUrl}/tts`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`TTS request failed with status ${res.status}: ${errText}`);
    }

    const isMock = res.headers.get("x-mock") === "true";
    const buffer = await res.arrayBuffer();
    return { buffer, isMock };
  }

  /**
   * Synthesize Devanagari plain-language text into clear WAV speech.
   * Model: ai4bharat/indic-parler-tts (Sunita speaker persona, warm & slow).
   *
   * @param devanagariText - Plain Devanagari text to read out
   * @param lang - Target language ('mr' for Marathi, 'hi' for Hindi)
   * @param options - Optional speech speed and custom style prompt
   */
  async synthesizeSpeech(
    devanagariText: string,
    lang: IndicLangCode = "mr",
    options: TtsOptions = { slow: true }
  ): Promise<ArrayBuffer> {
    const res = await this.synthesizeSpeechWithMeta(devanagariText, lang, options);
    return res.buffer;
  }
}
