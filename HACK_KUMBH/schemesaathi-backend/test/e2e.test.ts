import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { initDb, closeDb } from "../src/db/index.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import { FastifyInstance } from "fastify";

describe("API End-to-End Workflow", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    // Seed initial data
    await IngestionPipeline.ingest("data/government_welfare_schemes.json");
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  it("completes full end-to-end user journey", async () => {
    // 1. Health check
    const healthRes = await server.inject({
      method: "GET",
      url: "/health",
    });
    expect(healthRes.statusCode).toBe(200);
    const health = JSON.parse(healthRes.body);
    expect(health.status).toBe("ok");
    expect(health.active_schemes_count).toBeGreaterThanOrEqual(24);

    // 2. Stateless Evaluation for 62yo widowed woman in Nagpur with Marathi output
    const evalRes = await server.inject({
      method: "POST",
      url: "/api/v1/eligibility/evaluate",
      payload: {
        household: {
          state: "Maharashtra",
          district_id: "DIST_MH_NGP",
          taluka: "Nagpur Urban",
          annual_family_income: 150000,
        },
        members: [
          {
            member_id: "mem_widow_62",
            relation_to_head: "SELF",
            age: 62,
            gender: "FEMALE",
            occupation: "ARTISAN",
            caste_category: "OBC",
            marital_status: "WIDOW",
            answers: {
              is_widow: true,
              residence_state: "Maharashtra",
            },
          },
        ],
        lang: "mr",
      },
    });

    expect(evalRes.statusCode).toBe(200);
    const evalData = JSON.parse(evalRes.body);
    expect(evalData.language).toBe("mr");
    expect(evalData.results.length).toBe(1);
    const memberResults = evalData.results[0];
    expect(memberResults.member_id).toBe("mem_widow_62");
    // Verify results exist in eligible or unknown
    const totalConsidered = memberResults.eligible.length + memberResults.unknown.length;
    expect(totalConsidered).toBeGreaterThan(0);

    // 3. Adaptive Next-Questions Ranking
    const questionsRes = await server.inject({
      method: "POST",
      url: "/api/v1/eligibility/next-questions",
      payload: {
        subject: {
          age: 62,
          gender: "FEMALE",
          marital_status: "WIDOW",
        },
        household: {
          state: "Maharashtra",
          district_id: "DIST_MH_NGP",
        },
        limit: 5,
        lang: "mr",
      },
    });

    expect(questionsRes.statusCode).toBe(200);
    const questions = JSON.parse(questionsRes.body);
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0].attribute_key).toBeDefined();
    expect(questions[0].impact_score).toBeGreaterThan(0);

    // 4. Create Household & Member
    const hhRes = await server.inject({
      method: "POST",
      url: "/api/v1/households",
      payload: {
        consent_given: true,
        district_id: "DIST_MH_NGP",
        taluka: "Nagpur Urban",
        state: "Maharashtra",
      },
    });
    expect(hhRes.statusCode).toBe(201);
    const hh = JSON.parse(hhRes.body);
    const householdId = hh.household_id;
    const accessSecret = hh.access_secret;

    const memRes = await server.inject({
      method: "POST",
      url: `/api/v1/households/${householdId}/members`,
      headers: {
        "x-household-secret": accessSecret,
      },
      payload: {
        relation_to_head: "SELF",
        age: 62,
        gender: "FEMALE",
        occupation: "ARTISAN",
        marital_status: "WIDOW",
        answers: { is_widow: true },
      },
    });
    expect(memRes.statusCode).toBe(201);
    const mem = JSON.parse(memRes.body);
    const memberId = mem.member_id;

    // 5. Scheme Document Checklist
    const checklistRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/schemes/CENT-MOAFW-PMKISAN-001/checklist?member_id=${memberId}&lang=en`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(checklistRes.statusCode).toBe(200);
    const checklist = JSON.parse(checklistRes.body);
    expect(checklist.scheme_id).toBe("CENT-MOAFW-PMKISAN-001");
    expect(Array.isArray(checklist.documents)).toBe(true);

    // 6. Deduplicated Document Plan
    const docPlanRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/document-plan?lang=en`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(docPlanRes.statusCode).toBe(200);
    const docPlan = JSON.parse(docPlanRes.body);
    expect(docPlan.household_id).toBe(householdId);
    expect(Array.isArray(docPlan.document_plan)).toBe(true);

    // 7. Create Scheme Application
    const appRes = await server.inject({
      method: "POST",
      url: "/api/v1/applications",
      payload: {
        household_id: householdId,
        member_id: memberId,
        scheme_id: "CENT-MOAFW-PMKISAN-001",
        reference_no: "MH/NGP/2026/88921",
      },
    });
    expect(appRes.statusCode).toBe(201);
    const app = JSON.parse(appRes.body);
    const applicationId = app.application_id;
    expect(app.status).toBe("DRAFT");
    expect(app.steps.length).toBeGreaterThan(0);

    // 8. Application Status Transition & Audit Event
    const patchRes = await server.inject({
      method: "PATCH",
      url: `/api/v1/applications/${applicationId}/status`,
      payload: {
        status: "SUBMITTED",
        note: "Documents uploaded and Aadhaar biometric e-KYC completed at CSC Center",
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patchedApp = JSON.parse(patchRes.body);
    expect(patchedApp.status).toBe("SUBMITTED");
    expect(patchedApp.audit_events.length).toBeGreaterThanOrEqual(2);
    expect(patchedApp.audit_events[0].new_status).toBe("SUBMITTED");

    // 9. Document Expiry & Generated Reminders
    await server.inject({
      method: "PUT",
      url: `/api/v1/households/${householdId}/documents/DOC_001`,
      headers: {
        "x-household-secret": accessSecret,
      },
      payload: {
        member_id: memberId,
        status: "expired",
      },
    });

    const remindersRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/reminders?lang=mr`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(remindersRes.statusCode).toBe(200);
    const reminders = JSON.parse(remindersRes.body);
    expect(Array.isArray(reminders)).toBe(true);
    expect(reminders.some((r: { type: string }) => r.type === "DOCUMENT_EXPIRING")).toBe(true);
  });
});
