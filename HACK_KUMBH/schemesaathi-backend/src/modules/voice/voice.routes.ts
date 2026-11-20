import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { VoiceService, type IndicLangCode, VoiceUnavailableError } from "./voice.service.js";
import { CatalogueService } from "../catalogue/service.js";
import { buildAccessibleCard, type TextSizeTier } from "./accessibility/large-text.js";
import { requireRole } from "../../services/auth.js";

const SttJsonSchema = z.object({
  audio_base64: z.string().min(1, "audio_base64 is required"),
  filename: z.string().default("voice_query.wav"),
  lang: z.enum(["mr", "hi"]).default("mr"),
});

const TtsRequestSchema = z.object({
  text: z.string().min(1, "text is required"),
  lang: z.enum(["mr", "hi"]).default("mr"),
  slow: z.boolean().default(true),
});

const AccessibleCardQuerySchema = z.object({
  lang: z.enum(["en", "hi", "mr"]).optional(),
  tier: z.enum(["STANDARD", "LARGE", "EXTRA_LARGE"]).optional(),
  household_id: z.string().optional(),
});

export async function voiceRoutes(fastify: FastifyInstance) {
  // GET /voice/health
  fastify.get(
    "/voice/health",
    {
      schema: {
        description: "Health check for the Indic Voice AI microservice and static audio cache",
        tags: ["Voice"],
      },
    },
    async (_request, reply) => {
      try {
        const health = await VoiceService.getHealth();
        return reply.send(health);
      } catch (err) {
        return reply.status(503).send({
          code: "VOICE_UNAVAILABLE",
          message: err instanceof Error ? err.message : "Voice service unavailable",
          error: {
            code: "VOICE_UNAVAILABLE",
            message: err instanceof Error ? err.message : "Voice service unavailable",
          },
        });
      }
    }
  );

  // POST /voice/stt (multipart audio + lang mr|hi -> {transcript, lang, engine})
  fastify.post(
    "/voice/stt",
    {
      preHandler: requireRole(["citizen_or_volunteer", "admin"]),
      schema: {
        description: "Speech-to-Text transcription for Marathi (mr) and Hindi (hi) audio",
        tags: ["Voice"],
      },
    },
    async (request, reply) => {
      let audioBuffer: Buffer | null = null;
      let filename = "query.wav";
      let lang: IndicLangCode = "mr";

      try {
        if (request.isMultipart()) {
          const part = await request.file();
          if (!part) {
            return reply.status(400).send({
              code: "BAD_REQUEST",
              error: { code: "BAD_REQUEST", message: "Multipart audio file is required" },
            });
          }
          audioBuffer = await part.toBuffer();
          filename = part.filename || "query.wav";
          const queryLang = (request.query as { lang?: string })?.lang;
          const fields = part.fields as Record<string, { value?: string }>;
          const parsedLang = fields.lang?.value || queryLang;
          if (parsedLang === "hi" || parsedLang === "mr") {
            lang = parsedLang;
          } else if (parsedLang) {
            return reply.status(400).send({
              code: "INVALID_LANGUAGE",
              error: { code: "INVALID_LANGUAGE", message: "Language must be 'mr' or 'hi'" },
            });
          }
        } else if (request.body) {
          const parsed = SttJsonSchema.safeParse(request.body);
          if (!parsed.success) {
            return reply.status(400).send({
              code: "BAD_REQUEST",
              error: { code: "BAD_REQUEST", message: parsed.error.message },
            });
          }
          audioBuffer = Buffer.from(parsed.data.audio_base64, "base64");
          filename = parsed.data.filename;
          lang = parsed.data.lang;
        } else {
          return reply.status(400).send({
            code: "BAD_REQUEST",
            error: { code: "BAD_REQUEST", message: "Audio payload is required" },
          });
        }

        if (!audioBuffer || audioBuffer.length === 0) {
          return reply.status(400).send({
            code: "BAD_REQUEST",
            error: { code: "BAD_REQUEST", message: "Audio buffer cannot be empty" },
          });
        }

        const { result, isMock } = await VoiceService.transcribe(audioBuffer, filename, lang);
        if (isMock) {
          reply.header("X-Mock", "true");
        }
        return reply.send({
          transcript: result.transcript,
          lang: result.lang,
          engine: result.engine || "ai4bharat/indic-conformer-600m-multilingual",
          confidence: result.confidence,
        });
      } catch (err) {
        if (err instanceof VoiceUnavailableError) {
          return reply.status(503).send({
            code: "VOICE_UNAVAILABLE",
            message: err.message,
            error: { code: "VOICE_UNAVAILABLE", message: err.message },
          });
        }
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  );

  // POST /voice/tts ({text, lang, slow} -> audio/wav)
  fastify.post(
    "/voice/tts",
    {
      preHandler: requireRole(["citizen_or_volunteer", "admin"]),
      schema: {
        description: "Text-to-Speech synthesis in Devanagari using AI4Bharat Indic Parler-TTS",
        tags: ["Voice"],
      },
    },
    async (request, reply) => {
      const parsed = TtsRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "BAD_REQUEST",
          error: { code: "BAD_REQUEST", message: parsed.error.message },
        });
      }

      try {
        const { buffer, isMock } = await VoiceService.synthesize(
          parsed.data.text,
          parsed.data.lang as IndicLangCode,
          parsed.data.slow
        );
        reply.header("Content-Type", "audio/wav");
        reply.header("Content-Disposition", `inline; filename="speech_${parsed.data.lang}.wav"`);
        if (isMock) {
          reply.header("X-Mock", "true");
        }
        return reply.send(buffer);
      } catch (err) {
        if (err instanceof VoiceUnavailableError) {
          return reply.status(503).send({
            code: "VOICE_UNAVAILABLE",
            message: err.message,
            error: { code: "VOICE_UNAVAILABLE", message: err.message },
          });
        }
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  );

  // GET /voice/schemes/:id/audio?lang= (serve precomputed file from audio_cache via manifest; if missing return 404 with browser fallback)
  fastify.get(
    "/voice/schemes/:id/audio",
    {
      schema: {
        description: "Serve static precomputed scheme audio or fallback instruction for browser TTS",
        tags: ["Voice"],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { lang?: string };
      const lang = query.lang === "hi" ? "hi" : "mr";

      const precomputed = VoiceService.getPrecomputedAudio(id, lang);
      if (precomputed) {
        reply.header("Content-Type", "audio/wav");
        reply.header("X-Audio-Source", "precomputed_cache");
        reply.header("Content-Disposition", `inline; filename="${precomputed.filename}"`);
        return reply.send(precomputed.buffer);
      }

      // Precomputed audio is missing; fetch scheme text for browser fallback
      const scheme = await CatalogueService.getSchemeById(id, lang);
      const fallbackText =
        scheme?.simple_explanation_localized ||
        (lang === "mr"
          ? `${scheme?.display_name || id} ची सविस्तर माहिती उपलब्ध आहे.`
          : `${scheme?.display_name || id} की विस्तृत जानकारी उपलब्ध है।`);

      return reply.status(404).send({
        fallback: "browser_speech_synthesis",
        text: fallbackText,
        lang_bcp47: lang === "mr" ? "mr-IN" : "hi-IN",
      });
    }
  );

  // Handler for Accessible Card
  const handleAccessibleCard = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsedQuery = AccessibleCardQuerySchema.safeParse(request.query);
    const queryData = parsedQuery.success ? parsedQuery.data : {};
    let lang = queryData.lang;
    let tier = queryData.tier;

    if (queryData.household_id && (!lang || !tier)) {
      const { HouseholdService } = await import("../households/service.js");
      if (!lang) {
        lang = await HouseholdService.getPreferredLang(queryData.household_id);
      }
      if (!tier) {
        tier = await HouseholdService.getPreferredTextTier(queryData.household_id);
      }
    }

    if (!lang) lang = "mr";
    if (!tier) tier = "LARGE";

    const scheme = await CatalogueService.getSchemeById(id, lang);
    if (!scheme) {
      return reply.status(404).send({
        code: "SCHEME_NOT_FOUND",
        error: { code: "SCHEME_NOT_FOUND", message: `Scheme '${id}' not found` },
      });
    }

    const docNames = (scheme.resolved_documents || []).map(
      (d: { details?: { official_document_name?: string | null; document_type?: string | null } | null }) =>
        d.details?.official_document_name || d.details?.document_type || "कागदपत्र"
    );

    const helpCentres = scheme.resolved_help_centres || [];
    const helpCentreNote = helpCentres.length > 0 && helpCentres[0]
      ? `${helpCentres[0].centre_name}: ${helpCentres[0].complete_address || ""}`
      : undefined;

    const hasAudio = VoiceService.hasPrecomputedAudio(id, lang === "en" ? "mr" : lang);

    const card = buildAccessibleCard(
      {
        scheme_id: scheme.scheme_id,
        title: scheme.display_name,
        benefit_amount: (scheme.benefits as { amount?: number | string })?.amount,
        benefit_frequency: (scheme.benefits as { frequency?: string })?.frequency,
        explanation: scheme.simple_explanation_localized || scheme.official_name,
        documents: docNames,
        help_centre: helpCentreNote,
        has_precomputed_audio: hasAudio,
      },
      lang === "hi" ? "hi" : "mr",
      tier as TextSizeTier
    );

    // Keep audio_url alias for backward compatibility with existing tests
    return reply.send({
      ...card,
      audio_url: card.audio_stream_url,
    });
  };

  // GET /schemes/:id/accessible-card
  fastify.get(
    "/schemes/:id/accessible-card",
    {
      schema: {
        description: "Accessible card view with large text typography and audio links",
        tags: ["Accessibility"],
      },
    },
    handleAccessibleCard
  );

  // Alias for backward compatibility: GET /voice/schemes/:id/accessible
  fastify.get(
    "/voice/schemes/:id/accessible",
    {
      schema: {
        description: "Accessible card view (legacy alias)",
        tags: ["Accessibility"],
      },
    },
    handleAccessibleCard
  );
}
