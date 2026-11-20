import fs from "fs";
const data = JSON.parse(fs.readFileSync("./data/government_welfare_schemes.json", "utf8"));
const targets = ["CENT-MORD-NSAP-006", "MH-SJSA-SANJAYGANDHI-014", "MH-SJSA-SHRAVANBAL-015", "CENT-MOHFW-PMJAY-002"];

for (const s of data.schemes.filter(s => targets.includes(s.scheme_id))) {
  console.log(`\n======================================================`);
  console.log(`[${s.scheme_id}] ${s.official_name}`);
  console.log("Hard filters:", {
    min_age: s.eligibility?.minimum_age,
    max_age: s.eligibility?.maximum_age,
    min_inc: s.eligibility?.minimum_income,
    max_inc: s.eligibility?.maximum_income,
    genders: s.eligibility?.gender_restrictions,
    districts: s.scheme_classification?.implementing_districts,
  });
  console.log("Rules:", s.eligibility?.rules);
  console.log("Other conditions:", s.eligibility?.other_conditions);
  console.log("Exclusion rules:", s.eligibility?.exclusion_rules);
}
