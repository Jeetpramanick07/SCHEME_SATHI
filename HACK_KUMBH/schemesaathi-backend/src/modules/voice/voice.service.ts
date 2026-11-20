import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";
import {
  IndicVoiceClient,
  type IndicLangCode,
  type SttResponse,
  type VoiceServiceHealth,
} from "./client/indicVoiceClient.js";

export type { IndicLangCode, SttResponse, VoiceServiceHealth };
export { IndicVoiceClient };

export interface AudioManifestEntry {
  scheme_id: string;
  lang: string;
  filename: string;
  duration_seconds: number;
  script: string;
  size_bytes?: number;
  script_checksum?: string;
}

export class VoiceUnavailableError extends Error {
  code = "VOICE_UNAVAILABLE";
  constructor(message = "Voice service is currently unavailable") {
    super(message);
    this.name = "VoiceUnavailableError";
  }
}

export class VoiceService {
  private static client = new IndicVoiceClient(config.indicVoiceUrl);
  private static manifestCache: AudioManifestEntry[] | null = null;

  static setClient(client: IndicVoiceClient) {
    this.client = client;
  }

  static getAudioCacheDir(): string {
    const candidates = [
      path.resolve(process.cwd(), "tts_stt/audio_cache"),
      path.resolve(process.cwd(), "../tts_stt/audio_cache"),
      path.resolve(process.cwd(), "schemesaathi-backend/tts_stt/audio_cache"),
    ];
    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        return dir;
      }
    }
    return candidates[0]!;
  }

  static getManifest(): AudioManifestEntry[] {
    if (this.manifestCache) {
      return this.manifestCache;
    }
    const cacheDir = this.getAudioCacheDir();
    const manifestCandidates = [
      path.join(cacheDir, "audio_manifest.json"),
      path.resolve(cacheDir, "../audio_manifest.json"),
      path.resolve(process.cwd(), "tts_stt/audio_manifest.json"),
    ];
    for (const mPath of manifestCandidates) {
      if (fs.existsSync(mPath)) {
        try {
          const raw = fs.readFileSync(mPath, "utf-8");
          this.manifestCache = JSON.parse(raw) as AudioManifestEntry[];
          return this.manifestCache;
        } catch {
          // continue
        }
      }
    }
    return [];
  }

  static hasPrecomputedAudio(schemeId: string, lang: string): boolean {
    const manifest = this.getManifest();
    const entry = manifest.find((m) => m.scheme_id === schemeId && m.lang === lang);
    if (!entry) return false;
    const cacheDir = this.getAudioCacheDir();
    const audioPath = path.join(cacheDir, entry.filename);
    return fs.existsSync(audioPath);
  }

  static getPrecomputedAudio(
    schemeId: string,
    lang: string
  ): { buffer: Buffer; filename: string; duration_seconds: number } | null {
    const manifest = this.getManifest();
    const entry = manifest.find((m) => m.scheme_id === schemeId && m.lang === lang);
    if (!entry) return null;

    const cacheDir = this.getAudioCacheDir();
    const audioPath = path.join(cacheDir, entry.filename);
    if (!fs.existsSync(audioPath)) return null;

    const buffer = fs.readFileSync(audioPath);
    return {
      buffer,
      filename: entry.filename,
      duration_seconds: entry.duration_seconds,
    };
  }

  static async getHealth(): Promise<VoiceServiceHealth> {
    try {
      return await this.client.checkHealth();
    } catch {
      if (config.voiceMock) {
        return {
          status: "degraded",
          service: "indic-voice-service (mock)",
          engine: "AI4Bharat (Mock)",
          models: {
            stt: "ai4bharat/indic-conformer-600m-multilingual",
            tts: "ai4bharat/indic-parler-tts",
          },
          device: "cpu",
          models_loaded: false,
          mock_mode: true,
          supported_languages: ["mr", "hi"],
          target_audience: "Low-literacy citizens (Nagpur/Vidarbha, Maharashtra)",
        };
      }
      throw new VoiceUnavailableError();
    }
  }

  static async transcribe(
    audioBuffer: Buffer,
    filename: string,
    lang: IndicLangCode
  ): Promise<{ result: SttResponse; isMock: boolean }> {
    try {
      const res = await this.client.transcribeAudio(audioBuffer, filename, lang);
      return { result: res, isMock: false };
    } catch (err) {
      if (config.voiceMock) {
        const fallbackText =
          lang === "mr"
            ? "माझे वय ६२ वर्षे आहे आणि मला निराधार पेन्शन योजनेची माहिती हवी आहे."
            : "मेरी आयु ६२ वर्ष है और मुझे निराधार पेंशन योजना की जानकारी चाहिए।";
        return {
          result: {
            transcript: fallbackText,
            lang,
            confidence: 0.92,
            engine: "ai4bharat/indic-conformer-600m-multilingual (mock)",
          },
          isMock: true,
        };
      }
      throw new VoiceUnavailableError(
        `Speech recognition service unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  static async synthesize(
    text: string,
    lang: IndicLangCode,
    slow = true
  ): Promise<{ buffer: Buffer; isMock: boolean }> {
    try {
      const arrayBuf = await this.client.synthesizeSpeech(text, lang, { slow });
      return { buffer: Buffer.from(arrayBuf), isMock: false };
    } catch (err) {
      if (config.voiceMock) {
        return { buffer: createAcousticFallbackWav(3), isMock: true };
      }
      throw new VoiceUnavailableError(
        `Speech synthesis service unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Backward-compatible helper for legacy tests / direct service calls
   */
  static async getSchemeAudio(
    schemeId: string,
    lang: IndicLangCode
  ): Promise<{ buffer: Buffer; source: string }> {
    const precomputed = this.getPrecomputedAudio(schemeId, lang);
    if (precomputed) {
      return { buffer: precomputed.buffer, source: "precomputed_cache" };
    }
    const synth = await this.synthesize("शासकीय कल्याणकारी योजना माहिती.", lang, true);
    return { buffer: synth.buffer, source: synth.isMock ? "mock_synthesis" : "live_synthesis" };
  }
}

function createAcousticFallbackWav(durationSeconds: number, sampleRate = 16000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const freq = 440;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.floor(32767 * 0.3 * envelope * Math.sin(2 * Math.PI * freq * t));
    buffer.writeInt16LE(sample, headerSize + i * 2);
  }

  return buffer;
}
