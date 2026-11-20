import fs from "fs";
import { initDb, closeDb, db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { CatalogueService } from "../modules/catalogue/service.js";
import { EligibilityService } from "../modules/eligibility/service.js";
import { SchemeCompiledRules } from "../engine/types.js";
import { rulesCache } from "../services/cache.js";

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))]!;
}

async function runBenchmark() {
  const targetCount = parseInt(process.env.BENCH_SCHEMES || "5000", 10);
  console.log(`\n================ SCHEMESAATHI BENCHMARK ================`);
  console.log(`Target scheme dataset size: ${targetCount} schemes`);

  await initDb();

  // Load existing base schemes
  let samplePath = "data/government_welfare_schemes.json";
  if (!fs.existsSync(samplePath) && fs.existsSync("../government_welfare_schemes.json")) {
    samplePath = "../government_welfare_schemes.json";
  }

  const rawJson = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  const realSchemes = rawJson.schemes || [];
  if (realSchemes.length === 0) {
    throw new Error("No real schemes found to mutate");
  }

  // Count existing schemes
  const existing = await db.select({ id: schema.schemes.scheme_id }).from(schema.schemes);
  const currentCount = existing.length;

  if (currentCount < targetCount) {
    const needed = targetCount - currentCount;
    console.log(`Generating and ingesting ${needed} synthetic schemes to reach ${targetCount}...`);

    const batchSize = 500;
    const syntheticRules: SchemeCompiledRules[] = [];

    for (let i = 0; i < needed; i++) {
      const template = realSchemes[i % realSchemes.length];
      const schemeId = `SYNTH_${String(currentCount + i + 1).padStart(5, "0")}`;
      const ageMod = 18 + (i % 60);
      const incMod = 50000 + (i % 50) * 10000;
      const benefitTypes = ["CASH_TRANSFER", "HEALTH_INSURANCE", "SUBSIDY", "PENSION", "LOAN"];
      const benefitType = benefitTypes[i % benefitTypes.length];
      const genders = i % 3 === 0 ? ["FEMALE"] : i % 3 === 1 ? ["MALE"] : ["FEMALE", "MALE"];

      const compiled: SchemeCompiledRules = {
        scheme_id: schemeId,
        status: i % 20 === 0 ? "INACTIVE" : "ACTIVE",
        accepting_applications: i % 15 === 0 ? "SEASONAL" : "YES",
        rules: [
          {
            rule_id: `${schemeId}_R1`,
            attribute: "age",
            operator: "GREATER_THAN_OR_EQUAL",
            value: ageMod,
            mandatory: true,
            advisory_only: false,
          },
          {
            rule_id: `${schemeId}_R2`,
            attribute: "annual_family_income",
            operator: "LESS_THAN_OR_EQUAL",
            value: incMod,
            mandatory: true,
            advisory_only: false,
          },
        ],
        exclusion_rules: [],
        other_conditions: [],
        hard_filters: {
          min_age: ageMod,
          max_income: incMod,
          allowed_genders: genders,
          states: ["Maharashtra"],
          district_ids: ["DIST_MH_NGP", "DIST_MH_WRD"],
        },
      };

      syntheticRules.push(compiled);

      // Insert in batches
      if (syntheticRules.length >= batchSize || i === needed - 1) {
        const insertBatch = syntheticRules.map((c) => ({
          scheme_id: c.scheme_id,
          official_name: `Synthetic Welfare Scheme ${c.scheme_id}`,
          translated_names: {
            en: `Synthetic Welfare Scheme ${c.scheme_id}`,
            hi: `कृत्रिम कल्याण योजना ${c.scheme_id}`,
            mr: `कृत्रिम कल्याणकारी योजना ${c.scheme_id}`,
          },
          level: "STATE",
          scheme_type: "WELFARE",
          implementing_state: "Maharashtra",
          department_id: "DEPT_001",
          overview: {
            objective: `Provide targeted welfare support for ${c.scheme_id}`,
            simple_explanation: {
              en: `Synthetic assistance program for eligible households (${c.scheme_id})`,
            },
            beneficiary_categories: ["BEN_001", "BEN_002"],
          },
          benefits: {
            benefit_type: benefitType,
            amount: 1000 + (i % 10) * 500,
          },
          raw: template,
          compiled_rules: c as unknown as Record<string, unknown>,
          min_age: c.hard_filters.min_age,
          max_income: c.hard_filters.max_income,
          allowed_genders: c.hard_filters.allowed_genders,
          states: c.hard_filters.states,
          district_ids: c.hard_filters.district_ids,
          benefit_type: benefitType,
          beneficiary_categories: ["BEN_001", "BEN_002"],
          status: c.status,
          accepting_applications: c.accepting_applications,
          is_test: true,
          content_hash: `synth_hash_${c.scheme_id}`,
          version: 1,
        }));

        await db.insert(schema.schemes).values(insertBatch).onConflictDoNothing();
        syntheticRules.length = 0;
      }
    }
    console.log(`Successfully reached dataset size of ${targetCount} schemes.`);
  }

  // Reload cache with full dataset
  rulesCache.invalidate();
  console.log("Warming in-memory rules cache for sub-millisecond evaluation...");
  const t0 = performance.now();
  await EligibilityService.loadCompiledRules(true);
  const warmTime = performance.now() - t0;
  console.log(`Cache warmed in ${warmTime.toFixed(1)}ms. Total schemes loaded: ${rulesCache.getAll().length}\n`);

  // Benchmark 1a: In-Memory Cache Search (< 100ms)
  // Measures in-memory inverted filtering, cursor pagination, and view projection latency.
  console.log("Running Benchmark 1a: In-Memory Cache Search (target < 100ms)...");
  const searchQueries = [
    { q: "kisan", limit: 20 },
    { q: "pension", limit: 20 },
    { department: "DEPT_001", limit: 20 },
    { status: "ACTIVE", level: "STATE", limit: 20 },
    { category: "BEN_001", limit: 20 },
  ];

  const searchLatencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    const q = searchQueries[i % searchQueries.length]!;
    const start = performance.now();
    await CatalogueService.listSchemes({
      ...q,
      sort: "name_asc",
      limit: 20,
      view: "card",
      lang: "en",
      include_test: true,
      source: "cache",
    });
    searchLatencies.push(performance.now() - start);
  }
  searchLatencies.sort((a, b) => a - b);
  const searchP50 = percentile(searchLatencies, 50);
  const searchP95 = percentile(searchLatencies, 95);

  // Benchmark 1b: Database Postgres Full-Text Search (< 100ms)
  // Measures PostgreSQL execution: SQL parsing, to_tsvector @@ plainto_tsquery and trigram index scan.
  console.log("Running Benchmark 1b: Database Postgres Full-Text Search (source='db')...");
  const dbSearchQueries = [
    { q: "kisan", limit: 20 },
    { q: "pension", limit: 20 },
    { q: "Awas", limit: 20 },
    { status: "ACTIVE", level: "STATE", limit: 20 },
  ];

  const dbSearchLatencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const q = dbSearchQueries[i % dbSearchQueries.length]!;
    const start = performance.now();
    await CatalogueService.listSchemes({
      ...q,
      sort: "name_asc",
      limit: 20,
      view: "card",
      lang: "en",
      include_test: true,
      source: "db",
    });
    dbSearchLatencies.push(performance.now() - start);
  }
  dbSearchLatencies.sort((a, b) => a - b);
  const dbSearchP50 = percentile(dbSearchLatencies, 50);
  const dbSearchP95 = percentile(dbSearchLatencies, 95);

  // Multilingual Search Verification
  console.log("Verifying Multilingual Search Accuracy (Hindi & Marathi)...");
  const mrSearchResult = await CatalogueService.listSchemes({
    q: "शेतकरी",
    lang: "mr",
    view: "card",
  });
  const hiSearchResult = await CatalogueService.listSchemes({
    q: "पेंशन",
    lang: "hi",
    view: "card",
  });
  console.log(`  Marathi search ('शेतकरी') matched ${mrSearchResult.items.length} schemes.`);
  console.log(`  Hindi search ('पेंशन') matched ${hiSearchResult.items.length} schemes.`);

  // Benchmark 2: Facets (< 100ms)
  console.log("Running Benchmark 2: Catalogue Facets...");
  const facetLatencies: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await CatalogueService.getFacets();
    facetLatencies.push(performance.now() - start);
  }
  facetLatencies.sort((a, b) => a - b);
  const facetsP50 = percentile(facetLatencies, 50);
  const facetsP95 = percentile(facetLatencies, 95);

  // Benchmark 3: Eligibility for 6-member household against all 5,000 schemes (< 500ms)
  console.log("Running Benchmark 3: 6-Member Household Eligibility against all schemes (target < 500ms)...");
  const householdPayload = {
    household: {
      household_id: "bench_hh_nagpur",
      state: "Maharashtra",
      district_id: "DIST_MH_NGP",
      taluka: "Nagpur Urban",
      annual_family_income: 180000,
      bpl_card_holder: false,
    },
    members: [
      {
        member_id: "m1_widow_head",
        relation_to_head: "SELF",
        age: 62,
        gender: "FEMALE",
        occupation: "ARTISAN",
        caste_category: "OBC",
        marital_status: "WIDOW",
        answers: { is_widow: true, years_in_maharashtra_gte: 40 },
      },
      {
        member_id: "m2_son_farmer",
        relation_to_head: "SON",
        age: 35,
        gender: "MALE",
        occupation: "FARMER",
        marital_status: "MARRIED",
        answers: { owns_cultivable_land: true },
      },
      {
        member_id: "m3_daughter_in_law",
        relation_to_head: "DAUGHTER_IN_LAW",
        age: 32,
        gender: "FEMALE",
        marital_status: "MARRIED",
        answers: { is_pregnant_or_lactating_mother: true, child_order_valid: true },
      },
      {
        member_id: "m4_grandson_student",
        relation_to_head: "GRANDSON",
        age: 14,
        gender: "MALE",
        occupation: "STUDENT",
        answers: {},
      },
      {
        member_id: "m5_granddaughter",
        relation_to_head: "GRANDDAUGHTER",
        age: 8,
        gender: "FEMALE",
        occupation: "STUDENT",
        answers: {},
      },
      {
        member_id: "m6_uncle_senior",
        relation_to_head: "UNCLE",
        age: 68,
        gender: "MALE",
        marital_status: "MARRIED",
        answers: { disability_percentage: 45 },
      },
    ],
    lang: "mr" as const,
  };

  const eligLatencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    await EligibilityService.evaluate(householdPayload);
    eligLatencies.push(performance.now() - start);
  }
  eligLatencies.sort((a, b) => a - b);
  const eligP50 = percentile(eligLatencies, 50);
  const eligP95 = percentile(eligLatencies, 95);

  // Benchmark 4: Next-Questions (target < 300ms)
  console.log("Running Benchmark 4: Next-Questions Adaptive Ranking (target < 300ms)...");
  const nextQPayload = {
    subject: householdPayload.members[0],
    household: householdPayload.household,
    limit: 5,
    lang: "mr" as const,
  };

  const nextQLatencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    await EligibilityService.getNextQuestions(nextQPayload);
    nextQLatencies.push(performance.now() - start);
  }
  nextQLatencies.sort((a, b) => a - b);
  const nextQP50 = percentile(nextQLatencies, 50);
  const nextQP95 = percentile(nextQLatencies, 95);

  // Summary Table
  console.log("\n=================== BENCHMARK RESULTS ===================");
  console.log(
    `1a. In-Memory Cache Search (50 runs): p50 = ${searchP50.toFixed(2)}ms, p95 = ${searchP95.toFixed(2)}ms (Target: < 100ms) -> ${searchP95 < 100 ? "PASS ✓" : "FAIL ✗"}`
  );
  console.log(
    `1b. Database Postgres Search (20 runs): p50 = ${dbSearchP50.toFixed(2)}ms, p95 = ${dbSearchP95.toFixed(2)}ms (Target: < 100ms) -> ${dbSearchP95 < 100 ? "PASS ✓" : "FAIL ✗"}`
  );
  console.log(
    `2.  Catalogue Facets (30 runs):       p50 = ${facetsP50.toFixed(2)}ms, p95 = ${facetsP95.toFixed(2)}ms`
  );
  console.log(
    `3.  6-Member Eligibility (20 runs against ${targetCount} schemes):`
  );
  console.log(
    `                                      p50 = ${eligP50.toFixed(2)}ms, p95 = ${eligP95.toFixed(2)}ms (Target: < 500ms) -> ${eligP95 < 500 ? "PASS ✓" : "FAIL ✗"}`
  );
  console.log(
    `4.  Next-Questions (20 runs):          p50 = ${nextQP50.toFixed(2)}ms, p95 = ${nextQP95.toFixed(2)}ms (Target: < 300ms) -> ${nextQP95 < 300 ? "PASS ✓" : "FAIL ✗"}`
  );
  console.log("=========================================================\n");

  await closeDb();
  const allPassed = searchP95 < 100 && dbSearchP95 < 100 && eligP95 < 500 && nextQP95 < 300;
  process.exit(allPassed ? 0 : 1);
}

runBenchmark().catch(async (err) => {
  console.error("Benchmark failed fatally:", err);
  await closeDb();
  process.exit(1);
});
