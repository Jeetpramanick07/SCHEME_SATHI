import { IngestionPipeline } from "./pipeline.js";
import { closeDb } from "../db/index.js";

async function main() {
  const args = process.argv.slice(2);
  let targetPath = "data/government_welfare_schemes.json";
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (!arg.startsWith("--")) {
      targetPath = arg;
    }
  }

  console.log(`Starting ingestion pipeline for: ${targetPath} (dry-run: ${dryRun})...`);
  try {
    const report = await IngestionPipeline.ingest(targetPath, { dryRun });
    console.log("\n================ INGESTION REPORT ================");
    console.log(`Run ID:         ${report.run_id}`);
    console.log(`Timestamp:      ${report.timestamp}`);
    console.log(`Dry Run:        ${report.dry_run}`);
    console.log(`Total Schemes:  ${report.total_schemes}`);
    console.log(`Accepted:       ${report.accepted_count}`);
    console.log(`Rejected:       ${report.rejected_count}`);
    console.log(`Skipped:        ${report.skipped_count}`);

    const errors = report.issues.filter((i) => i.severity === "error");
    const warnings = report.issues.filter((i) => i.severity === "warn");
    const infos = report.issues.filter((i) => i.severity === "info");

    console.log(`Issues Summary: Errors=${errors.length}, Warnings=${warnings.length}, Info=${infos.length}`);

    if (errors.length > 0) {
      console.log("\n--- ERRORS ---");
      for (const err of errors.slice(0, 10)) {
        console.log(`[${err.code}] ${err.scheme_id ? `[${err.scheme_id}] ` : ""}${err.message}`);
      }
    }

    if (warnings.length > 0) {
      console.log("\n--- KEY WARNINGS ---");
      for (const warn of warnings.slice(0, 15)) {
        console.log(`[${warn.code}] ${warn.scheme_id ? `[${warn.scheme_id}] ` : ""}${warn.message}`);
      }
      if (warnings.length > 15) {
        console.log(`... and ${warnings.length - 15} more warnings`);
      }
    }

    if (infos.length > 0) {
      console.log("\n--- INFO ---");
      for (const inf of infos.slice(0, 10)) {
        console.log(`[${inf.code}] ${inf.scheme_id ? `[${inf.scheme_id}] ` : ""}${inf.message}`);
      }
      if (infos.length > 10) {
        console.log(`... and ${infos.length - 10} more info entries`);
      }
    }

    console.log("==================================================\n");
    await closeDb();
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (err: unknown) {
    console.error("Ingestion failed fatally:", err);
    await closeDb();
    process.exit(1);
  }
}

main();
