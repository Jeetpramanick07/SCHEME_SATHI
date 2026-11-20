import { initDb, closeDb } from "../src/db/index.js";
import { EligibilityService } from "../src/modules/eligibility/service.js";
import { rulesCache } from "../src/services/cache.js";

async function inspectWidowEvaluation() {
  await initDb();
  rulesCache.invalidate();

  const widowSubject = {
    member_id: "mem_widow_62",
    relation_to_head: "SELF",
    age: 62,
    gender: "FEMALE",
    marital_status: "WIDOW",
    occupation: "HOMEMAKER",
    answers: {
      has_aadhaar_linked_bank_account: true,
      has_savings_bank_account: true,
      residence_state: "MAHARASHTRA",
      district: "NAGPUR",
      annual_family_income: 20000,
      monthly_income: 1500,
      years_in_maharashtra_gte: 25,
      years_in_maharashtra: 25,
      ration_card_type_in: ["ORANGE"],
      holds_orange_ration_card: true,
      in_bpl_list: true,
      belongs_to_bpl_household: true,
      family_member_income_tax_payer: false,
      family_member_regular_govt_psu_employee_or_pensioner: false,
      family_owns_four_wheeler_excluding_tractor: false,
      receiving_other_govt_financial_scheme_gte_1500_per_month: false,
      holds_yellow_orange_aay_or_white_ration_card: true,
      holds_maharashtra_domicile_certificate: true,
    },
  };

  const payload = {
    household: {
      household_id: "hh_001",
      state: "Maharashtra",
      district_id: "DIST_MH_NGP",
      taluka: "NAGPUR_URBAN",
      annual_family_income: 20000,
      monthly_income: 1500,
      bpl_card_holder: true,
      answers: {
        district: "NAGPUR",
        in_bpl_list: true,
        belongs_to_bpl_household: true,
      },
    },
    members: [widowSubject],
    lang: "mr" as const,
  };

  const res = await EligibilityService.evaluate(payload);
  const m = res.results[0]!;

  console.log(`\n================ EVALUATION SUMMARY FOR 62YO WIDOW ================`);
  console.log(`Eligible: ${m.eligible.length}, Unknown: ${m.unknown.length}, Not Eligible: ${m.not_eligible.length}`);
  const allResults = [...m.eligible, ...m.unknown, ...m.not_eligible];
  console.log(`Total schemes evaluated: ${allResults.length}`);

  for (const s of allResults) {
    console.log(`\n[${s.scheme_id}] ${s.official_name}`);
    console.log(`  Status: ${s.status}`);
    if (s.variant) console.log(`  Variant / Subscheme: ${s.variant}`);
    if (s.matched_pathway) console.log(`  Matched Pathway: ${s.matched_pathway}`);
    if (s.unknown_attributes.length > 0) console.log(`  Unknown Attributes: ${s.unknown_attributes.join(", ")}`);
    if (s.unmet.length > 0) {
      console.log(`  Unmet: ${s.unmet.map(u => `${u.attribute} (expected: ${u.expected}, actual: ${u.actual})`).join("; ")}`);
      console.log(`  Reason (mr): ${s.reasons.mr.join("; ")}`);
    }
    if (s.exclusions_hit.length > 0) console.log(`  Exclusions Hit: ${s.exclusions_hit.map(e => e.raw).join("; ")}`);
  }

  await closeDb();
}

inspectWidowEvaluation().catch(console.error);
