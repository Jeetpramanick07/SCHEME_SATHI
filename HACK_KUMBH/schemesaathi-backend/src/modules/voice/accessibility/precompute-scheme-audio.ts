import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import child_process from "node:child_process";
import { fileURLToPath } from "node:url";
import { IndicVoiceClient, type IndicLangCode } from "../client/indicVoiceClient.js";
import { generateSpokenScript, type SchemeAudioSource } from "./scheme-audio-script.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a valid PCM 16kHz mono WAV header and sinusoidal tone buffer
 * when synthesizing speech offline in mock mode.
 */
export function createFallbackWav(durationSeconds: number, sampleRate = 16000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM audio format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // Byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Soft sinusoidal acoustic confirmation waveform (tone-only)
  const freq = 440;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.floor(32767 * 0.3 * envelope * Math.sin(2 * Math.PI * freq * t));
    buffer.writeInt16LE(sample, headerSize + i * 2);
  }

  return buffer;
}

/**
 * Performs a spectral check on audio PCM samples.
 * Detects tone-only audio (e.g. artificial sine wave) by measuring spectral peak ratio.
 * Pure tones have >65% energy concentrated in 1 discrete frequency bin.
 */
export function detectToneOnlyAudio(buffer: Buffer): { isToneOnly: boolean; peakRatio: number } {
  if (buffer.length < 2048) {
    return { isToneOnly: false, peakRatio: 0 };
  }

  // Find data offset
  let dataOffset = 44;
  for (let i = 12; i < Math.min(buffer.length - 8, 200); i++) {
    if (buffer.toString("ascii", i, i + 4) === "data") {
      dataOffset = i + 8;
      break;
    }
  }

  const sampleCount = 1024;
  const startSample = Math.min(Math.floor((buffer.length - dataOffset) / 4), 2000);
  const offset = dataOffset + startSample * 2;

  if (offset + sampleCount * 2 > buffer.length) {
    return { isToneOnly: false, peakRatio: 0 };
  }

  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readInt16LE(offset + i * 2) / 32768.0;
  }

  // Power spectrum via DFT
  let maxPower = 0;
  let totalPower = 0;

  for (let k = 1; k < sampleCount / 2; k++) {
    let re = 0;
    let im = 0;
    const angleStep = (2 * Math.PI * k) / sampleCount;
    for (let n = 0; n < sampleCount; n++) {
      const angle = angleStep * n;
      re += samples[n]! * Math.cos(angle);
      im -= samples[n]! * Math.sin(angle);
    }
    const power = re * re + im * im;
    totalPower += power;
    if (power > maxPower) {
      maxPower = power;
    }
  }

  const peakRatio = totalPower > 0 ? maxPower / totalPower : 0;
  const isToneOnly = peakRatio > 0.65;
  return { isToneOnly, peakRatio };
}

/**
 * Converts WAV PCM buffer into MP3 using ffmpeg if available.
 */
export function convertWavToMp3(wavBuffer: Buffer): Buffer {
  try {
    const res = child_process.spawnSync("ffmpeg", [
      "-y",
      "-i", "pipe:0",
      "-codec:a", "libmp3lame",
      "-b:a", "64k",
      "-f", "mp3",
      "pipe:1"
    ], {
      input: wavBuffer,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (res.status === 0 && res.stdout && res.stdout.length > 0) {
      return res.stdout;
    }
  } catch {}
  return wavBuffer;
}

/**
 * Measures real audio duration from standard WAV header.
 */
export function measureWavDuration(wavBuffer: Buffer): number {
  if (wavBuffer.length < 44) return 0;
  const byteRate = wavBuffer.readUInt32LE(28);
  const dataSize = wavBuffer.readUInt32LE(40);
  if (byteRate > 0 && dataSize > 0) {
    return Number((dataSize / byteRate).toFixed(2));
  }
  return 0;
}

export function computeScriptChecksum(script: string): string {
  return crypto.createHash("sha256").update(script.trim()).digest("hex");
}

export interface PrecomputeOptions {
  datasetPath?: string;
  outputDir?: string;
  voiceServiceUrl?: string;
  allowMock?: boolean;
  force?: boolean;
}

export interface ManifestEntry {
  scheme_id: string;
  lang: IndicLangCode;
  filename: string;
  duration_seconds: number;
  script: string;
  script_checksum: string;
  size_bytes: number;
  review_status: "needs_native_review" | "reviewed";
}

export async function precomputeAllSchemeAudio(options: PrecomputeOptions = {}): Promise<ManifestEntry[]> {
  const allowMock = options.allowMock ?? false;
  const force = options.force ?? false;
  const voiceServiceUrl = options.voiceServiceUrl || process.env.INDIC_VOICE_URL || "http://localhost:8000";

  const resolvedDataset =
    options.datasetPath ||
    path.resolve(process.cwd(), "data/government_welfare_schemes.json");

  const resolvedOutput =
    options.outputDir || path.resolve(__dirname, "../audio_cache");

  if (!fs.existsSync(resolvedOutput)) {
    fs.mkdirSync(resolvedOutput, { recursive: true });
  }

  console.log(`[PrecomputeAudio] Loading dataset from: ${resolvedDataset}`);
  const raw = fs.readFileSync(resolvedDataset, "utf8");
  const data = JSON.parse(raw);
  const schemes = (data.schemes || []) as Array<Record<string, unknown>>;

  console.log(`[PrecomputeAudio] Processing ${schemes.length} schemes (force=${force}, allowMock=${allowMock})...`);

  // Load existing manifest if present
  const existingManifestMap = new Map<string, ManifestEntry>();
  const manifestPath = path.resolve(__dirname, "../audio_manifest.json");

  if (fs.existsSync(manifestPath)) {
    try {
      const oldEntries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as ManifestEntry[];
      for (const entry of oldEntries) {
        existingManifestMap.set(`${entry.scheme_id}_${entry.lang}`, entry);
      }
    } catch {}
  }

  const client = new IndicVoiceClient(voiceServiceUrl);
  let isServiceOnline = false;
  let serviceIsMock = false;

  try {
    const health = await client.checkHealth();
    if (health.status === "ok") {
      isServiceOnline = true;
      serviceIsMock = Boolean(health.mock_mode);
      console.log(
        `[PrecomputeAudio] Voice Service online at ${voiceServiceUrl} (Device: ${health.device}, Models Loaded: ${health.models_loaded}, Mock: ${health.mock_mode})`
      );
    }
  } catch (err) {
    if (!allowMock) {
      console.error(`[PrecomputeAudio] FATAL: Voice service is offline at ${voiceServiceUrl} and --allow-mock was not specified.`);
      throw new Error(`Voice service offline: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log(`[PrecomputeAudio] Voice service offline at ${voiceServiceUrl}. Running with --allow-mock enabled.`);
  }

  if (serviceIsMock && !allowMock) {
    console.error(`[PrecomputeAudio] FATAL: Voice service returned mock mode and --allow-mock was not specified.`);
    throw new Error("Voice service is running in mock mode. Real audio required for production precomputation.");
  }

  const manifest: ManifestEntry[] = [];
  const languages: IndicLangCode[] = ["mr", "hi"];

  for (const s of schemes) {
    const schemeId = String(s.scheme_id);
    for (const lang of languages) {
      const scriptInfo = generateSpokenScript(s as unknown as SchemeAudioSource, lang);
      const scriptChecksum = computeScriptChecksum(scriptInfo.spoken_script);
      const filename = `${schemeId}_${lang}.mp3`;
      const outPath = path.join(resolvedOutput, filename);

      const existingEntry = existingManifestMap.get(`${schemeId}_${lang}`);
      const fileExists = fs.existsSync(outPath);
      const scriptUnchanged = existingEntry && existingEntry.script_checksum === scriptChecksum;

      if (!force && fileExists && scriptUnchanged) {
        const existingBuffer = fs.readFileSync(outPath);
        manifest.push({
          scheme_id: schemeId,
          lang,
          filename,
          duration_seconds: existingEntry.duration_seconds,
          script: scriptInfo.spoken_script,
          script_checksum: scriptChecksum,
          size_bytes: existingBuffer.length,
          review_status: "needs_native_review",
        });
        console.log(`  ↷ Skipped (unchanged): ${filename}`);
        continue;
      }

      // Synthesize audio
      let wavBuffer: Buffer;
      if (isServiceOnline) {
        const synthesized = await client.synthesizeSpeechWithMeta(scriptInfo.spoken_script, lang, { slow: true });
        if (synthesized.isMock && !allowMock) {
          throw new Error(`Voice service returned mock audio for ${schemeId} (${lang}) and --allow-mock was not specified.`);
        }
        wavBuffer = Buffer.from(synthesized.buffer);
      } else {
        if (!allowMock) {
          throw new Error(`Voice service offline and --allow-mock was not specified.`);
        }
        wavBuffer = createFallbackWav(scriptInfo.estimated_duration_seconds);
      }

      // Spectral tone check: Detect artificial sine tone
      const toneCheck = detectToneOnlyAudio(wavBuffer);
      if (toneCheck.isToneOnly && !allowMock) {
        throw new Error(
          `[PrecomputeAudio] Tone-only audio detected via spectral check (peak ratio ${toneCheck.peakRatio.toFixed(3)}). Real neural audio required unless --allow-mock is specified.`
        );
      }

      // Convert WAV to MP3
      const audioOutputBuffer = convertWavToMp3(wavBuffer);
      fs.writeFileSync(outPath, audioOutputBuffer);

      const duration = measureWavDuration(wavBuffer) || scriptInfo.estimated_duration_seconds;

      manifest.push({
        scheme_id: schemeId,
        lang,
        filename,
        duration_seconds: duration,
        script: scriptInfo.spoken_script,
        script_checksum: scriptChecksum,
        size_bytes: audioOutputBuffer.length,
        review_status: "needs_native_review",
      });

      console.log(`  ✓ Cached: ${filename} (${(audioOutputBuffer.length / 1024).toFixed(1)} KB, ${duration}s)`);
    }
  }

  // Write single audio_manifest.json
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, manifestJson, "utf8");

  console.log(`\n[PrecomputeAudio] Precomputation completed! Manifest written to: ${manifestPath}`);
  console.log(`[PrecomputeAudio] Total audio entries: ${manifest.length}`);

  return manifest;
}

// Direct CLI execution
if (process.argv[1]?.endsWith("precompute-scheme-audio.ts") || process.argv[1]?.endsWith("precompute-scheme-audio.js")) {
  const args = process.argv.slice(2);
  const allowMock = args.includes("--allow-mock");
  const force = args.includes("--force");

  precomputeAllSchemeAudio({ allowMock, force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[PrecomputeAudio] Error:", err.message || err);
      process.exit(1);
    });
}

// Direct CLI execution
if (process.argv[1]?.endsWith("precompute-scheme-audio.ts") || process.argv[1]?.endsWith("precompute-scheme-audio.js")) {
  const args = process.argv.slice(2);
  const allowMock = args.includes("--allow-mock");
  const force = args.includes("--force");

  precomputeAllSchemeAudio({ allowMock, force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[PrecomputeAudio] Error:", err.message || err);
      process.exit(1);
    });
}
