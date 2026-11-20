import { initDb, closeDb, db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  await initDb();

  const marathiQuery = "शेतकरी";
  const hindiQuery = "किसान";

  const buildSearchQuery = (term: string) => `
    SELECT scheme_id, official_name, 
           translated_names->>'mr' as mr_name,
           translated_names->>'hi' as hi_name,
           overview->>'objective' as objective,
           overview->'simple_explanation'->>'mr' as mr_explanation,
           overview->'simple_explanation'->>'hi' as hi_explanation
    FROM schemes
    WHERE (
      to_tsvector('simple',
        coalesce(official_name, '') || ' ' ||
        coalesce(translated_names->>'en', '') || ' ' ||
        coalesce(translated_names->>'hi', '') || ' ' ||
        coalesce(translated_names->>'mr', '') || ' ' ||
        coalesce(overview->>'objective', '') || ' ' ||
        coalesce(overview->'simple_explanation'->>'en', '') || ' ' ||
        coalesce(overview->'simple_explanation'->>'hi', '') || ' ' ||
        coalesce(overview->'simple_explanation'->>'mr', '')
      ) @@ plainto_tsquery('simple', '${term}')
      OR official_name ILIKE '%${term}%'
      OR coalesce(translated_names->>'en', '') ILIKE '%${term}%'
      OR coalesce(translated_names->>'hi', '') ILIKE '%${term}%'
      OR coalesce(translated_names->>'mr', '') ILIKE '%${term}%'
      OR coalesce(overview->>'objective', '') ILIKE '%${term}%'
      OR coalesce(overview->'simple_explanation'->>'en', '') ILIKE '%${term}%'
      OR coalesce(overview->'simple_explanation'->>'hi', '') ILIKE '%${term}%'
      OR coalesce(overview->'simple_explanation'->>'mr', '') ILIKE '%${term}%'
    )
  `;

  console.log(`\n--- Testing Marathi Search Term: "${marathiQuery}" ---`);
  const mrRes = await db.execute(sql.raw(buildSearchQuery(marathiQuery)));
  const mrRows = (mrRes.rows || mrRes) as any[];
  console.log(`Matched ${mrRows.length} schemes:`);
  mrRows.forEach((r) => console.log(`  - [${r.scheme_id}] ${r.mr_name || r.official_name}`));

  console.log(`\n--- Testing Hindi Search Term: "${hindiQuery}" ---`);
  const hiRes = await db.execute(sql.raw(buildSearchQuery(hindiQuery)));
  const hiRows = (hiRes.rows || hiRes) as any[];
  console.log(`Matched ${hiRows.length} schemes:`);
  hiRows.forEach((r) => console.log(`  - [${r.scheme_id}] ${r.hi_name || r.official_name}`));

  await closeDb();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
