import { initDb, closeDb, db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { buildServer } from "../src/server.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";

async function diagnose() {
  await initDb();
  await IngestionPipeline.ingest("data/government_welfare_schemes.json");
  const server = await buildServer();
  await server.ready();

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
          member_id: "mem_diag",
          age: 62,
          gender: "FEMALE",
          marital_status: "WIDOW",
          relation_to_head: "SELF",
        },
      ],
      include_all: true,
    },
  });

  const data = JSON.parse(evalRes.body);
  const memRes = data.results[0];
  console.log("can_apply count:", memRes.tiers.can_apply.length);

  const allDbSchemes = await db.select().from(schema.schemes);
  const dbMap = new Map(allDbSchemes.map((s) => [s.scheme_id, s]));

  // Find the first 20 imported schemes that have no hard filter violations and 0 compiled rules
  // (which previously defaulted to ELIGIBLE / can_apply)
  const falsePositives: any[] = [];
  for (const s of allDbSchemes) {
    if (s.source === "curated" || s.is_test) continue;
    const compiled = s.compiled_rules as any;
    const hf = compiled?.hard_filters || {};
    // Check hard filters for 62yo female widow in Nagpur Urban, Maharashtra
    if (hf.min_age && 62 < hf.min_age) continue;
    if (hf.max_age && 62 > hf.max_age) continue;
    if (hf.gender && hf.gender.length > 0 && !hf.gender.includes("FEMALE") && !hf.gender.includes("ALL")) continue;
    if (hf.states && hf.states.length > 0 && !hf.states.includes("Maharashtra") && !hf.states.includes("All India")) continue;

    const rules = compiled?.rules || [];
    const mandatoryRules = rules.filter((r: any) => r.mandatory !== false);
    falsePositives.push({
      scheme_id: s.scheme_id,
      official_name: s.official_name,
      source: "imported",
      mandatory_rules_count: mandatoryRules.length,
      data_completeness: s.data_completeness ?? "UNKNOWN",
      verified: s.last_verified ? true : false,
      hard_filters: hf,
    });
    if (falsePositives.length >= 20) break;
  }

  console.log(`\n--- FIRST 20 OF 619 UNVERIFIED IMPORTED FALSE POSITIVES ---`);
  for (let i = 0; i < falsePositives.length; i++) {
    const s = falsePositives[i];
    console.log(`${i + 1}. [${s.scheme_id}] ${s.official_name}`);
    console.log(`   Source: ${s.source} | Mandatory Rules: ${s.mandatory_rules_count} | Data Completeness: ${s.data_completeness} | Verified: ${s.verified}`);
    console.log(`   Hard Filters: ${JSON.stringify(s.hard_filters)}`);
    console.log(`   Why ELIGIBLE previously: Broad geographic scope ("All India"/"Maharashtra"), no age/gender restrictions, 0 compiled mandatory rules -> 0 unmet rules & 0 unknown attributes -> marked ELIGIBLE (can_apply).`);
    console.log("--------------------------------------------------------------------------------");
  }

  await server.close();
  await closeDb();
}

diagnose().catch((err) => {
  console.error(err);
  process.exit(1);
});
