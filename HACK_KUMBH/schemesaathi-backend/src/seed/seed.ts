import fs from "fs";
import { initDb, closeDb, db } from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import * as schema from "../db/schema.js";
import { IngestionPipeline } from "../ingest/pipeline.js";
import { BASE_ATTRIBUTES } from "./base-attributes.js";
import { QUESTION_BANK, type QuestionBankItem } from "./question-bank.js";
import { REJECTION_REASONS } from "./rejection-reasons.js";
import { ProfileSectionsService } from "../services/profile-sections.js";

async function seed() {
  console.log("Seeding SchemeSaathi backend...");
  await initDb();
  await runMigrations();

  // 1. Seed base curated attributes & question bank
  const allAttributesToSeed: QuestionBankItem[] = [...QUESTION_BANK];
  // Add any from base-attributes not already present
  for (const base of BASE_ATTRIBUTES) {
    if (!allAttributesToSeed.some((a) => a.key === base.key)) {
      allAttributesToSeed.push({
        ...base,
        question_text: {
          en: base.question_text.en,
          hi: base.question_text.hi || base.question_text.en,
          mr: base.question_text.mr || base.question_text.en,
        },
        review_status: "machine_drafted",
        help_text_source: "dataset",
      });
    }
  }

  console.log(`Seeding ${allAttributesToSeed.length} curated question bank attributes...`);
  for (const attr of allAttributesToSeed) {
    await db
      .insert(schema.attributes)
      .values({
        key: attr.key,
        scope: attr.scope,
        value_type: attr.value_type,
        enum_values: attr.enum_values,
        unit: attr.unit,
        aliases: attr.aliases,
        question_text: attr.question_text,
        help_text: attr.help_text,
        derivation: attr.derivation,
        derived_from_approved_scheme: attr.derived_from_approved_scheme,
        review_status: attr.review_status || "machine_drafted",
        help_text_source: attr.help_text_source || "dataset",
        status: attr.status,
      })
      .onConflictDoUpdate({
        target: schema.attributes.key,
        set: {
          scope: attr.scope,
          value_type: attr.value_type,
          enum_values: attr.enum_values,
          unit: attr.unit,
          aliases: attr.aliases,
          question_text: attr.question_text,
          help_text: attr.help_text,
          derivation: attr.derivation,
          derived_from_approved_scheme: attr.derived_from_approved_scheme,
          review_status: attr.review_status || "machine_drafted",
          help_text_source: attr.help_text_source || "dataset",
          status: attr.status,
        },
      });
  }

  // 2. Identify scheme file path
  let samplePath = "data/government_welfare_schemes.json";
  if (!fs.existsSync(samplePath)) {
    if (fs.existsSync("../government_welfare_schemes.json")) {
      samplePath = "../government_welfare_schemes.json";
    }
  }

  const prereqPath = "data/document_prerequisites.json";

  console.log(`Ingesting sample dataset from: ${samplePath}`);
  const report = await IngestionPipeline.ingest(samplePath, {
    prerequisitesPath: fs.existsSync(prereqPath) ? prereqPath : undefined,
    dryRun: false,
  });

  console.log(
    `Seed finished: ${report.accepted_count} schemes accepted, ${report.rejected_count} rejected, ${report.skipped_count} skipped.`
  );
  console.log(`Total reported issues: ${report.issues.length}`);

  // 3. Seed rejection reasons
  console.log("Seeding rejection reasons taxonomy...");
  for (const reason of REJECTION_REASONS) {
    await db
      .insert(schema.rejectionReasons)
      .values({
        code: reason.code,
        text: reason.text,
        mapped_attribute: reason.mapped_attribute,
      })
      .onConflictDoUpdate({
        target: schema.rejectionReasons.code,
        set: {
          text: reason.text,
          mapped_attribute: reason.mapped_attribute,
        },
      });
  }

  // 4. Seed profile sections & fields
  console.log("Seeding profile sections and fields...");
  const secResult = await ProfileSectionsService.seedProfileSections();
  console.log(`Seeded ${secResult.sectionsCount} sections with ${secResult.fieldsCount} fields.`);
  if (secResult.warnings.length > 0) {
    console.warn("Profile section seed warnings:", secResult.warnings);
  }

  await closeDb();
}

seed()
  .then(() => {
    console.log("Seed completed successfully.");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await closeDb();
    process.exit(1);
  });
