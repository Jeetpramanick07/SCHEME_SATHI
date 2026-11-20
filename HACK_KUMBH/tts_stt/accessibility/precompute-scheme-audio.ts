import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { IndicVoiceClient, type IndicLangCode } from "../client/indicVoiceClient.js";
import { generateSpokenScript, type SchemeAudioSource } from "./scheme-audio-script.js";

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

  // Soft sinusoidal acoustic confirmation waveform
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
 * Measures real audio duration from standard WAV header (bytes 28-31 byte_rate, bytes 40-43 data_size).
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
}

export async function precomputeAllSchemeAudio(options: PrecomputeOptions = {}): Promise<ManifestEntry[]> {
  const allowMock = options.allowMock ?? false;
  const force = options.force ?? false;
  const voiceServiceUrl = options.voiceServiceUrl || process.env.INDIC_VOICE_URL || "http://localhost:8000";

  const resolvedDataset =
    options.datasetPath ||
    path.resolve(process.cwd(), "data/government_welfare_schemes.json");

  const resolvedOutput =
    options.outputDir || path.resolve(process.cwd(), "tts_stt/audio_cache");

  if (!fs.existsSync(resolvedOutput)) {
    fs.mkdirSync(resolvedOutput, { recursive: true });
  }

  console.log(`[PrecomputeAudio] Loading dataset from: ${resolvedDataset}`);
  const raw = fs.readFileSync(resolvedDataset, "utf8");
  const data = JSON.parse(raw);
  const schemes = (data.schemes || []) as Array<Record<string, unknown>>;

  console.log(`[PrecomputeAudio] Processing ${schemes.length} schemes (force=${force}, allowMock=${allowMock})...`);

  // Load existing manifest if present to preserve unchanged files
  const existingManifestMap = new Map<string, ManifestEntry>();
  const manifestCandidates = [
    path.join(resolvedOutput, "audio_manifest.json"),
    path.resolve(resolvedOutput, "../audio_manifest.json"),
  ];

  for (const mPath of manifestCandidates) {
    if (fs.existsSync(mPath)) {
      try {
        const oldEntries = JSON.parse(fs.readFileSync(mPath, "utf-8")) as ManifestEntry[];
        for (const entry of oldEntries) {
          existingManifestMap.set(`${entry.scheme_id}_${entry.lang}`, entry);
        }
        break;
      } catch {
        // ignore parse error
      }
    }
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
    console.log(`[PrecomputeAudio] Voice service offline at ${voiceServiceUrl}. Running in mock generator mode (--allow-mock enabled).`);
  }

  if (serviceIsMock && !allowMock) {
    console.error(`[PrecomputeAudio] FATAL: Voice service at ${voiceServiceUrl} returned mock mode (X-Mock: true) and --allow-mock was not specified.`);
    throw new Error("Voice service is running in mock mode. Real audio required for production precomputation.");
  }

  const manifest: ManifestEntry[] = [];
  const languages: IndicLangCode[] = ["mr", "hi"];

  for (const s of schemes) {
    const schemeId = String(s.scheme_id);
    for (const lang of languages) {
      const scriptInfo = generateSpokenScript(s as unknown as SchemeAudioSource, lang);
      const scriptChecksum = computeScriptChecksum(scriptInfo.spoken_script);
      const filename = `${schemeId}_${lang}.wav`;
      const outPath = path.join(resolvedOutput, filename);

      const existingEntry = existingManifestMap.get(`${schemeId}_${lang}`);
      const fileExists = fs.existsSync(outPath);
      const scriptUnchanged = existingEntry && existingEntry.script_checksum === scriptChecksum;

      // Skip regeneration if file exists, script checksum matches, and --force is not set
      if (!force && fileExists && scriptUnchanged) {
        const existingBuffer = fs.readFileSync(outPath);
        const realDuration = measureWavDuration(existingBuffer) || existingEntry.duration_seconds;
        manifest.push({
          scheme_id: schemeId,
          lang,
          filename,
          duration_seconds: realDuration,
          script: scriptInfo.spoken_script,
          script_checksum: scriptChecksum,
          size_bytes: existingBuffer.length,
        });
        console.log(`  ↷ Skipped (unchanged): ${filename} (${realDuration}s)`);
        continue;
      }

      // Generation required
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

      const realDuration = measureWavDuration(wavBuffer) || scriptInfo.estimated_duration_seconds;
      fs.writeFileSync(outPath, wavBuffer);

      manifest.push({
        scheme_id: schemeId,
        lang,
        filename,
        duration_seconds: realDuration,
        script: scriptInfo.spoken_script,
        script_checksum: scriptChecksum,
        size_bytes: wavBuffer.length,
      });

      console.log(`  ✓ Cached: ${filename} (${(wavBuffer.length / 1024).toFixed(1)} KB, ${realDuration}s)`);
    }
  }

  // Write manifest to audio_cache/audio_manifest.json AND parent directory audio_manifest.json (for git tracking)
  const manifestJson = JSON.stringify(manifest, null, 2);
  const cacheManifestPath = path.join(resolvedOutput, "audio_manifest.json");
  fs.writeFileSync(cacheManifestPath, manifestJson, "utf8");

  // Also write to parent tts_stt/audio_manifest.json if resolvedOutput is audio_cache
  if (path.basename(resolvedOutput) === "audio_cache") {
    const parentManifestPath = path.resolve(resolvedOutput, "../audio_manifest.json");
    fs.writeFileSync(parentManifestPath, manifestJson, "utf8");
  }

  console.log(`\n[PrecomputeAudio] Precomputation completed! Manifest written to: ${cacheManifestPath}`);
  console.log(`[PrecomputeAudio] Total audio files cached: ${manifest.length}`);

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
