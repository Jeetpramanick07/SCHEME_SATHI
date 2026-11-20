import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { buildServer } from "../src/server.js";
import { initDb, closeDb, db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import { detectSensitiveId, loadConsistencyRules, ConsistencyRulesFileSchema } from "../src/services/consistency.js";
import { eq, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";

describe("Backend Hardening Suite", () => {
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

  // 1. ROLES & AUTHORIZATION
  describe("Role Enforcement & Volunteer Self-Assertion Guard", () => {
    it("proves a citizen API key cannot self-assert volunteer role via headers", async () => {
      // 1. Create a claimed household
      const claimRes = await server.inject({
        method: "POST",
        url: "/api/v1/households/claim",
        headers: {
          "x-api-key": "citizen-secret-key",
        },
        payload: {
          answers: {
            age: 30,
            gender: "FEMALE",
          },
          consent: {
            data_processing: true,
            volunteer_assist: true,
          },
        },
      });
      expect(claimRes.statusCode).toBe(201);
      const hh = JSON.parse(claimRes.body);
      const householdId = hh.household_id;

      // 2. Citizen tries to self-assert volunteer authorization with X-Assisted-By and X-User-Role headers
      const unauthorizedPatch = await server.inject({
        method: "PATCH",
        url: `/api/v1/households/${householdId}/answers`,
        headers: {
          "x-api-key": "citizen-secret-key", // Citizen key!
          "x-user-role": "volunteer",         // Spoofed role header
          "x-assisted-by": "volunteer:fake_volunteer_99", // Spoofed assisted-by header
          "x-household-secret": hh.access_secret,
        },
        payload: {
          answers: {
            occupation: "ARTISAN",
          },
          source: "volunteer_confirmed", // Explicitly trying to record volunteer-confirmed
        },
      });

      // Must be rejected with 403 Forbidden
      expect(unauthorizedPatch.statusCode).toBe(403);
      const err = JSON.parse(unauthorizedPatch.body);
      expect(err.error.code).toBe("FORBIDDEN");

      // 3. Citizen submits without explicit source -> must be forced to citizen role / self_declared
      const normalPatch = await server.inject({
        method: "PATCH",
        url: `/api/v1/households/${householdId}/answers`,
        headers: {
          "x-api-key": "citizen-secret-key",
          "x-user-role": "volunteer", // Spoofed header must be ignored
          "x-assisted-by": "volunteer:fake_volunteer_99",
          "x-household-secret": hh.access_secret,
        },
        payload: {
          answers: {
            occupation: "FARMER",
          },
        },
      });
      expect(normalPatch.statusCode).toBe(200);

      // Verify DB row was recorded with source = self_declared and updated_by_role = citizen
      const rows = await db
        .select()
        .from(schema.memberAnswers)
        .where(eq(schema.memberAnswers.household_id, householdId));
      const occAns = rows.find((r) => r.attribute_key === "occupation");
      expect(occAns?.source).toBe("self_declared");
      expect(occAns?.updated_by_role).toBe("citizen"); // NOT volunteer!

      // 4. Valid volunteer API key DOES succeed when volunteer_assist consent exists
      const validVolunteerPatch = await server.inject({
        method: "PATCH",
        url: `/api/v1/households/${householdId}/answers`,
        headers: {
          "x-api-key": "volunteer-secret-key", // Real volunteer API key!
          "x-assisted-by": "volunteer:vol_accredited_01",
        },
        payload: {
          answers: {
            occupation: "WEAVER",
          },
        },
      });
      expect(validVolunteerPatch.statusCode).toBe(200);

      const updatedRows = await db
        .select()
        .from(schema.memberAnswers)
        .where(eq(schema.memberAnswers.household_id, householdId));
      const weaverAns = updatedRows.find((r) => r.attribute_key === "occupation");
      expect(weaverAns?.source).toBe("volunteer_confirmed");
      expect(weaverAns?.updated_by_role).toBe("volunteer");
    });
  });

  // 2. CONSISTENCY RULES FROM JSON (NO HARDCODED NUMBERS)
  describe("Consistency Rules Thresholds", () => {
    it("validates consistency-rules.json via Zod and loads thresholds without hardcoding", () => {
      const jsonPath = path.resolve(process.cwd(), "src/seed/consistency-rules.json");
      expect(fs.existsSync(jsonPath)).toBe(true);

      const content = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(content);
      const validated = ConsistencyRulesFileSchema.parse(parsed);

      expect(validated.length).toBeGreaterThanOrEqual(5);

      for (const rule of validated) {
        expect(rule.id).toBeDefined();
        expect(rule.code).toBeDefined();
        expect(rule.field).toBeDefined();
        expect(rule.message_key).toBeDefined();
        expect(typeof rule.needs_verification).toBe("boolean");
      }

      // Check rule thresholds from file
      const loaded = loadConsistencyRules();
      const incomeRule = loaded.find((r) => r.id === "income_vs_bpl");
      expect(incomeRule?.max_bpl_annual_income).toBe(150000);
      expect(incomeRule?.needs_verification).toBe(true);

      const landRule = loaded.find((r) => r.id === "landholding_vs_farmer_type");
      expect(landRule?.max_marginal_land_hectares).toBe(1.0);
      expect(landRule?.needs_verification).toBe(true);
    });
  });

  // 3. ID GUARD: FALSE POSITIVE VS TRUE POSITIVE TESTS
  describe("Sensitive ID Guard: False Positives vs True Positives", () => {
    it("avoids false positives on numeric answers and 10-digit phone strings", async () => {
      // False Positive 1: Number answer like income 200000000000 (12 digits, starts with 2)
      // Since it's a numeric answer, it must NOT be detected as Aadhaar
      const checkNumber = detectSensitiveId(200000000000);
      expect(checkNumber.detected).toBe(false);

      // False Positive 2: 10-digit phone number string
      const checkPhone = detectSensitiveId("9876543210");
      expect(checkPhone.detected).toBe(false);

      // False Positive 3: Normal text string containing numbers under 12 digits
      const checkIncomeText = detectSensitiveId("My monthly wage is 15000");
      expect(checkIncomeText.detected).toBe(false);

      // Prove that API accepts numeric income 200000000000 and 10-digit phone string without 422
      const claimRes = await server.inject({
        method: "POST",
        url: "/api/v1/households/claim",
        payload: {
          answers: {
            annual_family_income: 200000000000,
            contact_phone: "9876543210",
          },
        },
      });
      expect(claimRes.statusCode).toBe(201);
    });

    it("reliably detects true positive 12-digit Aadhaar and PAN strings", () => {
      // True positive Aadhaar with spaces
      expect(detectSensitiveId("5482 9102 3847").detected).toBe(true);
      expect(detectSensitiveId("5482 9102 3847").type).toBe("AADHAAR");

      // True positive Aadhaar continuous
      expect(detectSensitiveId("548291023847").detected).toBe(true);
      expect(detectSensitiveId("548291023847").type).toBe("AADHAAR");

      // True positive Aadhaar with hyphens
      expect(detectSensitiveId("5482-9102-3847").detected).toBe(true);

      // True positive PAN
      expect(detectSensitiveId("ABCDE1234F").detected).toBe(true);
      expect(detectSensitiveId("ABCDE1234F").type).toBe("PAN");

      // Embedded in text
      expect(detectSensitiveId("My number is 5482 9102 3847").detected).toBe(true);
      expect(detectSensitiveId("Card ABCDE1234F is attached").detected).toBe(true);
    });
  });

  // 4. DELETE CASCADE ACROSS EVERY TABLE
  describe("Delete Cascade Verification", () => {
    it("proves DELETE /households/:id removes rows in EVERY table referencing the household", async () => {
      // 1. Create household
      const testHhId = `hh_cascade_${Date.now()}`;
      const testSecret = `sec_cascade_${Date.now()}`;
      const testSecretHash = crypto.createHash("sha256").update(testSecret).digest("hex");
      await db.insert(schema.households).values({
        household_id: testHhId,
        state: "Maharashtra",
        district_id: "DIST_MH_NGP",
        contact_phone: "9876543210",
        access_secret_hash: testSecretHash,
      });

      // 2. Insert member
      const memberId = `mem_${testHhId}`;
      await db.insert(schema.householdMembers).values({
        member_id: memberId,
        household_id: testHhId,
        relation_to_head: "SELF",
      });

      // 3. Insert household document
      await db.insert(schema.householdDocuments).values({
        id: `doc_${testHhId}`,
        household_id: testHhId,
        member_id: memberId,
        document_id: "DOC_AADHAAR",
        status: "have",
      });

      // 4. Insert member answers
      await db.insert(schema.memberAnswers).values({
        household_id: testHhId,
        member_id: memberId,
        attribute_key: "age",
        value: 45,
        source: "self_declared",
      });

      // 5. Insert consent record
      await db.insert(schema.consentRecords).values({
        household_id: testHhId,
        purpose: "data_processing",
      });

      // 6. Insert declaration
      await db.insert(schema.declarations).values({
        household_id: testHhId,
      });

      // 7. Insert application
      const appId = `app_${testHhId}`;
      await db.insert(schema.applications).values({
        application_id: appId,
        household_id: testHhId,
        member_id: memberId,
        scheme_id: "CENT-MOHFW-ABPMJAY-001",
        status: "DRAFT",
      });

      // 8. Insert application step
      await db.insert(schema.applicationSteps).values({
        id: `step_${testHhId}`,
        application_id: appId,
        step_number: 1,
        title: "Initial Step",
        status: "PENDING",
      });

      // 9. Insert application audit event
      await db.insert(schema.applicationAuditEvents).values({
        application_id: appId,
        previous_status: null,
        new_status: "DRAFT",
        note: "Created",
      });

      // 10. Insert reminder
      await db.insert(schema.reminders).values({
        id: `rem_${testHhId}`,
        household_id: testHhId,
        member_id: memberId,
        type: "DOCUMENT_EXPIRING",
        title: "Test Reminder",
        message: "Your document is expiring",
      });

      // 11. Insert simulated SMS message
      await db.insert(schema.simulatedSmsMessages).values({
        id: `sms_${testHhId}`,
        household_id: testHhId,
        phone: "9876543210",
        message: "Test reminder notification",
        status: "simulated_delivered",
        provider: "simulated",
      });

      // Helper function to count rows in all tables for this household
      async function getRowCounts() {
        const hhRows = await db.select().from(schema.households).where(eq(schema.households.household_id, testHhId));
        const memRows = await db.select().from(schema.householdMembers).where(eq(schema.householdMembers.household_id, testHhId));
        const docRows = await db.select().from(schema.householdDocuments).where(eq(schema.householdDocuments.household_id, testHhId));
        const ansRows = await db.select().from(schema.memberAnswers).where(eq(schema.memberAnswers.household_id, testHhId));
        const conRows = await db.select().from(schema.consentRecords).where(eq(schema.consentRecords.household_id, testHhId));
        const decRows = await db.select().from(schema.declarations).where(eq(schema.declarations.household_id, testHhId));
        const appRows = await db.select().from(schema.applications).where(eq(schema.applications.household_id, testHhId));
        const stepRows = await db.select().from(schema.applicationSteps).where(eq(schema.applicationSteps.application_id, appId));
        const eventRows = await db.select().from(schema.applicationAuditEvents).where(eq(schema.applicationAuditEvents.application_id, appId));
        const remRows = await db.select().from(schema.reminders).where(eq(schema.reminders.household_id, testHhId));
        const smsRows = await db.select().from(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, testHhId));

        return {
          households: hhRows.length,
          contact_phone_exists: hhRows[0]?.contact_phone ? 1 : 0,
          household_members: memRows.length,
          household_documents: docRows.length,
          member_answers: ansRows.length,
          consent_records: conRows.length,
          declarations: decRows.length,
          applications: appRows.length,
          application_steps: stepRows.length,
          application_audit_events: eventRows.length,
          reminders: remRows.length,
          simulated_sms_messages: smsRows.length,
        };
      }

      // Check counts BEFORE delete: EVERY table must have at least 1 row
      const countsBefore = await getRowCounts();
      expect(countsBefore.households).toBe(1);
      expect(countsBefore.contact_phone_exists).toBe(1);
      expect(countsBefore.household_members).toBe(1);
      expect(countsBefore.household_documents).toBe(1);
      expect(countsBefore.member_answers).toBe(1);
      expect(countsBefore.consent_records).toBe(1);
      expect(countsBefore.declarations).toBe(1);
      expect(countsBefore.applications).toBe(1);
      expect(countsBefore.application_steps).toBe(1);
      expect(countsBefore.application_audit_events).toBe(1);
      expect(countsBefore.reminders).toBe(1);
      expect(countsBefore.simulated_sms_messages).toBe(1);

      // Execute DELETE /households/:id
      const delRes = await server.inject({
        method: "DELETE",
        url: `/api/v1/households/${testHhId}`,
        headers: {
          "x-household-secret": testSecret,
        },
      });
      expect(delRes.statusCode).toBe(200);

      // Check counts AFTER delete: EVERY table must have 0 rows (including contact_phone and simulated_sms_messages)
      const countsAfter = await getRowCounts();
      expect(countsAfter.households).toBe(0);
      expect(countsAfter.contact_phone_exists).toBe(0);
      expect(countsAfter.household_members).toBe(0);
      expect(countsAfter.household_documents).toBe(0);
      expect(countsAfter.member_answers).toBe(0);
      expect(countsAfter.consent_records).toBe(0);
      expect(countsAfter.declarations).toBe(0);
      expect(countsAfter.applications).toBe(0);
      expect(countsAfter.application_steps).toBe(0);
      expect(countsAfter.application_audit_events).toBe(0);
      expect(countsAfter.reminders).toBe(0);
      expect(countsAfter.simulated_sms_messages).toBe(0);
    });
  });

  // 5. QUALITY GATE & EXPLORE TIER
  describe("Quality Gate & False Positive Prevention", () => {
    it("ensures unverified/imported schemes never appear in can_apply or likely_confirm", async () => {
      // Evaluate partial profile for 62yo widowed woman
      const evalResDefault = await server.inject({
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
              member_id: "mem_qg_test",
              age: 62,
              gender: "FEMALE",
              marital_status: "WIDOW",
              answers: {},
            },
          ],
          include_all: true,
          include_explore: false,
        },
      });

      expect(evalResDefault.statusCode).toBe(200);
      const defaultData = JSON.parse(evalResDefault.body);
      const defaultMemberResult = defaultData.results[0];

      // With quality gate, unverified schemes are blocked from can_apply and likely_confirm
      expect(defaultMemberResult.tiers.can_apply.length).toBe(0);
      expect(defaultMemberResult.tiers.explore).toEqual([]);

      // All can_apply schemes must be curated or verified AND have evaluated mandatory rules
      for (const s of defaultMemberResult.tiers.can_apply) {
        expect(s.is_curated).toBe(true);
        expect(s.mandatory_rules_evaluated_count).toBeGreaterThanOrEqual(1);
      }

      // Re-evaluate with include_explore: true
      const evalResExplore = await server.inject({
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
              member_id: "mem_qg_test_explore",
              age: 62,
              gender: "FEMALE",
              marital_status: "WIDOW",
              answers: {},
            },
          ],
          include_all: true,
          include_explore: true,
        },
      });

      expect(evalResExplore.statusCode).toBe(200);
      const exploreData = JSON.parse(evalResExplore.body);
      const exploreMemberResult = exploreData.results[0];

      // Explore bucket must be populated and capped at 20
      expect(exploreMemberResult.tiers.explore.length).toBeGreaterThan(0);
      expect(exploreMemberResult.tiers.explore.length).toBeLessThanOrEqual(20);

      // Verify each explore scheme is NOT labelled eligible and has explore status/tier
      for (const expScheme of exploreMemberResult.tiers.explore) {
        expect(expScheme.tier).toBe("explore");
        expect(expScheme.status).toBe("EXPLORE");
        expect(expScheme.can_apply).toBe(false);
        expect(expScheme.reasons.en[0]).toBe("Rules not verified, check with the office");
      }
    });
  });

  // 6. ANSWER KEYS NORMALIZATION (Canonical vs Baked-Operator Aliases)
  describe("Answer Keys Normalization", () => {
    it("accepts canonical keys without warnings and normalizes baked-operator aliases with warning", async () => {
      // Create household
      const claimRes = await server.inject({
        method: "POST",
        url: "/api/v1/households/claim",
        payload: {
          answers: { age: 45, gender: "FEMALE" },
          consent: { data_processing: true },
        },
      });
      const hh = JSON.parse(claimRes.body);
      const hhId = hh.household_id;

      // 1. PATCH with canonical key
      const canonicalPatch = await server.inject({
        method: "PATCH",
        url: `/api/v1/households/${hhId}/answers`,
        headers: {
          "x-api-key": "citizen-secret-key",
          "x-household-secret": hh.access_secret,
        },
        payload: {
          answers: {
            years_in_maharashtra: 20,
          },
        },
      });
      expect(canonicalPatch.statusCode).toBe(200);
      const canonicalBody = JSON.parse(canonicalPatch.body);
      expect(canonicalBody.updated_keys).toContain("years_in_maharashtra");
      const aliasWarn1 = canonicalBody.warnings.find((w: { code: string }) => w.code === "DEPRECATED_ALIAS_NORMALIZED");
      expect(aliasWarn1).toBeUndefined();

      // 2. PATCH with baked-operator alias
      const aliasPatch = await server.inject({
        method: "PATCH",
        url: `/api/v1/households/${hhId}/answers`,
        headers: {
          "x-api-key": "citizen-secret-key",
          "x-household-secret": hh.access_secret,
        },
        payload: {
          answers: {
            years_in_maharashtra_gte: 25,
          },
        },
      });
      expect(aliasPatch.statusCode).toBe(200);
      const aliasBody = JSON.parse(aliasPatch.body);
      expect(aliasBody.updated_keys).toContain("years_in_maharashtra");
      const aliasWarn2 = aliasBody.warnings.find((w: { code: string }) => w.code === "DEPRECATED_ALIAS_NORMALIZED");
      expect(aliasWarn2).toBeDefined();
      expect(aliasWarn2.attribute).toBe("years_in_maharashtra_gte");
      expect(aliasWarn2.message).toContain("deprecated baked-operator alias");
    });
  });

  // 7. BENCH DATA ISOLATION (is_test schemes never leak)
  describe("Bench Data Isolation", () => {
    it("ensures is_test schemes never appear in catalogue, facets, eligibility or admin counts", async () => {
      // Insert a synthetic test scheme directly into DB
      const testSchemeId = "TEST_SYNTH_LEAK_001";
      await db.insert(schema.schemes).values({
        scheme_id: testSchemeId,
        official_name: "Test Leak Scheme (Synthetic)",
        translated_names: { en: "Test Leak Scheme (Synthetic)" },
        level: "STATE",
        scheme_type: "WELFARE",
        implementing_state: "Maharashtra",
        overview: { objective: "Testing isolation", simple_explanation: { en: "Isolation test" } },
        benefits: { benefit_type: "CASH", amount: 1000 },
        raw: {},
        compiled_rules: {
          scheme_id: testSchemeId,
          status: "ACTIVE",
          accepting_applications: "YES",
          hard_filters: { states: ["Maharashtra"] },
          rules: [],
          exclusions: [],
        },
        status: "ACTIVE",
        accepting_applications: "YES",
        content_hash: "hash_test_leak_001",
        version: 1,
        is_test: true,
      }).onConflictDoNothing();

      // Invalidate cache to force reload
      const { rulesCache } = await import("../src/services/cache.js");
      rulesCache.invalidate();

      try {
        // 1. Catalogue Listing / Search
        const catRes = await server.inject({
          method: "GET",
          url: "/api/v1/schemes?limit=100",
        });
        expect(catRes.statusCode).toBe(200);
        const catData = JSON.parse(catRes.body);
        const inCatalogue = (catData.items || []).some((s: { scheme_id: string }) => s.scheme_id === testSchemeId);
        expect(inCatalogue).toBe(false);

        // 2. Catalogue Facets
        const facetsRes = await server.inject({
          method: "GET",
          url: "/api/v1/schemes/facets",
        });
        expect(facetsRes.statusCode).toBe(200);

        // 3. Eligibility Evaluation
        const evalRes = await server.inject({
          method: "POST",
          url: "/api/v1/eligibility/evaluate",
          payload: {
            household: { district_id: "DIST_MH_NGP", state: "Maharashtra" },
            members: [{ member_id: "mem_iso_test", age: 30, gender: "FEMALE" }],
            include_all: true,
          },
        });
        expect(evalRes.statusCode).toBe(200);
        const evalData = JSON.parse(evalRes.body);
        const allEvalIds = [
          ...evalData.results[0].eligible,
          ...evalData.results[0].likely,
          ...evalData.results[0].unknown,
          ...evalData.results[0].not_eligible,
        ].map((s: { scheme_id: string }) => s.scheme_id);
        expect(allEvalIds).not.toContain(testSchemeId);

        // 4. Admin Pending Reviews Count
        const adminRes = await server.inject({
          method: "GET",
          url: "/api/v1/admin/pending-reviews",
          headers: {
            "x-api-key": "admin-secret-key",
          },
        });
        expect(adminRes.statusCode).toBe(200);
        const adminData = JSON.parse(adminRes.body);
        const inAdminPending = adminData.pending_schemes_translations.some(
          (s: { scheme_id: string }) => s.scheme_id === testSchemeId
        );
        expect(inAdminPending).toBe(false);
      } finally {
        // Cleanup test row
        await db.delete(schema.schemes).where(eq(schema.schemes.scheme_id, testSchemeId));
        rulesCache.invalidate();
      }
    });
  });
});
