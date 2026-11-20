import path from "path";
import fs from "fs";
import { DatasetImporter } from "../src/ingest/dataset-importer.js";
import { closeDb } from "../src/db/index.js";

async function main() {
  const possiblePaths = [
    path.resolve(process.cwd(), "../DATASET"),
    path.resolve(process.cwd(), "DATASET"),
    path.resolve(process.cwd(), "../../DATASET"),
  ];

  let datasetDir = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "central_schemes_master.csv"))) {
      datasetDir = p;
      break;
    }
  }

  if (!datasetDir) {
    console.error("Could not find DATASET folder in expected locations:", possiblePaths);
    process.exit(1);
  }

  console.log(`Found DATASET directory at: ${datasetDir}`);
  const summary = await DatasetImporter.importAll(datasetDir);

  console.log("\n================ DATASET IMPORT SUMMARY ================");
  console.log(`Total Schemes Imported:          ${summary.schemesImported}`);
  console.log(`Curated Schemes Cross-Linked:    ${summary.schemesLinked}`);
  console.log(`Total Scheme FAQs Ingested:      ${summary.faqsImported}`);
  console.log(`Vidarbha District Mappings:      ${summary.districtMappingsImported}`);
  console.log("========================================================\n");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error during dataset import:", err);
  process.exit(1);
});
