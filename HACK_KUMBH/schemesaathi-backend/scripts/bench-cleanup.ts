import { initDb, closeDb, db, isRealPostgres } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { rulesCache } from "../src/services/cache.js";

async function main() {
  console.log("Starting bench cleanup...");
  await initDb();

  // 1. Delete all synthetic test schemes from main schemes table
  const deleted = await db
    .delete(schema.schemes)
    .where(eq(schema.schemes.is_test, true));

  console.log(`Deleted synthetic test schemes (is_test=true) from schemes table.`);

  // 2. Drop bench schema if it exists on real postgres
  if (isRealPostgres()) {
    try {
      await db.execute(sql.raw("DROP SCHEMA IF EXISTS schemesaathi_bench CASCADE;"));
      console.log("Dropped schema 'schemesaathi_bench' (if it existed).");
    } catch (err) {
      console.warn("Could not drop bench schema:", err);
    }
  }

  // 3. Invalidate in-memory caches
  rulesCache.invalidate();
  console.log("Invalidated rules and catalogue cache.");

  // 4. Verify scheme count
  const remaining = await db.select().from(schema.schemes);
  const remainingTest = remaining.filter((s) => s.is_test);
  console.log(`Cleanup complete. Remaining schemes: ${remaining.length} (Test schemes: ${remainingTest.length})`);

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error during bench cleanup:", err);
  process.exit(1);
});
