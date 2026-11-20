import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initDb, db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { parseCsv } from "./csv-parser.js";
import { eq } from "drizzle-orm";
import { rulesCache } from "../services/cache.js";

export interface DatasetImportSummary {
  schemesImported: number;
  schemesLinked: number;
  faqsImported: number;
  districtMappingsImported: number;
}

export class DatasetImporter {
  static async importAll(datasetDir: string): Promise<DatasetImportSummary> {
    await initDb();

    console.log(`[DatasetImporter] Starting dataset import from: ${datasetDir}`);
    const summary: DatasetImportSummary = {
      schemesImported: 0,
      schemesLinked: 0,
      faqsImported: 0,
      districtMappingsImported: 0,
    };

    // 1. Import Vidarbha District Mappings
    const districtMappingFile = path.join(datasetDir, "vidarbha_scheme_district_mapping.csv");
    if (fs.existsSync(districtMappingFile)) {
      console.log("[DatasetImporter] Importing Vidarbha district mappings...");
      const rows = parseCsv(fs.readFileSync(districtMappingFile, "utf-8"));

      // Clean existing mappings first to avoid duplicate insertion
      await db.delete(schema.vidarbhaSchemeDistricts);

      const batchSize = 250;
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const values = chunk.map((r) => ({
          district_id: r.district_id || "DIST_MH_NGP",
          district: r.district || "Nagpur",
          scheme_id: r.scheme_id || "",
          scheme_name: r.scheme_name || "",
          coverage: r.coverage || "STATEWIDE_INCLUDES_DISTRICT",
          portal: r.portal || null,
          application_mode: r.application_mode || "Online",
        }));
        await db.insert(schema.vidarbhaSchemeDistricts).values(values);
      }
      summary.districtMappingsImported = rows.length;
      console.log(`[DatasetImporter] Imported ${rows.length} district-scheme mappings.`);
    }

    // 2. Import FAQs (Central + Maharashtra)
    const faqFiles = [
      path.join(datasetDir, "central_scheme_faqs.csv"),
      path.join(datasetDir, "maharashtra_scheme_faqs.csv"),
    ];

    let totalFaqs = 0;
    // Clear old FAQs
    await db.delete(schema.schemeFaqs);

    for (const faqFile of faqFiles) {
      if (fs.existsSync(faqFile)) {
        console.log(`[DatasetImporter] Importing FAQs from ${path.basename(faqFile)}...`);
        const rows = parseCsv(fs.readFileSync(faqFile, "utf-8"));
        const batchSize = 250;

        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          const values = chunk.map((r) => ({
            scheme_id: r.scheme_id || "",
            scheme_name: r.scheme_name || null,
            faq_number: parseInt(r.faq_number || "0", 10) || null,
            question: r.question || "",
            answer: r.answer || "",
          })).filter((f) => f.question.length > 0 && f.answer.length > 0);

          if (values.length > 0) {
            await db.insert(schema.schemeFaqs).values(values);
          }
        }
        totalFaqs += rows.length;
      }
    }
    summary.faqsImported = totalFaqs;
    console.log(`[DatasetImporter] Imported ${totalFaqs} total scheme FAQs.`);

    // 3. Import & Enrich Schemes
    const schemeFiles = [
      { file: path.join(datasetDir, "maharashtra_vidarbha_schemes_master.csv"), defaultLevel: "STATE" },
      { file: path.join(datasetDir, "central_schemes_master.csv"), defaultLevel: "CENTRAL" },
    ];

    // Fetch existing curated schemes
    const existingSchemes = await db.select().from(schema.schemes);
    const existingIds = new Set(existingSchemes.map((s) => s.scheme_id));

    let newSchemesCount = 0;
    let linkedSchemesCount = 0;

    for (const { file, defaultLevel } of schemeFiles) {
      if (!fs.existsSync(file)) continue;
      console.log(`[DatasetImporter] Ingesting schemes from ${path.basename(file)}...`);
      const rows = parseCsv(fs.readFileSync(file, "utf-8"));

      for (const row of rows) {
        const rawId = row.scheme_id?.trim();
        if (!rawId) continue;

        const curatedId = row.curated_scheme_id?.trim();

        // If this row matches an already curated gold-standard scheme, enrich it with myscheme_id
        if (curatedId && existingIds.has(curatedId)) {
          await db
            .update(schema.schemes)
            .set({ myscheme_id: rawId })
            .where(eq(schema.schemes.scheme_id, curatedId));
          linkedSchemesCount++;
          continue;
        }

        // If already in DB under this ID, skip to avoid overwriting
        if (existingIds.has(rawId)) {
          continue;
        }

        // Parse numeric thresholds
        const minAge = parseInt(row.age_min || "", 10) || null;
        const maxAge = parseInt(row.age_max || "", 10) || null;
        const maxIncome = parseInt(row.income_limit_annual_inr || "", 10) || null;

        // Gender filter
        let genders: string[] | undefined = undefined;
        if (row.gender_eligibility) {
          const g = row.gender_eligibility.toUpperCase();
          if (g.includes("FEMALE")) genders = ["FEMALE"];
          else if (g.includes("MALE")) genders = ["MALE"];
          else if (g.includes("ALL")) genders = ["ALL"];
        }

        // Area type heuristic
        let areaType = "ALL";
        const tags = (row.tags || "").toLowerCase();
        const cats = (row.categories || "").toLowerCase();
        if (tags.includes("urban") || cats.includes("urban")) areaType = "URBAN";
        else if (tags.includes("rural") || cats.includes("rural")) areaType = "RURAL";

        // States
        const schemeState = row.state?.trim() || (defaultLevel === "CENTRAL" ? "ALL_INDIA" : "Maharashtra");

        // District IDs
        const dists = row.implementing_districts
          ? row.implementing_districts.split(",").map((d) => d.trim()).filter((d) => d.length > 0)
          : [];

        // Build overview
        const overview = {
          objective: row.brief_description || row.detailed_description || row.scheme_name,
          simple_explanation: {
            en: row.brief_description || row.scheme_name,
            hi: row.name_hi || row.scheme_name,
            mr: row.name_mr || row.scheme_name,
          },
          beneficiary_categories: row.categories ? [row.categories] : [],
          target_population: row.target_beneficiaries || null,
        };

        const benefits = {
          benefit_type: row.benefit_type || "CASH",
          amount: parseInt(row.benefit_amount_max_inr || row.benefit_amount_min_inr || "0", 10) || 0,
          frequency: row.benefit_frequency || "ONE_TIME",
          coverage_details: row.benefits || "",
        };

        const contentHash = crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex");

        const compiledRules = {
          scheme_id: rawId,
          status: "ACTIVE",
          accepting_applications: row.accepting_applications === "NO" ? "NO" : "YES",
          hard_filters: {
            min_age: minAge || undefined,
            max_age: maxAge || undefined,
            max_income: maxIncome || undefined,
            allowed_genders: genders,
            states: [schemeState],
            district_ids: dists.length > 0 ? dists : undefined,
          },
          rules: [],
          exclusions: row.exclusions ? [row.exclusions] : [],
        };

        const cleanName = (row.scheme_name || rawId).substring(0, 250);
        await db.insert(schema.schemes).values({
          scheme_id: rawId.substring(0, 120),
          myscheme_id: rawId.substring(0, 120),
          official_name: cleanName,
          translated_names: {
            en: cleanName,
            hi: (row.name_hi || cleanName).substring(0, 250),
            mr: (row.name_mr || cleanName).substring(0, 250),
          },
          level: (row.level?.toUpperCase() === "CENTRAL" || defaultLevel === "CENTRAL") ? "CENTRAL" : "STATE",
          scheme_type: (row.beneficiary_type || "WELFARE").substring(0, 120),
          implementing_state: schemeState.substring(0, 120),
          department_id: (row.department || row.ministry || "GENERAL").substring(0, 250),
          overview,
          benefits,
          raw: row,
          compiled_rules: compiledRules,
          min_age: minAge,
          max_age: maxAge,
          min_income: null,
          max_income: maxIncome,
          allowed_genders: genders,
          states: [schemeState],
          district_ids: dists,
          area_type: areaType,
          benefit_type: (row.benefit_type || "CASH").substring(0, 120),
          beneficiary_categories: row.categories ? [row.categories] : [],
          status: "ACTIVE",
          accepting_applications: row.accepting_applications === "NO" ? "NO" : "YES",
          last_verified: (row.curated_last_verified || "2026-11-19").substring(0, 30),
          confidence_level: (row.data_confidence || "MODERATE").substring(0, 30),
          data_completeness: row.needs_verification === "TRUE" ? "PARTIAL" : "COMPLETE",
          translation_status: {
            official_name: { en: "ok", hi: row.name_hi ? "ok" : "missing", mr: row.name_mr ? "ok" : "missing" },
            simple_explanation: { en: "ok", hi: row.name_hi ? "ok" : "missing", mr: row.name_mr ? "ok" : "missing" },
          },
          source: "imported",
          verified: false,
          content_hash: contentHash,
          version: 1,
          is_test: false,
        });

        existingIds.add(rawId);
        newSchemesCount++;
      }
    }

    summary.schemesImported = newSchemesCount;
    summary.schemesLinked = linkedSchemesCount;

    // Refresh cache with full dataset
    rulesCache.invalidate();
    console.log(`[DatasetImporter] Ingestion complete. ${newSchemesCount} new schemes, ${linkedSchemesCount} curated schemes linked.`);
    return summary;
  }
}
