import { initDb, closeDb, db } from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import * as schema from "../db/schema.js";
import { eq, or, like } from "drizzle-orm";
import crypto from "crypto";

export interface SeedDemoNgoResult {
  reset: boolean;
  households_count: number;
  members_count: number;
  applications_count: number;
  outcomes: {
    approved: number;
    rejected: number;
    pending: number;
    stuck: number;
  };
  rejection_reasons: Record<string, number>;
  districts: string[];
  district_counts?: Record<string, number>;
}

export async function clearSyntheticDemoData(): Promise<number> {
  const synthHouseholds = await db
    .select({ id: schema.households.household_id })
    .from(schema.households)
    .where(or(eq(schema.households.is_synthetic, true), like(schema.households.household_id, "hh_synth_%")));

  const hhIds = synthHouseholds.map((h) => h.id);
  if (hhIds.length === 0) return 0;

  // Clean in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < hhIds.length; i += chunkSize) {
    const chunk = hhIds.slice(i, i + chunkSize);

    for (const hhId of chunk) {
      const apps = await db
        .select({ id: schema.applications.application_id })
        .from(schema.applications)
        .where(eq(schema.applications.household_id, hhId));

      for (const app of apps) {
        await db.delete(schema.applicationAuditEvents).where(eq(schema.applicationAuditEvents.application_id, app.id));
        await db.delete(schema.applicationSteps).where(eq(schema.applicationSteps.application_id, app.id));
      }

      await db.delete(schema.applications).where(eq(schema.applications.household_id, hhId));
      await db.delete(schema.memberAnswers).where(eq(schema.memberAnswers.household_id, hhId));
      await db.delete(schema.householdDocuments).where(eq(schema.householdDocuments.household_id, hhId));
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, hhId));
      await db.delete(schema.declarations).where(eq(schema.declarations.household_id, hhId));
      await db.delete(schema.reminders).where(eq(schema.reminders.household_id, hhId));
      await db.delete(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, hhId));
      await db.delete(schema.householdMembers).where(eq(schema.householdMembers.household_id, hhId));
      await db.delete(schema.households).where(eq(schema.households.household_id, hhId));
    }
  }

  // Also clean any orphan synthetic apps
  const orphanSynthApps = await db
    .select({ id: schema.applications.application_id })
    .from(schema.applications)
    .where(or(eq(schema.applications.is_synthetic, true), like(schema.applications.application_id, "app_synth_%")));

  for (const oApp of orphanSynthApps) {
    await db.delete(schema.applicationAuditEvents).where(eq(schema.applicationAuditEvents.application_id, oApp.id));
    await db.delete(schema.applicationSteps).where(eq(schema.applicationSteps.application_id, oApp.id));
    await db.delete(schema.applications).where(eq(schema.applications.application_id, oApp.id));
  }

  return hhIds.length;
}

// 8 Vidarbha districts with realistic uptake skew (~300 households total)
const DISTRICT_TARGETS: Array<{ district_id: string; name: string; count: number; talukas: string[] }> = [
  { district_id: "DIST_MH_NGP", name: "Nagpur", count: 80, talukas: ["Nagpur Urban", "Nagpur Rural", "Kamptee", "Hingna", "Katol", "Saoner", "Umred"] },
  { district_id: "DIST_MH_AMR", name: "Amravati", count: 45, talukas: ["Amravati", "Achalpur", "Morshi", "Warud", "Chandur Bazar"] },
  { district_id: "DIST_MH_CHA", name: "Chandrapur", count: 40, talukas: ["Chandrapur", "Warora", "Ballarpur", "Bhadravati", "Rajura"] },
  { district_id: "DIST_MH_WRD", name: "Wardha", count: 35, talukas: ["Wardha", "Deoli", "Hinganghat", "Arvi", "Seloo"] },
  { district_id: "DIST_MH_YAV", name: "Yavatmal", count: 35, talukas: ["Yavatmal", "Pusad", "Darwha", "Umarkhed", "Wani"] },
  { district_id: "DIST_MH_BHA", name: "Bhandara", count: 25, talukas: ["Bhandara", "Tumsar", "Pauni", "Mohadi", "Sakoli"] },
  { district_id: "DIST_MH_GON", name: "Gondia", count: 25, talukas: ["Gondia", "Tirora", "Goregaon", "Amgaon", "Deori"] },
  { district_id: "DIST_MH_GAD", name: "Gadchiroli", count: 15, talukas: ["Gadchiroli", "Armori", "Chamorshi", "Dhanora", "Kurkheda"] },
];

const SCHEMES_POOL = [
  { id: "MH-SJSA-SANJAYGANDHI-014", name: "Sanjay Gandhi Niradhar Anudan Yojana" },
  { id: "CENT-MORD-NSAP-006", name: "National Social Assistance Programme (IGNOAPS)" },
  { id: "MH-WCD-LADKIBAHIN-010", name: "Mukhyamantri Majhi Ladki Bahin Yojana" },
  { id: "CENT-MOHFW-PMJAY-002", name: "Ayushman Bharat PM-JAY" },
  { id: "CENT-MOAFW-PMKISAN-001", name: "PM-Kisan Samman Nidhi" },
  { id: "CENT-MOHUA-PMSVANIDHI-004", name: "PM SVANidhi Street Vendor Loan" },
  { id: "MH-SJSA-SHRAVANBAL-015", name: "Shravanbal Seva Rajya Nivruttivetan Yojana" },
  { id: "LOCAL-GAD-PMAYG-ENHANCED-020", name: "PMAY-G Enhanced Assistance" },
  { id: "MH-TDD-SHABARIAWAS-022", name: "Shabari Adivasi Gharkul Yojana" },
  { id: "MH-LAB-MAHABOCW-016", name: "MAHABOCW Construction Worker Welfare" },
];

const REJECTION_REASONS_POOL = [
  { code: "INCOME_EXCEEDED", note: "Annual family income of ₹1,80,000 exceeds scheme limit." },
  { code: "AGE_NOT_MATCHED", note: "Applicant age does not meet scheme age boundary requirement." },
  { code: "CATEGORY_MISMATCH", note: "Target caste or social category does not match reservation criteria." },
  { code: "DOMICILE_NOT_MET", note: "Years of continuous residence in Maharashtra less than mandatory 15 years." },
  { code: "LAND_CEILING_EXCEEDED", note: "Cultivable land holding exceeds small/marginal farmer limit." },
  { code: "DOCUMENT_DEFICIT", note: "Mandatory income or caste validity certificate was not provided." },
];

export async function seedDemoNgo(options: { reset?: boolean } = {}): Promise<SeedDemoNgoResult> {
  await initDb();
  await runMigrations();

  const resetRequested = options.reset ?? process.argv.includes("--reset");
  await clearSyntheticDemoData();

  if (resetRequested && process.argv.includes("--reset-only")) {
    return {
      reset: true,
      households_count: 0,
      members_count: 0,
      applications_count: 0,
      outcomes: { approved: 0, rejected: 0, pending: 0, stuck: 0 },
      rejection_reasons: {},
      districts: [],
      district_counts: {},
    };
  }

  const now = Date.now();
  let globalIndex = 0;

  const districtCounts: Record<string, number> = {};
  const rejectionCounts: Record<string, number> = {};
  let totalApproved = 0;
  let totalRejected = 0;
  let totalPending = 0;
  let totalStuck = 0;

  // We will collect entities and insert them in batches of 50
  const householdsBatch: Array<typeof schema.households.$inferInsert> = [];
  const membersBatch: Array<typeof schema.householdMembers.$inferInsert> = [];
  const answersBatch: Array<typeof schema.memberAnswers.$inferInsert> = [];
  const consentsBatch: Array<typeof schema.consentRecords.$inferInsert> = [];
  const applicationsBatch: Array<typeof schema.applications.$inferInsert> = [];
  const stepsBatch: Array<typeof schema.applicationSteps.$inferInsert> = [];
  const documentsBatch: Array<typeof schema.householdDocuments.$inferInsert> = [];

  for (const dist of DISTRICT_TARGETS) {
    districtCounts[dist.district_id] = dist.count;

    for (let i = 0; i < dist.count; i++) {
      globalIndex++;
      const indexStr = String(globalIndex).padStart(3, "0");
      const householdId = `hh_synth_${dist.district_id.toLowerCase().replace("dist_mh_", "")}_${indexStr}`;
      const memberId = `mem_synth_${indexStr}`;
      const appId = `app_synth_${indexStr}`;
      const taluka = dist.talukas[i % dist.talukas.length];
      const phone = `98765${String(globalIndex).padStart(5, "0")}`;

      // Distribute outcomes: ~35% approved, ~30% rejected, ~35% pending (including stuck)
      const outcomeType = i % 10;
      let outcome: "approved" | "rejected" | "pending";
      let status: "APPROVED" | "REJECTED" | "IN_REVIEW" | "DRAFT" | "SUBMITTED";
      let isStuck = false;
      let createdAtDate: Date;
      let rejectionReasonCode: string | null = null;
      let rejectionNote: string | null = null;

      if (outcomeType <= 3) {
        // Approved (40%)
        outcome = "approved";
        status = "APPROVED";
        totalApproved++;
        createdAtDate = new Date(now - (15 + (i % 30)) * 86400000);
      } else if (outcomeType <= 6) {
        // Rejected (30%)
        outcome = "rejected";
        status = "REJECTED";
        totalRejected++;
        const reasonObj = REJECTION_REASONS_POOL[i % REJECTION_REASONS_POOL.length]!;
        rejectionReasonCode = reasonObj.code;
        rejectionNote = reasonObj.note;
        rejectionCounts[rejectionReasonCode] = (rejectionCounts[rejectionReasonCode] || 0) + 1;
        createdAtDate = new Date(now - (10 + (i % 20)) * 86400000);
      } else {
        // Pending / In Review (30%)
        outcome = "pending";
        // Half of pending are stuck (> 7 days)
        if (i % 2 === 0) {
          isStuck = true;
          totalStuck++;
          status = i % 4 === 0 ? "DRAFT" : "IN_REVIEW";
          createdAtDate = new Date(now - (8 + (i % 25)) * 86400000); // 8-33 days ago
        } else {
          status = "SUBMITTED";
          createdAtDate = new Date(now - (1 + (i % 6)) * 86400000); // 1-6 days ago
        }
        totalPending++;
      }

      // Demographic variations
      const age = 22 + (i * 7) % 55; // 22 to 76
      const gender = i % 2 === 0 ? "FEMALE" : "MALE";
      const maritalStatus = gender === "FEMALE" && age > 45 && i % 3 === 0 ? "WIDOW" : "MARRIED";
      const casteCategory = ["SC", "ST", "OBC", "OPEN", "VJNT"][i % 5];
      const income = 15000 + (i * 4500) % 180000;
      const bpl = income < 50000;
      const schemeObj = SCHEMES_POOL[i % SCHEMES_POOL.length]!;

      const accessSecret = `sec_synth_${householdId}`;
      const accessSecretHash = crypto.createHash("sha256").update(accessSecret).digest("hex");

      // 1. Household
      householdsBatch.push({
        household_id: householdId,
        district_id: dist.district_id,
        taluka,
        state: "Maharashtra",
        contact_phone: phone,
        is_synthetic: true,
        created_by_role: "volunteer",
        access_secret_hash: accessSecretHash,
        created_at: createdAtDate,
        updated_at: createdAtDate,
      });

      // 2. Member
      membersBatch.push({
        member_id: memberId,
        household_id: householdId,
        relation_to_head: "SELF",
        age,
        gender,
        caste_category: casteCategory,
        marital_status: maritalStatus,
        occupation: i % 3 === 0 ? "FARMER" : i % 3 === 1 ? "ARTISAN" : "DAILY_WAGE_LABOUR",
        answers: {
          age,
          gender,
          marital_status: maritalStatus,
          is_widow: maritalStatus === "WIDOW",
          caste_category: casteCategory,
          annual_family_income: income,
          in_bpl_list: bpl,
          years_in_maharashtra: Math.min(age, 35),
          phone_number: phone,
        },
        created_at: createdAtDate,
        updated_at: createdAtDate,
      });

      // 3. Member Answers
      answersBatch.push(
        {
          household_id: householdId,
          member_id: memberId,
          attribute_key: "age",
          value: age,
          source: "volunteer_confirmed",
          status: "confirmed",
          updated_by_role: "volunteer",
        },
        {
          household_id: householdId,
          member_id: memberId,
          attribute_key: "annual_family_income",
          value: income,
          source: "volunteer_confirmed",
          status: "confirmed",
          updated_by_role: "volunteer",
        },
        {
          household_id: householdId,
          member_id: memberId,
          attribute_key: "phone_number",
          value: phone,
          source: "self_declared",
          status: "confirmed",
          updated_by_role: "citizen",
        }
      );

      // 4. Consents
      consentsBatch.push(
        {
          household_id: householdId,
          purpose: "data_processing",
          lang: "mr",
          granted_at: createdAtDate,
        },
        {
          household_id: householdId,
          purpose: "sms_reminders",
          lang: "mr",
          granted_at: createdAtDate,
        }
      );

      // 5. Application
      applicationsBatch.push({
        application_id: appId,
        household_id: householdId,
        member_id: memberId,
        scheme_id: schemeObj.id,
        status,
        outcome,
        rejection_reason_code: rejectionReasonCode,
        rejection_note: rejectionNote,
        reference_no: `SYNTH-${dist.name.substring(0, 3).toUpperCase()}-2026-${indexStr}`,
        current_step_number: outcome === "approved" ? 3 : outcome === "rejected" ? 1 : 2,
        outcome_recorded_by_role: outcome !== "pending" ? "admin" : null,
        outcome_at: outcome !== "pending" ? new Date(createdAtDate.getTime() + 5 * 86400000) : null,
        is_synthetic: true,
        created_at: createdAtDate,
        updated_at: isStuck ? createdAtDate : new Date(),
      });

      // 6. Application Steps
      stepsBatch.push(
        {
          id: `step_${appId}_1`,
          application_id: appId,
          step_number: 1,
          title: "Document Verification",
          description: isStuck ? "Verification pending with Tahsildar / Gram Sevak" : "Verified",
          status: isStuck ? "PENDING" : "COMPLETED",
          completed_at: isStuck ? null : createdAtDate,
        },
        {
          id: `step_${appId}_2`,
          application_id: appId,
          step_number: 2,
          title: "In-Person Field Verification",
          description: "Field officer verification",
          status: outcome === "approved" ? "COMPLETED" : "PENDING",
          completed_at: outcome === "approved" ? createdAtDate : null,
        }
      );

      // 7. Documents (if stuck, document is missing / expired)
      if (isStuck) {
        documentsBatch.push({
          id: `doc_${householdId}_stuck`,
          household_id: householdId,
          member_id: memberId,
          document_id: i % 2 === 0 ? "DOC_005" : "DOC_006",
          status: "missing",
          notes: "Income / Residence certificate verification pending for > 7 days",
        });
      }
    }
  }

  // Batch insert into DB in chunks of 50
  const CHUNK = 50;
  for (let i = 0; i < householdsBatch.length; i += CHUNK) {
    await db.insert(schema.households).values(householdsBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < membersBatch.length; i += CHUNK) {
    await db.insert(schema.householdMembers).values(membersBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < answersBatch.length; i += CHUNK) {
    await db.insert(schema.memberAnswers).values(answersBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < consentsBatch.length; i += CHUNK) {
    await db.insert(schema.consentRecords).values(consentsBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < applicationsBatch.length; i += CHUNK) {
    await db.insert(schema.applications).values(applicationsBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < stepsBatch.length; i += CHUNK) {
    await db.insert(schema.applicationSteps).values(stepsBatch.slice(i, i + CHUNK));
  }
  for (let i = 0; i < documentsBatch.length; i += CHUNK) {
    await db.insert(schema.householdDocuments).values(documentsBatch.slice(i, i + CHUNK));
  }

  return {
    reset: resetRequested,
    households_count: householdsBatch.length,
    members_count: membersBatch.length,
    applications_count: applicationsBatch.length,
    outcomes: {
      approved: totalApproved,
      rejected: totalRejected,
      pending: totalPending,
      stuck: totalStuck,
    },
    rejection_reasons: rejectionCounts,
    districts: Object.keys(districtCounts),
    district_counts: districtCounts,
  };
}

// CLI execution
if (process.argv[1]?.endsWith("demo-ngo.ts") || process.argv[1]?.endsWith("demo-ngo.js")) {
  seedDemoNgo()
    .then(async (res) => {
      console.log("=== NGO Demo Seed Complete (300 Synthetic Households Across Vidarbha) ===");
      console.log(`Reset performed: ${res.reset}`);
      console.log(`Households seeded: ${res.households_count}`);
      console.log(`Applications seeded: ${res.applications_count}`);
      console.log(`Approved: ${res.outcomes.approved}, Rejected: ${res.outcomes.rejected}, Pending: ${res.outcomes.pending} (Stuck: ${res.outcomes.stuck})`);
      console.log("District Skew:", JSON.stringify(res.districts));
      console.log("Rejection Reasons:", JSON.stringify(res.rejection_reasons));
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("NGO Demo Seed failed:", err);
      await closeDb();
      process.exit(1);
    });
}
