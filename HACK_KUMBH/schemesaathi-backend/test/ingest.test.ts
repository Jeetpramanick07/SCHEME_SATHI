import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, db } from "../src/db/index.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import * as schema from "../src/db/schema.js";
import { eq } from "drizzle-orm";

describe("Ingestion Pipeline", () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("loads sample file, reports dangling parent warning, and verifies idempotency", async () => {
    const report1 = await IngestionPipeline.ingest("data/government_welfare_schemes.json");
    expect(report1.total_schemes).toBe(24);
    expect(report1.rejected_count).toBe(0);

    // Verify dangling parent warning exists in issues
    const danglingWarning = report1.issues.find(
      (i) => i.code === "DANGLING_PARENT_SCHEME" && i.scheme_id === "LOCAL-GAD-PMAYG-ENHANCED-020"
    );
    expect(danglingWarning).toBeDefined();

    // Idempotent re-run: must skip all 24 schemes
    const report2 = await IngestionPipeline.ingest("data/government_welfare_schemes.json");
    expect(report2.total_schemes).toBe(24);
    expect(report2.accepted_count).toBe(0);
    expect(report2.skipped_count).toBe(24);
  });

  it("rejects an invalid scheme with a report while allowing valid schemes to load", async () => {
    const uniqueId = `VALID_TEST_${Date.now()}`;
    const mixedBundle = {
      schemes: [
        {
          scheme_id: uniqueId,
          official_name: "Valid Scheme For Testing",
          translated_names: { en: "Valid Scheme For Testing" },
          scheme_classification: { level: "STATE", scheme_type: "WELFARE" },
          overview: { simple_explanation: { en: "Test scheme overview" } },
          benefits: { benefit_type: "SUBSIDY" },
          eligibility: { rules: [] },
          operational_status: { status: "ACTIVE", accepting_applications: "YES" },
        },
        {
          // Missing official_name & translated_names
          scheme_id: "INVALID_TEST_002",
        },
      ],
    };

    const report = await IngestionPipeline.ingest(mixedBundle);
    expect(report.total_schemes).toBe(2);
    expect(report.accepted_count).toBe(1);
    expect(report.rejected_count).toBe(1);

    const rejection = report.issues.find((i) => i.scheme_id === "INVALID_TEST_002" && i.severity === "error");
    expect(rejection).toBeDefined();

    // Clean up test scheme
    await db.delete(schema.schemes).where(eq(schema.schemes.scheme_id, uniqueId));
    await db.delete(schema.schemeVersions).where(eq(schema.schemeVersions.scheme_id, uniqueId));
  });
});
