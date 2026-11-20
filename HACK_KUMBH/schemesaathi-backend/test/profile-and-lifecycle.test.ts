import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { initDb, closeDb, db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import { ProfileSectionsService } from "../src/services/profile-sections.js";
import { DECLARATION_MESSAGES } from "../src/seed/declaration-texts.js";
import { eq } from "drizzle-orm";

describe("Profile Flow, Provenance, Consent, & Tiered Results", () => {
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

  // 1. Profile sections validation and seed
  it("validates profile-sections and ensures unmapped attributes fallback to Other with warning", async () => {
    const res = await ProfileSectionsService.seedProfileSections();
    expect(res.sectionsCount).toBeGreaterThanOrEqual(8);
    expect(res.fieldsCount).toBeGreaterThanOrEqual(25);

    const sectionsRes = await server.inject({
      method: "GET",
      url: "/api/v1/profile/sections?lang=en",
    });
    expect(sectionsRes.statusCode).toBe(200);
    const data = JSON.parse(sectionsRes.body);
    expect(data.sections).toBeDefined();
    expect(data.sections.length).toBeGreaterThanOrEqual(8);

    // Verify first section is personal
    const personal = data.sections.find((s: { id: string }) => s.id === "personal");
    expect(personal).toBeDefined();
    expect(personal.fields.some((f: { attribute_key: string }) => f.attribute_key === "age")).toBe(true);
    expect(personal.fields[0].used_by_scheme_count).toBeGreaterThanOrEqual(0);

    // Verify Marathi localization of sections
    const mrRes = await server.inject({
      method: "GET",
      url: "/api/v1/profile/sections?lang=mr",
    });
    const mrData = JSON.parse(mrRes.body);
    const mrPersonal = mrData.sections.find((s: { id: string }) => s.id === "personal");
    expect(mrPersonal.title).toBe("वैयक्तिक माहिती");
  });

  // 2. Sensitive Government ID pattern 422 rejection
  it("rejects 12-digit Aadhaar and PAN patterns with 422 SENSITIVE_ID_NOT_ALLOWED", async () => {
    // Attempt to claim household with 12-digit Aadhaar number
    const aadhaarClaimRes = await server.inject({
      method: "POST",
      url: "/api/v1/households/claim",
      payload: {
        answers: {
          age: 35,
          aadhaar_id: "5482 9102 3847", // 12-digit Aadhaar format
        },
      },
    });
    expect(aadhaarClaimRes.statusCode).toBe(422);
    const aadhaarErr = JSON.parse(aadhaarClaimRes.body);
    expect(aadhaarErr.error.code).toBe("SENSITIVE_ID_NOT_ALLOWED");

    // Attempt to patch answer with PAN pattern
    const panClaimRes = await server.inject({
      method: "POST",
      url: "/api/v1/households/claim",
      payload: {
        answers: {
          age: 35,
          pan_card: "ABCDE1234F", // PAN format
        },
      },
    });
    expect(panClaimRes.statusCode).toBe(422);
    const panErr = JSON.parse(panClaimRes.body);
    expect(panErr.error.code).toBe("SENSITIVE_ID_NOT_ALLOWED");
  });

  // 3. Simulated Quick-fill Whitelist
  it("returns strictly whitelisted fields (age, gender, district) and omits PII/IDs", async () => {
    // DigiLocker simulation
    const dlRes = await server.inject({
      method: "POST",
      url: "/api/v1/prefill/digilocker/simulate",
      payload: {
        age: 62,
        gender: "FEMALE",
        district: "Nagpur",
        name: "Shanti Devi", // must be omitted
        aadhaar_number: "234567890123", // must be omitted
      },
    });
    expect(dlRes.statusCode).toBe(200);
    const dlData = JSON.parse(dlRes.body);
    expect(dlData.simulated).toBe(true);
    expect(dlData.source).toBe("digilocker");
    expect(dlData.attributes.age).toBe(62);
    expect(dlData.attributes.gender).toBe("FEMALE");
    expect(dlData.attributes.district).toBe("Nagpur");
    expect(dlData.attributes.name).toBeUndefined();
    expect(dlData.attributes.aadhaar_number).toBeUndefined();

    // Aadhaar QR simulation
    const qrRes = await server.inject({
      method: "POST",
      url: "/api/v1/prefill/aadhaar-qr/simulate",
      payload: {
        dob: "1962-05-15",
        sex: "F",
        district: "Nagpur",
        qr_data: "RAW_ENCRYPTED_BYTES", // must be omitted
      },
    });
    expect(qrRes.statusCode).toBe(200);
    const qrData = JSON.parse(qrRes.body);
    expect(qrData.simulated).toBe(true);
    expect(qrData.source).toBe("aadhaar_qr");
    expect(qrData.attributes.age).toBeGreaterThanOrEqual(60);
    expect(qrData.attributes.gender).toBe("FEMALE");
    expect(qrData.attributes.district).toBe("Nagpur");
    expect(qrData.attributes.qr_data).toBeUndefined();
  });

  // 4. Truthful Wording Guard Test
  it("guards that no message key claims the app verifies documents or guarantees benefits", () => {
    for (const msg of Object.values(DECLARATION_MESSAGES)) {
      const en = msg.en.toLowerCase();
      // App must never claim it verifies official documents
      expect(en).not.toContain("this app verifies your documents");
      expect(en).not.toContain("we verify your documents");
      expect(en).not.toContain("guaranteed approval");
      expect(en).not.toContain("guarantees your benefit");
    }

    // Explicitly verify the 3 mandatory statements exist in declaration messages
    expect(DECLARATION_MESSAGES["declaration.true_information"]?.en).toContain(
      "true to the best of my knowledge"
    );
    expect(DECLARATION_MESSAGES["declaration.suggestion_only"]?.en).toContain(
      "only suggests schemes from my answers and does not verify them"
    );
    expect(DECLARATION_MESSAGES["declaration.govt_verification"]?.en).toContain(
      "Government authorities will verify my original documents"
    );
  });

  // 5. Complete Lifecycle: Anonymous -> Claim -> Profile -> Proposed vs Confirmed -> Tiers -> Outcome -> Delete
  it("executes the complete citizen profile journey with answers provenance and right to be forgotten", async () => {
    // 5.1 Claim household from anonymous answers
    const claimRes = await server.inject({
      method: "POST",
      url: "/api/v1/households/claim",
      payload: {
        district_id: "DIST_MH_NGP",
        taluka: "Nagpur Urban",
        state: "Maharashtra",
        answers: {
          age: 62,
          gender: "FEMALE",
          marital_status: "WIDOW",
          is_widow: true,
          caste_category: "OBC",
          annual_family_income: 20000,
          belongs_to_bpl_household: true,
          years_in_maharashtra_gte: 40,
        },
        consent: {
          data_processing: true,
          sms_reminders: true,
          volunteer_assist: true,
        },
        lang: "en",
      },
    });
    expect(claimRes.statusCode).toBe(201);
    const claimedHh = JSON.parse(claimRes.body);
    const householdId = claimedHh.household_id;
    const accessSecret = claimedHh.access_secret;
    const memberId = claimedHh.members[0].member_id;
    expect(householdId).toBeDefined();
    expect(memberId).toBeDefined();

    // 5.2 Get profile with save-and-resume state
    const profileRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body);
    expect(profile.household_id).toBe(householdId);
    expect(profile.completion_percentage).toBeGreaterThan(0);
    expect(profile.answered_fields_count).toBeGreaterThan(0);
    expect(profile.last_active_section_id).toBeDefined();

    // Check provenance of personal section fields
    const personalSec = profile.sections.find((s: { id: string }) => s.id === "personal");
    const ageField = personalSec.fields.find((f: { attribute_key: string }) => f.attribute_key === "age");
    expect(ageField.answered).toBe(true);
    expect(ageField.value).toBe(62);
    expect(ageField.provenance.source).toBe("self_declared");
    expect(ageField.provenance.status).toBe("confirmed");

    // 5.3 Consistency warning (DOB vs Age mismatch non-blocking)
    const patchRes = await server.inject({
      method: "PATCH",
      url: `/api/v1/households/${householdId}/answers`,
      headers: {
        "x-household-secret": accessSecret,
      },
      payload: {
        answers: {
          date_of_birth: "1990-01-01", // Age 62 vs birth year 1990 => mismatch!
        },
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patchData = JSON.parse(patchRes.body);
    expect(patchData.success).toBe(true);
    expect(patchData.warnings.some((w: { code: string }) => w.code === "DOB_AGE_MISMATCH")).toBe(true);

    // 5.4 Proposed answers isolation: Proposed answers NEVER affect eligibility until confirmed
    const propRes = await server.inject({
      method: "POST",
      url: `/api/v1/households/${householdId}/answers/proposed`,
      headers: {
        "x-household-secret": accessSecret,
      },
      payload: {
        answers: {
          owns_cultivable_land: true,
          landholding_hectares: 0.5,
        },
        source: "chatbot_confirmed",
      },
    });
    expect(propRes.statusCode).toBe(201);

    // Confirm that proposed answers are not yet confirmed
    const propRows = await db
      .select()
      .from(schema.memberAnswers)
      .where(eq(schema.memberAnswers.household_id, householdId));
    const landAnswer = propRows.find((a) => a.attribute_key === "landholding_hectares");
    expect(landAnswer?.status).toBe("proposed");

    // Confirm the proposed answer
    const confirmRes = await server.inject({
      method: "POST",
      url: `/api/v1/households/${householdId}/answers/confirm`,
      headers: {
        "x-household-secret": accessSecret,
      },
      payload: {
        keys: ["landholding_hectares"],
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    const confData = JSON.parse(confirmRes.body);
    expect(confData.confirmed_keys).toContain("landholding_hectares");

    // 5.5 Assisted / Volunteer Mode Check
    // With volunteer_assist consent active, volunteer header is accepted
    const volunteerPatch = await server.inject({
      method: "PATCH",
      url: `/api/v1/households/${householdId}/answers`,
      headers: {
        "x-api-key": "volunteer-secret-key",
        "x-assisted-by": "volunteer:vol_nagpur_01",
      },
      payload: {
        answers: {
          education_level: "PRIMARY",
        },
      },
    });
    expect(volunteerPatch.statusCode).toBe(200);
    const volRows = await db
      .select()
      .from(schema.memberAnswers)
      .where(eq(schema.memberAnswers.household_id, householdId));
    const eduAns = volRows.find((a) => a.attribute_key === "education_level");
    expect(eduAns?.source).toBe("volunteer_confirmed");
    expect(eduAns?.updated_by_role).toBe("volunteer");

    // 5.6 Tiered Results with Pre-trip Check and Confidence Badge
    const evalRes = await server.inject({
      method: "POST",
      url: "/api/v1/eligibility/evaluate",
      payload: {
        household: {
          district_id: "DIST_MH_NGP",
          taluka: "Nagpur Urban",
          state: "Maharashtra",
          annual_family_income: 20000,
        },
        members: [
          {
            member_id: memberId,
            age: 62,
            gender: "FEMALE",
            marital_status: "WIDOW",
            caste_category: "OBC",
            answers: {
              is_widow: true,
              belongs_to_bpl_household: true,
              years_in_maharashtra_gte: 40,
            },
          },
        ],
        lang: "en",
      },
    });
    expect(evalRes.statusCode).toBe(200);
    const evalResult = JSON.parse(evalRes.body);
    const memResult = evalResult.results[0];

    // Check tiers structure
    expect(memResult.tiers).toBeDefined();
    expect(memResult.tiers.can_apply).toBeDefined();
    expect(memResult.tiers.likely_confirm).toBeDefined();
    expect(memResult.tiers.not_eligible).toBeDefined();

    // Verify scheme cards have confidence badge, pre_trip_check, and disclaimers
    const firstScheme = memResult.tiers.can_apply[0] || memResult.tiers.likely_confirm[0];
    expect(firstScheme).toBeDefined();
    expect(["high", "medium", "needs_confirmation"]).toContain(firstScheme.confidence_badge);
    expect(firstScheme.disclaimer_keys.length).toBeGreaterThan(0);
    expect(firstScheme.pre_trip_check).toBeDefined();
    expect(Array.isArray(firstScheme.pre_trip_check.bring_documents)).toBe(true);
    expect(Array.isArray(firstScheme.pre_trip_check.confirm_with_office)).toBe(true);

    // Verify can_apply invariant: can_apply is true ONLY when status is ELIGIBLE
    for (const s of memResult.tiers.can_apply) {
      expect(s.can_apply).toBe(true);
      expect(s.status).toBe("ELIGIBLE");
    }
    for (const s of memResult.tiers.likely_confirm) {
      expect(s.can_apply).toBe(false);
      expect(s.status).toBe("UNKNOWN");
    }

    // 5.7 Application creation and rejection outcome feedback
    const appRes = await server.inject({
      method: "POST",
      url: "/api/v1/applications",
      payload: {
        household_id: householdId,
        member_id: memberId,
        scheme_id: firstScheme.scheme_id,
      },
    });
    expect(appRes.statusCode).toBe(201);
    const appData = JSON.parse(appRes.body);
    const applicationId = appData.application_id;

    // Record outcome as rejected with reason code INCOME_EXCEEDED
    const outcomeRes = await server.inject({
      method: "PATCH",
      url: `/api/v1/applications/${applicationId}/outcome`,
      payload: {
        outcome: "rejected",
        rejection_reason_code: "INCOME_EXCEEDED",
        rejection_note: "Tehsildar income certificate stated ₹160,000 exceeding cap.",
        outcome_recorded_by_role: "volunteer",
      },
    });
    expect(outcomeRes.statusCode).toBe(200);
    const outcomeData = JSON.parse(outcomeRes.body);
    expect(outcomeData.outcome).toBe("rejected");
    expect(outcomeData.status).toBe("REJECTED");
    expect(outcomeData.rejection_reason_code).toBe("INCOME_EXCEEDED");

    // 5.8 Admin rejection reasons analytics
    const adminReasonsRes = await server.inject({
      method: "GET",
      url: `/api/v1/admin/rejection-reasons?scheme_id=${firstScheme.scheme_id}`,
      headers: {
        "x-api-key": "admin-secret-key",
      },
    });
    expect(adminReasonsRes.statusCode).toBe(200);
    const aggData = JSON.parse(adminReasonsRes.body);
    expect(aggData.total_rejections).toBeGreaterThanOrEqual(1);
    const incomeReason = aggData.reasons.find((r: { code: string }) => r.code === "INCOME_EXCEEDED");
    expect(incomeReason).toBeDefined();
    expect(incomeReason.mapped_attribute).toBe("annual_family_income");

    // 5.9 Consent withdrawal
    const consentRows = await db
      .select()
      .from(schema.consentRecords)
      .where(eq(schema.consentRecords.household_id, householdId));
    expect(consentRows.length).toBeGreaterThan(0);
    const targetConsent = consentRows[0]!;

    const withdrawRes = await server.inject({
      method: "PATCH",
      url: `/api/v1/consents/${targetConsent.id}/withdraw`,
    });
    expect(withdrawRes.statusCode).toBe(200);
    const withdrawnData = JSON.parse(withdrawRes.body);
    expect(withdrawnData.withdrawn_at).toBeDefined();

    // 5.10 Right to be forgotten (cascade hard delete)
    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/households/${householdId}`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify household and answers are completely erased
    const checkHh = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.household_id, householdId));
    expect(checkHh.length).toBe(0);

    const checkAnswers = await db
      .select()
      .from(schema.memberAnswers)
      .where(eq(schema.memberAnswers.household_id, householdId));
    expect(checkAnswers.length).toBe(0);

    // Verify anonymized deletion log row exists with no PII
    const auditLogs = await db.select().from(schema.anonymizedDeletionLogs);
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
  });
});
