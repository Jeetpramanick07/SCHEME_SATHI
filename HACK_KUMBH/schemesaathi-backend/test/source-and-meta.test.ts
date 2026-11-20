import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { initDb, closeDb, db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import { eq } from "drizzle-orm";
import { rulesCache } from "../src/services/cache.js";

describe("Schemes Source, Verification, Explore Ranking, CORS & Metadata Suite", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    await IngestionPipeline.ingest("data/government_welfare_schemes.json");
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  // 1. SCHEMES SOURCE COLUMN & VERIFIED DEFAULTS
  describe("Schemes Source Column & Verified Defaults", () => {
    it("verifies that schemes table has source column and exactly 24 gold standard schemes are curated", async () => {
      const allSchemes = await db.select().from(schema.schemes);
      const curatedSchemes = allSchemes.filter((s) => s.source === "curated" && !s.is_test);
      const importedSchemes = allSchemes.filter((s) => s.source === "imported" && !s.is_test);

      // 24 curated schemes from data/government_welfare_schemes.json
      expect(curatedSchemes.length).toBe(24);
      // All curated schemes must be marked verified = true
      for (const cs of curatedSchemes) {
        expect(cs.verified).toBe(true);
      }

      // Imported schemes exist and default to verified = false
      expect(importedSchemes.length).toBeGreaterThan(0);
      for (const is of importedSchemes) {
        expect(is.verified).toBe(false);
      }
    });

    it("ensures imported schemes default to verified=false at ingest", async () => {
      const testImportId = "TEST_IMPORT_DEFAULT_001";
      await db
        .insert(schema.schemes)
        .values({
          scheme_id: testImportId,
          official_name: "Test Imported Default Scheme",
          translated_names: { en: "Test Imported Default Scheme" },
          level: "STATE",
          scheme_type: "WELFARE",
          overview: { objective: "Testing import defaults" },
          benefits: { benefit_type: "CASH", amount: 500 },
          raw: {},
          compiled_rules: {
            scheme_id: testImportId,
            status: "ACTIVE",
            accepting_applications: "YES",
            hard_filters: {},
            rules: [],
            exclusions: [],
          },
          status: "ACTIVE",
          accepting_applications: "YES",
          source: "imported",
          // verified omitted -> must default to false
          content_hash: "hash_test_import_001",
          version: 1,
          is_test: true,
        })
        .onConflictDoNothing();

      try {
        const rows = await db
          .select()
          .from(schema.schemes)
          .where(eq(schema.schemes.scheme_id, testImportId));
        expect(rows.length).toBe(1);
        expect(rows[0]?.source).toBe("imported");
        expect(rows[0]?.verified).toBe(false);
      } finally {
        await db.delete(schema.schemes).where(eq(schema.schemes.scheme_id, testImportId));
      }
    });
  });

  // 2. EXPLORE BUCKET RELEVANCE RANKING
  describe("Explore Bucket Relevance Ranking", () => {
    it("ranks the explore bucket by relevance to subject (gender/age/category matches)", async () => {
      const evalRes = await server.inject({
        method: "POST",
        url: "/api/v1/eligibility/evaluate",
        payload: {
          household: {
            district_id: "DIST_MH_NGP",
            taluka: "Nagpur Urban",
            state: "Maharashtra",
          },
          members: [
            {
              member_id: "mem_rank_test",
              age: 62,
              gender: "FEMALE",
              marital_status: "WIDOW",
              caste_category: "GENERAL",
            },
          ],
          include_all: true,
          include_explore: true,
        },
      });

      expect(evalRes.statusCode).toBe(200);
      const data = JSON.parse(evalRes.body);
      const exploreList = data.results[0].tiers.explore;

      expect(exploreList.length).toBeGreaterThan(0);

      // Verify each explore scheme has a non-negative relevance_score
      for (const item of exploreList) {
        expect(item.relevance_score).toBeDefined();
        expect(typeof item.relevance_score).toBe("number");
        expect(item.relevance_score).toBeGreaterThanOrEqual(0);
      }

      // Verify list is sorted in descending order of relevance_score
      for (let i = 0; i < exploreList.length - 1; i++) {
        expect(exploreList[i].relevance_score).toBeGreaterThanOrEqual(
          exploreList[i + 1].relevance_score
        );
      }

      // Schemes matching the subject's gender (FEMALE), age, or widow status must have positive score at the top
      const topScheme = exploreList[0];
      expect(topScheme.relevance_score).toBeGreaterThan(0);
    });
  });

  // 3. CORS ORIGIN CONFIGURATION
  describe("CORS Origin Configuration", () => {
    it("allows configured web origins and includes appropriate CORS headers", async () => {
      const allowedOrigin = "http://localhost:5173";
      const corsRes = await server.inject({
        method: "GET",
        url: "/api/v1/meta",
        headers: {
          origin: allowedOrigin,
        },
      });

      expect(corsRes.statusCode).toBe(200);
      expect(corsRes.headers["access-control-allow-origin"]).toBe(allowedOrigin);
      expect(corsRes.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("handles CORS preflight OPTIONS request properly", async () => {
      const preflightRes = await server.inject({
        method: "OPTIONS",
        url: "/api/v1/meta",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET",
        },
      });

      expect(preflightRes.statusCode).toBe(204);
      expect(preflightRes.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
  });

  // 4. GET /api/v1/meta
  describe("GET /api/v1/meta Endpoint", () => {
    it("returns dataset version, synthetic flags, counts, and database type", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/meta",
      });

      expect(res.statusCode).toBe(200);
      const meta = JSON.parse(res.body);

      // Dataset version
      expect(meta.dataset_version).toBeDefined();
      expect(typeof meta.dataset_version).toBe("string");

      // Synthetic flags
      expect(meta.synthetic_flags).toBeDefined();
      expect(typeof meta.synthetic_flags.has_synthetic_schemes).toBe("boolean");
      expect(typeof meta.synthetic_flags.synthetic_schemes_count).toBe("number");
      expect(meta.synthetic_flags.synthetic_schemes_count).toBe(0);
      expect(meta.synthetic_flags.has_synthetic_schemes).toBe(false);

      // Counts
      expect(meta.counts).toBeDefined();
      expect(meta.counts.curated_schemes).toBe(24);
      expect(meta.counts.imported_schemes).toBeGreaterThan(0);
      expect(meta.counts.total_schemes).toBe(meta.counts.curated_schemes + meta.counts.imported_schemes);

      // Environment & DB details
      expect(meta.db).toBeDefined();
      expect(meta.timestamp).toBeDefined();
    });

    it("correctly flags synthetic schemes when present in database", async () => {
      const synthSchemeId = "TEST_SYNTH_META_001";
      await db
        .insert(schema.schemes)
        .values({
          scheme_id: synthSchemeId,
          official_name: "Test Synthetic Meta Scheme",
          translated_names: { en: "Test Synthetic Meta Scheme" },
          level: "STATE",
          scheme_type: "WELFARE",
          overview: { objective: "Testing synthetic meta flag" },
          benefits: { benefit_type: "CASH", amount: 100 },
          raw: {},
          compiled_rules: {
            scheme_id: synthSchemeId,
            status: "ACTIVE",
            accepting_applications: "YES",
            hard_filters: {},
            rules: [],
            exclusions: [],
          },
          status: "ACTIVE",
          accepting_applications: "YES",
          source: "imported",
          verified: false,
          is_test: true, // Marked as synthetic benchmark/test scheme
          content_hash: "hash_test_synth_meta_001",
          version: 1,
        })
        .onConflictDoNothing();

      rulesCache.invalidate();

      try {
        const metaRes = await server.inject({
          method: "GET",
          url: "/api/v1/meta",
        });
        expect(metaRes.statusCode).toBe(200);
        const meta = JSON.parse(metaRes.body);

        expect(meta.synthetic_flags.has_synthetic_schemes).toBe(true);
        expect(meta.synthetic_flags.synthetic_schemes_count).toBeGreaterThanOrEqual(1);
      } finally {
        await db.delete(schema.schemes).where(eq(schema.schemes.scheme_id, synthSchemeId));
        rulesCache.invalidate();
      }
    });
  });
});
