import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { VoiceService } from "../src/modules/voice/voice.service.js";
import { config } from "../src/config.js";
import {
  simplifyForLowLiteracy,
  buildAccessibleCard,
  TEXT_SIZE_PRESETS,
} from "../src/modules/voice/accessibility/large-text.js";
import { generateSpokenScript, type SchemeAudioSource } from "../src/modules/voice/accessibility/scheme-audio-script.js";
import { buildServer } from "../src/server.js";
import { initDb, closeDb } from "../src/db/index.js";
import { CatalogueService } from "../src/modules/catalogue/service.js";
import { FastifyInstance } from "fastify";

describe("Indic Voice & Accessibility Features (TTS / STT & Large-Text)", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    const dataFilePath = path.resolve(process.cwd(), "data/government_welfare_schemes.json");
    if (fs.existsSync(dataFilePath)) {
      const { IngestionPipeline } = await import("../src/ingest/pipeline.js");
      await IngestionPipeline.ingest(dataFilePath);
    }
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });
  it("simplifies dense bureaucratic terminology for low-literacy Marathi citizens", () => {
    const rawMarathi = "अर्जदाराकडे अधिकृत अधिवास प्रमाणपत्र आणि थेट लाभ हस्तांतरण (DBT) बँक खाते असणे आवश्यक आहे.";
    const simplified = simplifyForLowLiteracy(rawMarathi, "mr");

    expect(simplified).toContain("महाराष्ट्रात १५ वर्षे राहिल्याचा दाखला (डोमिसाईल)");
    expect(simplified).toContain("बँकेत थेट पैसे जमा होणे");
  });

  it("simplifies dense bureaucratic terminology for low-literacy Hindi citizens", () => {
    const rawHindi = "लाभार्थी के पास निवास प्रमाण पत्र तथा प्रत्यक्ष लाभ अंतरण (DBT) सक्रिय होना चाहिए।";
    const simplified = simplifyForLowLiteracy(rawHindi, "hi");

    expect(simplified).toContain("राज्य में रहने का पक्का प्रमाण पत्र");
    expect(simplified).toContain("बैंक खाते में सीधे पैसे आना");
  });

  it("verifies large-text accessibility presets adhere to elderly-friendly visual standards", () => {
    expect(TEXT_SIZE_PRESETS.STANDARD.fontSizeRem).toBe(1.0);
    expect(TEXT_SIZE_PRESETS.LARGE.fontSizeRem).toBe(1.375);
    expect(TEXT_SIZE_PRESETS.LARGE.highContrast).toBe(true);

    expect(TEXT_SIZE_PRESETS.EXTRA_LARGE.fontSizeRem).toBe(1.875);
    expect(TEXT_SIZE_PRESETS.EXTRA_LARGE.lineHeight).toBeGreaterThanOrEqual(1.8);
    expect(TEXT_SIZE_PRESETS.EXTRA_LARGE.textColor).toBe("#000000");
  });

  it("generates natural spoken scripts for senior citizens with AI4Bharat Sunita persona", () => {
    const mockScheme = {
      scheme_id: "MH-SJSA-SANJAYGANDHI-014",
      official_name: "Sanjay Gandhi Niradhar Anudan Yojana",
      translated_names: {
        mr: "संजय गांधी निराधार अनुदान योजना",
      },
      overview: {
        simple_explanation: {
          mr: "निराधार व्यक्ती आणि विधवा महिलांसाठी मासिक निवृत्तीवेतन योजना.",
        },
      },
      benefits: {
        amount: 1500,
        frequency: "दरमहा",
      },
      assistance: {
        helpline: "1800-120-8040",
      },
    };

    const script = generateSpokenScript(mockScheme, "mr");
    expect(script.lang).toBe("mr");
    expect(script.spoken_script).toContain("संजय गांधी निराधार अनुदान योजना");
    expect(script.spoken_script).toContain("दीड हजार रुपये थेट आर्थिक मदत मिळते");
    expect(script.estimated_duration_seconds).toBeGreaterThan(10);
  });

  it("builds accessible card model with spoken-script metadata and audio link", () => {
    const card = buildAccessibleCard(
      {
        scheme_id: "MH-WCD-LADKIBAHIN-010",
        title: "मुख्यमंत्री माझी लाडकी बहीण योजना",
        benefit_amount: 1500,
        benefit_frequency: "दरमहा",
        explanation: "महिलांना दरमहा थेट लाभ हस्तांतरण (DBT) द्वारे आर्थिक सहाय्य.",
        documents: ["आधार कार्ड", "रेशन कार्ड", "अधिवास प्रमाणपत्र"],
      },
      "mr",
      "LARGE"
    );

    expect(card.accessibility.tier).toBe("LARGE");
    expect(card.accessibility.listen_button_label).toContain("मोठ्याने ऐका");
    expect(card.plain_explanation).toContain("बँकेत थेट पैसे जमा होणे");
    expect(card.audio_stream_url).toBe("/api/v1/voice/schemes/MH-WCD-LADKIBAHIN-010/audio?lang=mr");
  });

  it("retrieves precomputed scheme audio files from disk cache", async () => {
    const { buffer, source } = await VoiceService.getSchemeAudio("CENT-MORD-NSAP-006", "mr");
    expect(source).toBe("precomputed_cache");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(44); // Greater than WAV header
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
  });

  it("returns 401 UNAUTHORIZED when voice synthesis called without API key", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      payload: {
        text: "नमस्कार",
        lang: "mr",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 503 VOICE_UNAVAILABLE when voice service is offline and unmocked", async () => {
    config.voiceMock = false;

    const healthRes = await server.inject({
      method: "GET",
      url: "/api/v1/voice/health",
    });
    expect(healthRes.statusCode).toBe(503);
    const healthJson = JSON.parse(healthRes.payload);
    expect(healthJson.code).toBe("VOICE_UNAVAILABLE");

    const ttsRes = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      headers: { "x-api-key": "citizen-secret-key" },
      payload: {
        text: "नमस्कार",
        lang: "mr",
      },
    });
    expect(ttsRes.statusCode).toBe(503);
    const ttsJson = JSON.parse(ttsRes.payload);
    expect(ttsJson.code).toBe("VOICE_UNAVAILABLE");
  });

  it("returns 400 when invalid language is supplied to voice routes", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      headers: { "x-api-key": "citizen-secret-key" },
      payload: {
        text: "नमस्कार",
        lang: "invalid_lang",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 with browser speech fallback when precomputed audio is missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/voice/schemes/NON-EXISTENT-SCHEME/audio?lang=mr",
    });
    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.fallback).toBe("browser_speech_synthesis");
    expect(json.lang_bcp47).toBe("mr-IN");
  });

  it("handles voice synthesis and returns valid WAV format in mock mode", async () => {
    config.voiceMock = true;
    const { buffer } = await VoiceService.synthesize("नमस्कार, मुख्यमंत्री लाडकी बहीण योजनेची माहिती ऐका.", "mr", true);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(44);
    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
  });

  it("verifies full voice API endpoints via Fastify server with mocked provider", async () => {
    config.voiceMock = true;

    // 1. Voice Health
    const healthRes = await server.inject({
      method: "GET",
      url: "/api/v1/voice/health",
    });
    expect(healthRes.statusCode).toBe(200);
    const healthJson = JSON.parse(healthRes.payload);
    expect(healthJson.engine).toBeDefined();

    // 2. Text to Speech API
    const ttsRes = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      headers: { "x-api-key": "citizen-secret-key" },
      payload: {
        text: "या योजनेसाठी आधार कार्ड आणि रेशन कार्ड आवश्यक आहे.",
        lang: "mr",
        slow: true,
      },
    });
    expect(ttsRes.statusCode).toBe(200);
    expect(ttsRes.headers["content-type"]).toBe("audio/wav");
    expect(ttsRes.rawPayload.subarray(0, 4).toString("ascii")).toBe("RIFF");

    // 3. Scheme Audio Streaming
    const schemeAudioRes = await server.inject({
      method: "GET",
      url: "/api/v1/voice/schemes/CENT-MORD-NSAP-006/audio?lang=mr",
    });
    expect(schemeAudioRes.statusCode).toBe(200);
    expect(schemeAudioRes.headers["content-type"]).toBe("audio/wav");

    // 4. Accessible Card API (/schemes/:id/accessible-card)
    const cardRes = await server.inject({
      method: "GET",
      url: "/api/v1/schemes/CENT-MORD-NSAP-006/accessible-card?lang=mr&tier=EXTRA_LARGE",
    });
    expect(cardRes.statusCode).toBe(200);
    const cardJson = JSON.parse(cardRes.payload);
    expect(cardJson.accessibility.tier).toBe("EXTRA_LARGE");
    expect(cardJson.accessibility.has_precomputed_audio).toBe(true);
    expect(cardJson.audio_stream_url).toBe("/api/v1/voice/schemes/CENT-MORD-NSAP-006/audio?lang=mr");
    expect(cardJson.accessibility.listen_button_label).toContain("मोठ्याने ऐका");
  });

  it("POST /voice/stt rejects missing file with 400 BAD_REQUEST", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/voice/stt",
      headers: {
        "x-api-key": "citizen-secret-key",
      },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /voice/stt and POST /voice/tts return 503 when service is unreachable", async () => {
    config.voiceMock = false;
    const fakeWav = Buffer.alloc(100).toString("base64");
    const sttRes = await server.inject({
      method: "POST",
      url: "/api/v1/voice/stt",
      headers: { "x-api-key": "citizen-secret-key" },
      payload: {
        audio_base64: fakeWav,
        lang: "mr",
      },
    });
    expect(sttRes.statusCode).toBe(503);

    const ttsRes = await server.inject({
      method: "POST",
      url: "/api/v1/voice/tts",
      headers: { "x-api-key": "citizen-secret-key" },
      payload: {
        text: "नमस्कार",
        lang: "mr",
      },
    });
    expect(ttsRes.statusCode).toBe(503);
  });

  it("verifies all 24 schemes return valid Devanagari display_name and non-placeholder explanation in hi and mr", async () => {
    const devanagariRegex = /[\u0900-\u097F]/;
    const placeholderRegex = /placeholder|missing|TODO|lorem|dummy/i;

    for (const lang of ["mr", "hi"] as const) {
      const list = await CatalogueService.listSchemes({
        limit: 100,
        lang,
        view: "detail",
      });

      expect(list.items.length).toBeGreaterThanOrEqual(24);

      for (const item of list.items) {
        const id = item.scheme_id as string;
        const displayName = item.display_name as string;
        const expl = (item.overview as { simple_explanation?: { en?: string; hi?: string; mr?: string } })
          ?.simple_explanation?.[lang] || "";

        expect(displayName, `Scheme ${id} display_name in ${lang}`).toBeDefined();
        expect(devanagariRegex.test(displayName), `Scheme ${id} display_name should be Devanagari in ${lang}`).toBe(true);

        expect(expl, `Scheme ${id} explanation in ${lang}`).toBeDefined();
        expect(expl.length, `Scheme ${id} explanation length in ${lang}`).toBeGreaterThan(10);
        expect(devanagariRegex.test(expl), `Scheme ${id} explanation should be Devanagari in ${lang}`).toBe(true);
        expect(placeholderRegex.test(expl), `Scheme ${id} explanation contains placeholder in ${lang}`).toBe(false);
      }
    }
  });

  it("verifies lang_fallback is false for all 24 schemes in both hi and mr in card view", async () => {
    for (const lang of ["mr", "hi"] as const) {
      const list = await CatalogueService.listSchemes({
        limit: 100,
        lang,
        view: "card",
      });

      expect(list.items.length).toBeGreaterThanOrEqual(24);

      for (const item of list.items) {
        const id = item.scheme_id as string;
        expect(item.lang_fallback, `Scheme ${id} had lang_fallback=true for ${lang}`).toBe(false);
        expect(item.lang_served).toBe(lang);
      }
    }
  });

  it("accessible card endpoint returns correct CSS classes and font scale for each tier", async () => {
    const tiers = [
      { tier: "STANDARD", fontSizeRem: 1.0, css: "accessible-card-standard" },
      { tier: "LARGE", fontSizeRem: 1.375, css: "accessible-card-large" },
      { tier: "EXTRA_LARGE", fontSizeRem: 1.875, css: "accessible-card-extra-large" },
    ] as const;

    for (const t of tiers) {
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/schemes/CENT-MOAFW-PMKISAN-001/accessible-card?lang=mr&tier=${t.tier}`,
      });
      expect(res.statusCode).toBe(200);
      const card = JSON.parse(res.payload);
      expect(card.accessibility.tier).toBe(t.tier);
      expect(card.accessibility.font_size_rem).toBe(t.fontSizeRem);
      expect(card.accessibility.container_css).toBe(t.css);
    }
  });

  it("spoken script generator output contains zero Latin words (>3 letters) and no '..'", async () => {
    const dataFilePath = path.resolve(process.cwd(), "data/government_welfare_schemes.json");
    const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    const schemes = (raw.schemes || []) as Array<Record<string, unknown>>;

    expect(schemes.length).toBeGreaterThanOrEqual(24);

    for (const s of schemes) {
      const id = String(s.scheme_id);
      for (const lang of ["mr", "hi"] as const) {
        const script = generateSpokenScript(s as unknown as SchemeAudioSource, lang);
        expect(script.spoken_script, `Scheme ${id} (${lang}) has duplicate dots`).not.toContain("..");
        expect(script.spoken_script, `Scheme ${id} (${lang}) has Latin words > 3 letters`).not.toMatch(/[a-zA-Z]{4,}/);
      }
    }
  });
});
