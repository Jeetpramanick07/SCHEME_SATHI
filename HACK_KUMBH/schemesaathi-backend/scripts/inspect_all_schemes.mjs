import fs from "fs";
const data = JSON.parse(fs.readFileSync("./data/government_welfare_schemes.json", "utf8"));

for (const s of data.schemes) {
  console.log(`\n======================================================`);
  console.log(`SCHEME: [${s.scheme_id}] ${s.official_name}`);
  console.log(`Classification: level=${s.scheme_classification?.level}, state=${s.scheme_classification?.implementing_state}, dists=${JSON.stringify(s.scheme_classification?.implementing_districts)}`);
  console.log(`Hard filters: min_age=${s.eligibility?.minimum_age}, max_age=${s.eligibility?.maximum_age}, min_inc=${s.eligibility?.minimum_income}, max_inc=${s.eligibility?.maximum_income}, genders=${JSON.stringify(s.eligibility?.gender_restrictions)}`);
  console.log(`Rules count: ${s.eligibility?.rules?.length || 0}`);
  for (const r of s.eligibility?.rules || []) {
    console.log(`  Rule: attr=${r.attribute}, op=${r.operator}, val=${JSON.stringify(r.value)}, mand=${r.mandatory}, expl="${r.explanation}"`);
  }
  console.log(`Other conditions: ${JSON.stringify(s.eligibility?.other_conditions)}`);
  console.log(`Exclusion rules: ${JSON.stringify(s.eligibility?.exclusion_rules)}`);
}
