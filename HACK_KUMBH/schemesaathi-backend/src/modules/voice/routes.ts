import { FastifyInstance, FastifyPluginAsync } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { IndicVoiceClient, type IndicLangCode } from "./client/indicVoiceClient.js";
import { measureWavDuration } from "./accessibility/precompute-scheme-audio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const voiceRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const voiceServiceUrl = process.env.INDIC_VOICE_URL || "http://localhost:8000";
  const client = new IndicVoiceClient(voiceServiceUrl);

  const audioCacheDir = path.resolve(__dirname, "audio_cache");
  const manifestPath = path.resolve(__dirname, "audio_manifest.json");

  // Load manifest metadata for mock/tone detection
  const manifestMap = new Map<string, { is_mock?: boolean; is_tone?: boolean; tone?: boolean; review_status?: string }>();
  function loadManifest() {
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        for (const entry of manifest) {
          manifestMap.set(`${entry.scheme_id}_${entry.lang}`, entry);
        }
      } catch {}
    }
  }
  loadManifest();

  // 1. GET /health (reports mock_mode, degrades cleanly if service is down)
  server.get("/health", async (request, reply) => {
    try {
      const health = await client.checkHealth();
      return {
        status: "ok",
        mock_mode: Boolean(health.mock_mode),
        service_available: true,
        device: health.device,
        models_loaded: health.models_loaded,
        engine: health.engine,
      };
    } catch {
      // Clean degradation when voice service is offline
      return {
        status: "degraded",
        mock_mode: true,
        service_available: false,
        device: "cpu",
        models_loaded: false,
        message: "Voice service unavailable, browser fallback enabled",
      };
    }
  });

  // 2. POST /tts (Synthesize speech, 503 fallback if down)
  server.post<{
    Body: { text: string; lang?: IndicLangCode; slow?: boolean };
  }>("/tts", async (request, reply) => {
    const { text, lang = "mr", slow = true } = request.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return reply.status(400).send({
        error: {
          code: "TEXT_REQUIRED",
          message: "The 'text' field is required for speech synthesis",
        },
      });
    }

    try {
      const { buffer, isMock } = await client.synthesizeSpeechWithMeta(text.trim(), lang, { slow });
      reply.header("Content-Type", "audio/wav");
      if (isMock) {
        reply.header("X-Mock", "true");
      }
      return reply.send(Buffer.from(buffer));
    } catch (err) {
      request.log.warn({ err }, "Voice synthesis service unavailable");
      return reply.status(503).send({
        error: {
          code: "VOICE_SERVICE_UNAVAILABLE",
          message: "Voice synthesis service is currently unavailable. Please use browser read-aloud.",
        },
      });
    }
  });

  // 3. POST /stt (Multipart STT, max 30s, audio NEVER stored or logged)
  server.post("/stt", async (request, reply) => {
    let part;
    try {
      part = await request.file();
    } catch (err) {
      return reply.status(400).send({
        error: {
          code: "MULTIPART_ERROR",
          message: "Failed to parse multipart audio payload",
        },
      });
    }

    if (!part) {
      return reply.status(400).send({
        error: {
          code: "AUDIO_REQUIRED",
          message: "Audio file payload is required in field 'file' or 'audio'",
        },
      });
    }

    // Read audio strictly in-memory into a transient buffer (NEVER written to disk or logged)
    const audioBuffer = await part.toBuffer();

    // Check maximum 30 seconds constraint
    const wavDuration = measureWavDuration(audioBuffer);
    if (wavDuration > 30) {
      return reply.status(400).send({
        error: {
          code: "AUDIO_DURATION_EXCEEDED",
          message: `Audio duration (${wavDuration}s) exceeds maximum allowed limit of 30 seconds`,
        },
      });
    }

    // Safety fallback: 30s of 16kHz 16-bit mono WAV is ~960 KB; reject payloads > 2 MB
    if (audioBuffer.length > 2 * 1024 * 1024) {
      return reply.status(400).send({
        error: {
          code: "AUDIO_DURATION_EXCEEDED",
          message: "Audio payload exceeds maximum allowable length for 30 seconds",
        },
      });
    }

    const lang = (part.fields?.lang as any)?.value === "hi" ? "hi" : "mr";

    try {
      const result = await client.transcribeAudio(audioBuffer, part.filename || "query.wav", lang);
      return reply.send({
        transcript: result.transcript,
        confidence: result.confidence ?? 0.92,
        language: lang,
        engine: result.engine ?? "ai4bharat/indic-conformer-600m-multilingual",
      });
    } catch (err) {
      request.log.warn({ err }, "Speech recognition service unavailable");
      return reply.status(503).send({
        error: {
          code: "VOICE_SERVICE_UNAVAILABLE",
          message: "Speech recognition service is currently unavailable. Please tap to enter your answer.",
        },
      });
    }
  });

  // 4. GET /schemes/:id/audio?lang= (Static precomputed audio file, 404 if absent or mock/tone)
  server.get<{
    Params: { id: string };
    Querystring: { lang?: string };
  }>("/schemes/:id/audio", async (request, reply) => {
    const schemeId = request.params.id;
    const lang = request.query.lang === "hi" ? "hi" : "mr";

    // Beep Audio Guard: check manifest. If flagged mock or tone, treat as ABSENT (return 404)
    // so UI falls back to browser speech synthesis and never plays a synthetic 440 Hz tone.
    loadManifest();
    const meta = manifestMap.get(`${schemeId}_${lang}`);
    if (meta?.is_mock || meta?.is_tone || meta?.tone) {
      return reply.status(404).send({
        error: {
          code: "AUDIO_NOT_FOUND",
          message: `Precomputed audio for scheme '${schemeId}' (${lang}) is flagged mock/tone and treated as absent.`,
        },
      });
    }

    // Candidates in order: mp3, opus, wav
    const candidateExtensions = [
      { ext: ".mp3", mime: "audio/mpeg" },
      { ext: ".opus", mime: "audio/ogg" },
      { ext: ".wav", mime: "audio/wav" },
    ];

    for (const { ext, mime } of candidateExtensions) {
      const filename = `${schemeId}_${lang}${ext}`;
      const filePath = path.join(audioCacheDir, filename);

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        reply.header("Content-Type", mime);
        reply.header("Cache-Control", "public, max-age=86400");
        return reply.send(fileBuffer);
      }
    }

    return reply.status(404).send({
      error: {
        code: "AUDIO_NOT_FOUND",
        message: `Precomputed audio for scheme '${schemeId}' in language '${lang}' not found`,
      },
    });
  });
};
