import { initDb, closeDb, db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { sql } from "drizzle-orm";

async function checkAndClean() {
  await initDb();

  await db.execute(sql`DELETE FROM schemes WHERE is_test = TRUE OR scheme_id LIKE 'SYNTH_%' OR scheme_id LIKE 'LOCAL-NGP-SOLAR%' OR scheme_id LIKE 'VALID_TEST_%'`);
  await db.execute(sql`DELETE FROM scheme_versions WHERE scheme_id LIKE 'SYNTH_%' OR scheme_id LIKE 'LOCAL-NGP-SOLAR%' OR scheme_id LIKE 'VALID_TEST_%'`);

  const remaining = await db.select({
    id: schema.schemes.scheme_id,
    name: schema.schemes.official_name,
    is_test: schema.schemes.is_test
  }).from(schema.schemes);

  console.log(`\nVerified Clean Database: exactly ${remaining.length} official schemes present.`);
  for (const r of remaining) {
    console.log(` - [${r.id}] ${r.name}`);
  }

  await closeDb();
}

checkAndClean().catch(err => {
  console.error(err);
  process.exit(1);
});
