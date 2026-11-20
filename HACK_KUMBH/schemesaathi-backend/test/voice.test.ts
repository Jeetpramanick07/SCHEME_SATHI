import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { initDb, closeDb } from "../src/db/index.js";
import { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Voice Integration Suite (tts_stt)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  // 1. GET /api/v1/voice/health (reports mock_mode & clean degradation)
  it("detects mock_mode and degrades cleanly when voice service is offline", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/voice/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.mock_mode).toBeDefined();
    expect(typeof body.mock_mode).toBe("boolean");
    // When offline, status is degraded and mock_mode is true
    if (!body.service_available) {
      expect(body.status).toBe("degraded");
      expect(body.mock_mode).toBe(true);
    }
  });

  // 2. Also test root alias /voice/health
  it("supports root alias /voice/health", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/voice/health",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.mock_mode).toBeDefined();
  });

  // 3. POST /voice/tts (503 fallback when voice service is down)
  it("returns 503 VOICE_SERVICE_UNAVAILABLE when voice synthesis service is unreachable", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      payload: {
        text: "नमस्कार. ही योजना कल्याणकारी आहे.",
        lang: "mr",
      },
    });

    // If external service is not running on localhost:8000, must return 503 with friendly code
    if (res.statusCode === 503) {
      const err = JSON.parse(res.body);
      expect(err.error.code).toBe("VOICE_SERVICE_UNAVAILABLE");
      expect(err.error.message).toContain("unavailable");
    } else {
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("audio/wav");
    }
  });

  // 4. POST /voice/tts rejects empty text with 400
  it("rejects empty text with 400 TEXT_REQUIRED", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/voice/tts",
      payload: {
        text: "",
        lang: "mr",
      },
    });

    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body);
    expect(err.error.code).toBe("TEXT_REQUIRED");
  });

  // 5. GET /voice/schemes/:id/audio (404 handling)
  it("returns 404 AUDIO_NOT_FOUND when precomputed audio is absent", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/voice/schemes/NON_EXISTENT_SCHEME_XYZ/audio?lang=mr",
    });

    expect(res.statusCode).toBe(404);
    const err = JSON.parse(res.body);
    expect(err.error.code).toBe("AUDIO_NOT_FOUND");
    expect(err.error.message).toContain("not found");
  });

  // 6. Beep Audio Guard: treats mock/tone flagged audio as ABSENT (returns 404)
  it("Beep Audio Guard: treats cached scheme audio flagged mock/tone as ABSENT (404) so UI falls back to speech synthesis", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/voice/schemes/CENT-MOAFW-PMKISAN-001/audio?lang=mr",
    });

    expect(res.statusCode).toBe(404);
    const err = JSON.parse(res.body);
    expect(err.error.code).toBe("AUDIO_NOT_FOUND");
    expect(err.error.message).toContain("mock/tone");
  });

  // 6b. Delivers precomputed audio when verified and not flagged mock/tone
  it("delivers static precomputed audio with cache headers when entry is not flagged mock/tone", async () => {
    const manifestPath = path.resolve(__dirname, "../src/modules/voice/audio_manifest.json");
    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);

    // Temporarily unflag one entry for test
    const target = manifest.find((m: any) => m.scheme_id === "CENT-MOAFW-PMKISAN-001" && m.lang === "mr");
    if (target) {
      target.is_mock = false;
      target.is_tone = false;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    try {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/voice/schemes/CENT-MOAFW-PMKISAN-001/audio?lang=mr",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/audio\/(mpeg|wav|ogg)/);
      expect(res.headers["cache-control"]).toContain("max-age=86400");
      expect(res.rawPayload.length).toBeGreaterThan(1000);
    } finally {
      // Restore manifest back to mock/tone=true
      fs.writeFileSync(manifestPath, manifestRaw);
    }
  });

  // 7. POST /voice/stt duration limit and proving NO AUDIO STORED on disk
  it("proves audio is never stored or logged to disk, and rejects audio > 30s", async () => {
    const voiceDir = path.resolve(__dirname, "../src/modules/voice");
    const audioCacheDir = path.resolve(voiceDir, "audio_cache");

    // Snapshot existing files in voice module and audio_cache
    const filesBefore = new Set(fs.readdirSync(voiceDir));
    const cacheBefore = new Set(fs.readdirSync(audioCacheDir));

    // Construct a synthetic 16kHz mono WAV buffer > 30s (e.g. 32 seconds = 32 * 32000 = 1024000 bytes)
    const longDuration = 32;
    const sampleRate = 16000;
    const numSamples = longDuration * sampleRate;
    const longWav = Buffer.alloc(44 + numSamples * 2);
    longWav.write("RIFF", 0);
    longWav.writeUInt32LE(longWav.length - 8, 4);
    longWav.write("WAVE", 8);
    longWav.write("fmt ", 12);
    longWav.writeUInt32LE(16, 16);
    longWav.writeUInt16LE(1, 20); // PCM
    longWav.writeUInt16LE(1, 22); // mono
    longWav.writeUInt32LE(sampleRate, 24);
    longWav.writeUInt32LE(sampleRate * 2, 28);
    longWav.writeUInt16LE(2, 32);
    longWav.writeUInt16LE(16, 34);
    longWav.write("data", 36);
    longWav.writeUInt32LE(numSamples * 2, 40);

    // Send multipart request with > 30s audio
    const boundary = "---------------------------974767299852498929531610575";
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_long.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      longWav,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="lang"\r\n\r\nmr\r\n--${boundary}--\r\n`),
    ]);

    const res = await server.inject({
      method: "POST",
      url: "/voice/stt",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    });

    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body);
    expect(err.error.code).toBe("AUDIO_DURATION_EXCEEDED");

    // Assert that NO files were written to disk
    const filesAfter = new Set(fs.readdirSync(voiceDir));
    const cacheAfter = new Set(fs.readdirSync(audioCacheDir));

    expect(filesAfter.size).toBe(filesBefore.size);
    expect(cacheAfter.size).toBe(cacheBefore.size);

    // Explicitly verify no temporary .wav or .tmp file exists
    for (const f of filesAfter) {
      expect(f).not.toMatch(/test_long/);
      expect(f).not.toMatch(/\.tmp$/);
    }
    for (const f of cacheAfter) {
      expect(f).not.toMatch(/test_long/);
      expect(f).not.toMatch(/\.tmp$/);
    }
  });
});
