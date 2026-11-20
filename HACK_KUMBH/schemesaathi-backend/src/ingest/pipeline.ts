import crypto from "crypto";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db, initDb } from "../db/index.js";
import * as schema from "../db/schema.js";
import { AttributeNormalizer } from "../engine/normalizer.js";
import { RuleCompiler } from "../engine/rule-compiler.js";
import { rulesCache } from "../services/cache.js";
import { GeoScopeResolver, DistrictRecord, BUILTIN_GEO_TOKENS } from "./geography.js";
import { TranslationChecker } from "./translation-check.js";
import { IngestReport, ValidationIssue } from "./types.js";
import {
  DocumentPrerequisitesSchema,
  SchemeSchema,
  validatePrerequisitesDag,
} from "./validator.js";

export interface IngestOptions {
  dryRun?: boolean;
  prerequisitesPath?: string;
}

export class IngestionPipeline {
  /**
   * Main entry point to ingest data from a file path, directory path, or raw object.
   */
  static async ingest(
    target: string | Record<string, unknown>,
    options: IngestOptions = {}
  ): Promise<IngestReport> {
    await initDb();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dryRun = options.dryRun ?? false;
    const issues: ValidationIssue[] = [];

    let totalSchemes = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    let skippedCount = 0;

    let bundleData: Record<string, unknown> = {};

    // 1. Resolve input source
    if (typeof target === "string") {
      const resolvedPath = path.resolve(target);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Target path does not exist: ${resolvedPath}`);
      }

      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        // Directory of scheme files
        const schemeFiles = fs
          .readdirSync(resolvedPath)
          .filter((f) => f.endsWith(".json"));
        const dirSchemes: unknown[] = [];
        for (const file of schemeFiles) {
          try {
            const content = fs.readFileSync(path.join(resolvedPath, file), "utf8");
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              dirSchemes.push(...parsed);
            } else if (parsed.schemes && Array.isArray(parsed.schemes)) {
              dirSchemes.push(...parsed.schemes);
            } else {
              dirSchemes.push(parsed);
            }
          } catch (err: unknown) {
            issues.push({
              severity: "error",
              code: "FILE_READ_ERROR",
              message: `Failed to read/parse ${file}: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
        bundleData = { schemes: dirSchemes };
      } else {
        // Single JSON file
        const content = fs.readFileSync(resolvedPath, "utf8");
        bundleData = JSON.parse(content);
      }
    } else {
      bundleData = target;
    }

    // 2. Load districts and reference tables first so geography and references can resolve
    let knownDistricts: DistrictRecord[] = [];
    if (Array.isArray(bundleData.districts) && bundleData.districts.length > 0) {
      if (!dryRun) {
        for (const d of bundleData.districts as Array<Record<string, unknown>>) {
          await db
            .insert(schema.districts)
            .values({
              district_id: String(d.district_id),
              district_name: String(d.district_name),
              state: String(d.state),
              division: d.division ? String(d.division) : null,
              is_vidarbha: Boolean(d.is_vidarbha),
              portal_url: d.portal_url ? String(d.portal_url) : null,
            })
            .onConflictDoUpdate({
              target: schema.districts.district_id,
              set: {
                district_name: String(d.district_name),
                state: String(d.state),
                division: d.division ? String(d.division) : null,
                is_vidarbha: Boolean(d.is_vidarbha),
                portal_url: d.portal_url ? String(d.portal_url) : null,
              },
            });
        }
      }
      knownDistricts = (bundleData.districts as Array<Record<string, unknown>>).map((d) => ({
        district_id: String(d.district_id),
        district_name: String(d.district_name),
        state: String(d.state),
        is_vidarbha: Boolean(d.is_vidarbha),
      }));
    } else {
      const existing = await db.select().from(schema.districts);
      knownDistricts = existing.map((d) => ({
        district_id: d.district_id,
        district_name: d.district_name,
        state: d.state,
        is_vidarbha: Boolean(d.is_vidarbha),
      }));
    }

    // Upsert other reference tables if provided
    if (!dryRun) {
      // Upsert built-in geo scope tokens
      for (const tokenDef of BUILTIN_GEO_TOKENS) {
        const resolvedIds = tokenDef.resolveDistricts(knownDistricts);
        await db
          .insert(schema.geoScopeTokens)
          .values({
            token: tokenDef.token,
            resolved_district_ids: resolvedIds,
            states: tokenDef.states,
            description: tokenDef.description,
          })
          .onConflictDoUpdate({
            target: schema.geoScopeTokens.token,
            set: {
              resolved_district_ids: resolvedIds,
              states: tokenDef.states,
              description: tokenDef.description,
            },
          });
      }

      if (Array.isArray(bundleData.departments)) {
        for (const dept of bundleData.departments as Array<Record<string, unknown>>) {
          await db
            .insert(schema.departments)
            .values({
              department_id: String(dept.department_id),
              department_name: String(dept.department_name),
              ministry: dept.ministry ? String(dept.ministry) : null,
              government_level: String(dept.government_level || "CENTRAL"),
              state: String(dept.state || "ALL_INDIA"),
              official_website: dept.official_website ? String(dept.official_website) : null,
              contact_details: dept.contact_details ? String(dept.contact_details) : null,
            })
            .onConflictDoUpdate({
              target: schema.departments.department_id,
              set: {
                department_name: String(dept.department_name),
                ministry: dept.ministry ? String(dept.ministry) : null,
                government_level: String(dept.government_level || "CENTRAL"),
                state: String(dept.state || "ALL_INDIA"),
                official_website: dept.official_website ? String(dept.official_website) : null,
                contact_details: dept.contact_details ? String(dept.contact_details) : null,
              },
            });
        }
      }

      if (Array.isArray(bundleData.beneficiary_categories)) {
        for (const cat of bundleData.beneficiary_categories as Array<Record<string, unknown>>) {
          await db
            .insert(schema.beneficiaryCategories)
            .values({
              category_id: String(cat.category_id),
              name: String(cat.name),
              name_hi: cat.name_hi ? String(cat.name_hi) : null,
              name_mr: cat.name_mr ? String(cat.name_mr) : null,
            })
            .onConflictDoUpdate({
              target: schema.beneficiaryCategories.category_id,
              set: {
                name: String(cat.name),
                name_hi: cat.name_hi ? String(cat.name_hi) : null,
                name_mr: cat.name_mr ? String(cat.name_mr) : null,
              },
            });
        }
      }

      if (Array.isArray(bundleData.documents)) {
        for (const doc of bundleData.documents as Array<Record<string, unknown>>) {
          await db
            .insert(schema.documents)
            .values({
              document_id: String(doc.document_id),
              official_document_name: String(doc.official_document_name),
              simple_explanation_en: doc.simple_explanation_en ? String(doc.simple_explanation_en) : null,
              simple_explanation_hi: doc.simple_explanation_hi ? String(doc.simple_explanation_hi) : null,
              simple_explanation_mr: doc.simple_explanation_mr ? String(doc.simple_explanation_mr) : null,
              issuing_authority: doc.issuing_authority ? String(doc.issuing_authority) : null,
              application_portal: doc.application_portal ? String(doc.application_portal) : null,
              validity_period: doc.validity_period ? String(doc.validity_period) : null,
              renewal_requirements: Boolean(doc.renewal_requirements),
              accepted_digital_formats: doc.accepted_digital_formats as string[],
              alternative_documents: doc.alternative_documents as string[],
              applicable_schemes: doc.applicable_schemes as string[],
            })
            .onConflictDoUpdate({
              target: schema.documents.document_id,
              set: {
                official_document_name: String(doc.official_document_name),
                simple_explanation_en: doc.simple_explanation_en ? String(doc.simple_explanation_en) : null,
                simple_explanation_hi: doc.simple_explanation_hi ? String(doc.simple_explanation_hi) : null,
                simple_explanation_mr: doc.simple_explanation_mr ? String(doc.simple_explanation_mr) : null,
                issuing_authority: doc.issuing_authority ? String(doc.issuing_authority) : null,
                application_portal: doc.application_portal ? String(doc.application_portal) : null,
                validity_period: doc.validity_period ? String(doc.validity_period) : null,
                renewal_requirements: Boolean(doc.renewal_requirements),
                accepted_digital_formats: doc.accepted_digital_formats as string[],
                alternative_documents: doc.alternative_documents as string[],
                applicable_schemes: doc.applicable_schemes as string[],
              },
            });
        }
      }

      if (Array.isArray(bundleData.help_centres)) {
        for (const hc of bundleData.help_centres as Array<Record<string, unknown>>) {
          if (hc.latitude === null || hc.longitude === null) {
            issues.push({
              field: "help_centres.coordinates",
              severity: "info",
              code: "MISSING_COORDINATES",
              message: `Help centre ${String(hc.help_centre_id)} has null latitude/longitude`,
            });
          }
          await db
            .insert(schema.helpCentres)
            .values({
              help_centre_id: String(hc.help_centre_id),
              centre_name: String(hc.centre_name),
              centre_type: String(hc.centre_type),
              state: String(hc.state),
              district: String(hc.district),
              taluka: hc.taluka ? String(hc.taluka) : null,
              village_ward: hc.village_ward ? String(hc.village_ward) : null,
              complete_address: hc.complete_address ? String(hc.complete_address) : null,
              latitude: typeof hc.latitude === "number" ? hc.latitude : null,
              longitude: typeof hc.longitude === "number" ? hc.longitude : null,
              available_services: hc.available_services as string[],
              supported_schemes: hc.supported_schemes as string[],
              phone: hc.phone ? String(hc.phone) : null,
              email: hc.email ? String(hc.email) : null,
              working_hours: hc.working_hours ? String(hc.working_hours) : null,
              source_url: hc.source_url ? String(hc.source_url) : null,
              last_verified: hc.last_verified ? String(hc.last_verified) : null,
            })
            .onConflictDoUpdate({
              target: schema.helpCentres.help_centre_id,
              set: {
                centre_name: String(hc.centre_name),
                centre_type: String(hc.centre_type),
                state: String(hc.state),
                district: String(hc.district),
                taluka: hc.taluka ? String(hc.taluka) : null,
                village_ward: hc.village_ward ? String(hc.village_ward) : null,
                complete_address: hc.complete_address ? String(hc.complete_address) : null,
                latitude: typeof hc.latitude === "number" ? hc.latitude : null,
                longitude: typeof hc.longitude === "number" ? hc.longitude : null,
                available_services: hc.available_services as string[],
                supported_schemes: hc.supported_schemes as string[],
                phone: hc.phone ? String(hc.phone) : null,
                email: hc.email ? String(hc.email) : null,
                working_hours: hc.working_hours ? String(hc.working_hours) : null,
                source_url: hc.source_url ? String(hc.source_url) : null,
                last_verified: hc.last_verified ? String(hc.last_verified) : null,
              },
            });
        }
      }

      if (Array.isArray(bundleData.official_portals)) {
        for (const p of bundleData.official_portals as Array<Record<string, unknown>>) {
          await db
            .insert(schema.officialPortals)
            .values({
              portal_id: String(p.portal_id),
              name: String(p.name),
              url: String(p.url),
              level: String(p.level),
              supports_tracking: Boolean(p.supports_tracking),
            })
            .onConflictDoUpdate({
              target: schema.officialPortals.portal_id,
              set: {
                name: String(p.name),
                url: String(p.url),
                level: String(p.level),
                supports_tracking: Boolean(p.supports_tracking),
              },
            });
        }
      }

      if (Array.isArray(bundleData.application_tracking_methods)) {
        for (const m of bundleData.application_tracking_methods as Array<Record<string, unknown>>) {
          await db
            .insert(schema.applicationTrackingMethods)
            .values({
              method_code: String(m.method_code),
              description: String(m.description),
            })
            .onConflictDoUpdate({
              target: schema.applicationTrackingMethods.method_code,
              set: { description: String(m.description) },
            });
        }
      }

      if (Array.isArray(bundleData.source_registry)) {
        for (const s of bundleData.source_registry as Array<Record<string, unknown>>) {
          await db
            .insert(schema.sourceRegistry)
            .values({
              source_id: String(s.source_id),
              source_name: String(s.source_name),
              government_department: s.government_department ? String(s.government_department) : null,
              source_type: String(s.source_type),
              url: s.url ? String(s.url) : null,
              date_accessed: s.date_accessed ? String(s.date_accessed) : null,
              schemes_supported: s.schemes_supported as string[],
              verification_status: s.verification_status ? String(s.verification_status) : "UNVERIFIED",
            })
            .onConflictDoUpdate({
              target: schema.sourceRegistry.source_id,
              set: {
                source_name: String(s.source_name),
                government_department: s.government_department ? String(s.government_department) : null,
                source_type: String(s.source_type),
                url: s.url ? String(s.url) : null,
                date_accessed: s.date_accessed ? String(s.date_accessed) : null,
                schemes_supported: s.schemes_supported as string[],
                verification_status: s.verification_status ? String(s.verification_status) : "UNVERIFIED",
              },
            });
        }
      }
    }

    // 3. Process optional document prerequisites DAG
    const prereqPath = options.prerequisitesPath || "data/document_prerequisites.json";
    if (fs.existsSync(prereqPath)) {
      try {
        const prereqContent = fs.readFileSync(prereqPath, "utf8");
        const parsedPrereqs = JSON.parse(prereqContent);
        const validPrereqs = DocumentPrerequisitesSchema.parse(parsedPrereqs);
        const dagCheck = validatePrerequisitesDag(validPrereqs);

        if (!dagCheck.valid) {
          issues.push({
            field: "document_prerequisites",
            severity: "error",
            code: "DAG_CYCLE_ERROR",
            message: dagCheck.error || "Cycle detected in document prerequisites",
          });
        } else if (!dryRun) {
          for (const item of validPrereqs) {
            for (const reqDocId of item.requires_document_ids) {
              await db.insert(schema.documentPrerequisites).values({
                document_id: item.document_id,
                requires_document_id: reqDocId,
                note: item.note,
              });
            }
          }
        }
      } catch (err: unknown) {
        issues.push({
          field: "document_prerequisites",
          severity: "error",
          code: "PREREQUISITES_PARSE_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. Resolve Schemes list
    let rawSchemes: unknown[] = [];
    if (Array.isArray(bundleData.schemes)) {
      rawSchemes = bundleData.schemes;
    } else if (bundleData.scheme_id) {
      rawSchemes = [bundleData];
    }

    totalSchemes = rawSchemes.length;
    const geoResolver = new GeoScopeResolver(knownDistricts);

    // Collect all scheme IDs in this bundle for dangling parent check
    const currentBundleSchemeIds = new Set<string>();
    for (const s of rawSchemes) {
      if (s && typeof s === "object" && "scheme_id" in s && typeof (s as Record<string, unknown>).scheme_id === "string") {
        currentBundleSchemeIds.add(String((s as Record<string, unknown>).scheme_id));
      }
    }

    // 5. Ingest each scheme with strict error isolation
    for (const rawScheme of rawSchemes) {
      let schemeId = (rawScheme && typeof rawScheme === "object" && "scheme_id" in rawScheme)
        ? String((rawScheme as Record<string, unknown>).scheme_id)
        : "UNKNOWN";
      try {
        // Validate with Zod (preserves unknown fields)
        const scheme = SchemeSchema.parse(rawScheme);
        schemeId = scheme.scheme_id;

        // Content Hash for idempotency
        const contentStr = JSON.stringify(scheme);
        const contentHash = crypto.createHash("sha256").update(contentStr).digest("hex");

        // Check if scheme exists in DB
        const existing = await db
          .select({
            scheme_id: schema.schemes.scheme_id,
            content_hash: schema.schemes.content_hash,
            version: schema.schemes.version,
          })
          .from(schema.schemes)
          .where(eq(schema.schemes.scheme_id, schemeId))
          .limit(1);

        // Audits & Checks:
        // A. Dangling parent scheme
        if (scheme.parent_scheme_id) {
          if (!currentBundleSchemeIds.has(scheme.parent_scheme_id)) {
            // Check DB
            const parentInDb = await db
              .select({ scheme_id: schema.schemes.scheme_id })
              .from(schema.schemes)
              .where(eq(schema.schemes.scheme_id, scheme.parent_scheme_id))
              .limit(1);

            if (parentInDb.length === 0) {
              issues.push({
                scheme_id: schemeId,
                field: "parent_scheme_id",
                severity: "warn",
                code: "DANGLING_PARENT_SCHEME",
                message: `Parent scheme '${scheme.parent_scheme_id}' was not found in the bundle or database`,
                details: { parent_scheme_id: scheme.parent_scheme_id },
              });
            }
          }
        }

        // B. Translation quality checks
        const nameAudit = TranslationChecker.auditMultilingualField("translated_names", scheme.translated_names);
        const explAudit = TranslationChecker.auditMultilingualField(
          "overview.simple_explanation",
          scheme.overview?.simple_explanation
        );

        for (const iss of [...nameAudit.issues, ...explAudit.issues]) {
          issues.push({
            scheme_id: schemeId,
            field: iss.field,
            severity: "warn",
            code: "TRANSLATION_QUALITY_ISSUE",
            message: `${iss.reason} for field '${iss.field}' in language '${iss.lang}'`,
          });
        }

        // C. Geo tokens resolution
        const geoResult = geoResolver.resolve(
          schemeId,
          scheme.scheme_classification?.implementing_state,
          scheme.scheme_classification?.implementing_districts
        );
        for (const geoIssue of geoResult.issues) issues.push(geoIssue);

        // D. Operational checks
        const lastVerified = scheme.operational_status?.last_verified;
        if (lastVerified) {
          const verifiedDate = new Date(lastVerified);
          const diffDays = (Date.now() - verifiedDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > config.staleDays) {
            issues.push({
              scheme_id: schemeId,
              field: "operational_status.last_verified",
              severity: "warn",
              code: "STALE_VERIFICATION",
              message: `Last verified date (${lastVerified}) is older than ${config.staleDays} days`,
            });
          }
        } else {
          issues.push({
            scheme_id: schemeId,
            field: "operational_status.last_verified",
            severity: "warn",
            code: "MISSING_VERIFICATION_DATE",
            message: "Missing last_verified date on operational_status",
          });
        }

        if (scheme.data_completeness === "PARTIAL") {
          issues.push({
            scheme_id: schemeId,
            field: "data_completeness",
            severity: "warn",
            code: "PARTIAL_COMPLETENESS",
            message: "Scheme data completeness is marked as PARTIAL",
          });
        }

        if (scheme.operational_status?.accepting_applications !== "YES") {
          issues.push({
            scheme_id: schemeId,
            field: "operational_status.accepting_applications",
            severity: "info",
            code: "NON_STANDARD_ACCEPTING_STATUS",
            message: `Accepting applications status is '${scheme.operational_status?.accepting_applications}'`,
          });
        }

        // E. Attribute normalisation & Auto-registration of unknown attributes
        const rawRules = scheme.eligibility?.rules || [];
        for (const r of rawRules) {
          const norm = AttributeNormalizer.normalize(r.attribute);
          const canon = norm.canonicalAttribute;

          // Check if attribute exists in DB
          const existingAttr = await db
            .select({ key: schema.attributes.key })
            .from(schema.attributes)
            .where(eq(schema.attributes.key, canon))
            .limit(1);

          if (existingAttr.length === 0) {
            // Auto-register attribute immediately!
            const scope = AttributeNormalizer.inferScope(canon);
            const valueType = AttributeNormalizer.inferValueType(canon, r.value);
            const generatedQuestion = r.explanation
              ? `${r.explanation}?`
              : `What is your ${canon.replace(/_/g, " ")}?`;

            if (!dryRun) {
              await db
                .insert(schema.attributes)
                .values({
                  key: canon,
                  scope,
                  value_type: valueType,
                  question_text: {
                    en: generatedQuestion,
                    hi: generatedQuestion,
                    mr: generatedQuestion,
                  },
                  help_text: r.explanation ? { en: r.explanation } : undefined,
                  review_status: "machine_drafted",
                  help_text_source: r.explanation ? "dataset" : "unverified",
                  derived_from: `${schemeId}.eligibility.rules.${r.attribute}`,
                  status: "auto_registered",
                })
                .onConflictDoNothing();
            }

            issues.push({
              scheme_id: schemeId,
              field: `eligibility.rules.${r.rule_id}`,
              severity: "info",
              code: "AUTO_REGISTERED_ATTRIBUTE",
              message: `Attribute '${canon}' was unregistered and has been auto-registered with status 'auto_registered'`,
              details: { attribute: canon, scope, valueType },
            });
          }
        }

        // F. Compile Rules into AST
        const compiledRules = RuleCompiler.compile({
          scheme_id: schemeId,
          parent_scheme_id: scheme.parent_scheme_id || undefined,
          operational_status: scheme.operational_status,
          eligibility: scheme.eligibility,
          scheme_classification: scheme.scheme_classification
            ? {
                implementing_state: scheme.scheme_classification.implementing_state || undefined,
                implementing_districts: scheme.scheme_classification.implementing_districts,
              }
            : undefined,
          area_type: geoResult.area_type || "ALL",
          excluded_talukas: geoResult.excluded_talukas,
          included_talukas: geoResult.included_talukas,
          benefit_type: scheme.benefits?.benefit_type || undefined,
          non_stackable_with: scheme.non_stackable_with,
          benefit_cap: scheme.benefit_cap,
          resolved_district_ids: geoResult.district_ids,
          resolved_states: geoResult.states,
        });

        // Check content hash: unchanged = skip upsert
        if (existing.length > 0 && existing[0]?.content_hash === contentHash) {
          skippedCount++;
          continue;
        }

        // G. Upsert Scheme and preserve history
        if (!dryRun) {
          const currentVersion = existing.length > 0 && existing[0]?.version ? existing[0].version + 1 : 1;

          if (existing.length > 0) {
            // Archive current version into scheme_versions
            const prev = await db
              .select()
              .from(schema.schemes)
              .where(eq(schema.schemes.scheme_id, schemeId))
              .limit(1);

            if (prev[0]) {
              await db.insert(schema.schemeVersions).values({
                scheme_id: schemeId,
                version: prev[0].version,
                content_hash: prev[0].content_hash,
                raw: prev[0].raw,
              });
            }
          }

          const translationStatusMap: Record<string, { en: string; hi: string; mr: string }> = {
            translated_names: nameAudit.status,
            simple_explanation: explAudit.status,
          };

          const cleanTranslatedNames = {
            en: scheme.translated_names.en,
            hi: scheme.translated_names.hi || undefined,
            mr: scheme.translated_names.mr || undefined,
          };

          const isTest = Boolean(
            (rawScheme as Record<string, unknown>).is_test ??
            (scheme as unknown as Record<string, unknown>).is_test ??
            false
          );

          await db
            .insert(schema.schemes)
            .values({
              scheme_id: schemeId,
              parent_scheme_id: scheme.parent_scheme_id || null,
              official_name: scheme.official_name,
              translated_names: cleanTranslatedNames,
              level: scheme.scheme_classification?.level || "CENTRAL",
              scheme_type: scheme.scheme_classification?.scheme_type || "WELFARE",
              implementing_state: scheme.scheme_classification?.implementing_state || null,
              department_id: scheme.scheme_classification?.department_id || null,
              overview: scheme.overview,
              benefits: scheme.benefits,
              raw: scheme as unknown as Record<string, unknown>,
              compiled_rules: compiledRules as unknown as Record<string, unknown>,
              min_age: compiledRules.hard_filters.min_age,
              max_age: compiledRules.hard_filters.max_age,
              min_income: compiledRules.hard_filters.min_income,
              max_income: compiledRules.hard_filters.max_income,
              allowed_genders: compiledRules.hard_filters.allowed_genders,
              states: compiledRules.hard_filters.states,
              district_ids: compiledRules.hard_filters.district_ids,
              area_type: geoResult.area_type || "ALL",
              non_stackable_with: scheme.non_stackable_with || null,
              benefit_cap: scheme.benefit_cap || null,
              benefit_type: scheme.benefits?.benefit_type,
              beneficiary_categories: scheme.overview?.beneficiary_categories,
              status: scheme.operational_status?.status || "ACTIVE",
              accepting_applications: scheme.operational_status?.accepting_applications || "YES",
              last_verified: scheme.operational_status?.last_verified || null,
              confidence_level: scheme.confidence_level || null,
              data_completeness: scheme.data_completeness || null,
              translation_status: translationStatusMap,
              is_test: isTest,
              content_hash: contentHash,
              version: currentVersion,
              updated_at: new Date(),
            })
            .onConflictDoUpdate({
              target: schema.schemes.scheme_id,
              set: {
                parent_scheme_id: scheme.parent_scheme_id || null,
                official_name: scheme.official_name,
                translated_names: cleanTranslatedNames,
                level: scheme.scheme_classification?.level || "CENTRAL",
                scheme_type: scheme.scheme_classification?.scheme_type || "WELFARE",
                implementing_state: scheme.scheme_classification?.implementing_state || null,
                department_id: scheme.scheme_classification?.department_id || null,
                overview: scheme.overview,
                benefits: scheme.benefits,
                raw: scheme as unknown as Record<string, unknown>,
                compiled_rules: compiledRules as unknown as Record<string, unknown>,
                min_age: compiledRules.hard_filters.min_age,
                max_age: compiledRules.hard_filters.max_age,
                min_income: compiledRules.hard_filters.min_income,
                max_income: compiledRules.hard_filters.max_income,
                allowed_genders: compiledRules.hard_filters.allowed_genders,
                states: compiledRules.hard_filters.states,
                district_ids: compiledRules.hard_filters.district_ids,
                area_type: geoResult.area_type || "ALL",
                non_stackable_with: scheme.non_stackable_with || null,
                benefit_cap: scheme.benefit_cap || null,
                benefit_type: scheme.benefits?.benefit_type,
                beneficiary_categories: scheme.overview?.beneficiary_categories,
                status: scheme.operational_status?.status || "ACTIVE",
                accepting_applications: scheme.operational_status?.accepting_applications || "YES",
                last_verified: scheme.operational_status?.last_verified || null,
                confidence_level: scheme.confidence_level || null,
                data_completeness: scheme.data_completeness || null,
                translation_status: translationStatusMap,
                is_test: isTest,
                content_hash: contentHash,
                version: currentVersion,
                updated_at: new Date(),
              },
            });
        }

        acceptedCount++;
      } catch (err: unknown) {
        rejectedCount++;
        issues.push({
          scheme_id: schemeId,
          severity: "error",
          code: "SCHEME_REJECTED",
          message: err instanceof Error ? err.message : String(err),
          details: err,
        });
      }
    }

    // Invalidate in-memory rules cache
    rulesCache.invalidate();

    const report: IngestReport = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      total_schemes: totalSchemes,
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
      skipped_count: skippedCount,
      issues,
    };

    // Log run in DB
    if (!dryRun) {
      await db.insert(schema.ingestRuns).values({
        run_id: runId,
        dry_run: dryRun,
        status: rejectedCount === 0 ? "SUCCESS" : acceptedCount > 0 ? "PARTIAL" : "FAILED",
        total_schemes: totalSchemes,
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        skipped_count: skippedCount,
        reports: report as unknown as Record<string, unknown>,
        finished_at: new Date(),
      });
    }

    return report;
  }
}
