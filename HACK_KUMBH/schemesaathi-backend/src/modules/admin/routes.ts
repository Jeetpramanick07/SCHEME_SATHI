import path from "path";
import { FastifyPluginAsync } from "fastify";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { IngestionPipeline } from "../../ingest/pipeline.js";
import { DatasetImporter } from "../../ingest/dataset-importer.js";
import { requireRole } from "../../services/auth.js";
import { REJECTION_REASONS } from "../../seed/rejection-reasons.js";
import { z } from "zod";

const AdminIngestBodySchema = z.object({
  dry_run: z.boolean().default(false),
  target_path: z.string().optional(),
  bundle: z.record(z.unknown()).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Enforce admin role for all admin routes
  fastify.addHook("preHandler", requireRole(["admin"]));

  // POST /admin/ingest
  fastify.post("/admin/ingest", async (request, reply) => {
    const body = AdminIngestBodySchema.parse(request.body || {});
    const target = body.bundle || body.target_path || "data/government_welfare_schemes.json";

    const report = await IngestionPipeline.ingest(target, {
      dryRun: body.dry_run,
    });

    return reply.status(report.rejected_count > 0 && report.accepted_count === 0 ? 400 : 200).send(report);
  });

  // GET /admin/ingest-runs/:id
  fastify.get("/admin/ingest-runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await db
      .select()
      .from(schema.ingestRuns)
      .where(eq(schema.ingestRuns.run_id, id))
      .limit(1);

    if (!run[0]) {
      return reply.status(404).send({
        error: { code: "RUN_NOT_FOUND", message: `Ingest run '${id}' not found` },
      });
    }

    return run[0];
  });

  // GET /admin/pending-reviews
  fastify.get("/admin/pending-reviews", async (_request, reply) => {
    const pendingAttrs = await db
      .select({
        key: schema.attributes.key,
        scope: schema.attributes.scope,
        value_type: schema.attributes.value_type,
        question_text: schema.attributes.question_text,
        help_text: schema.attributes.help_text,
        help_text_source: schema.attributes.help_text_source,
        review_status: schema.attributes.review_status,
        status: schema.attributes.status,
      })
      .from(schema.attributes)
      .where(eq(schema.attributes.review_status, "machine_drafted"));

    const schemeRows = await db
      .select({
        scheme_id: schema.schemes.scheme_id,
        official_name: schema.schemes.official_name,
        translation_status: schema.schemes.translation_status,
      })
      .from(schema.schemes)
      .where(eq(schema.schemes.is_test, false));

    const pendingTranslations: Array<{
      scheme_id: string;
      official_name: string;
      issues: Array<{ field: string; lang: string; reason: string }>;
    }> = [];

    for (const s of schemeRows) {
      const transStatus = s.translation_status as Record<string, Record<string, string>> | null;
      if (transStatus) {
        const issues: Array<{ field: string; lang: string; reason: string }> = [];
        for (const [field, langs] of Object.entries(transStatus)) {
          for (const [lang, status] of Object.entries(langs)) {
            if (status === "placeholder" || status === "missing") {
              issues.push({ field, lang, reason: status });
            }
          }
        }
        if (issues.length > 0) {
          pendingTranslations.push({
            scheme_id: s.scheme_id,
            official_name: s.official_name,
            issues,
          });
        }
      }
    }

    return reply.status(200).send({
      pending_attributes: pendingAttrs,
      pending_schemes_translations: pendingTranslations,
      total_pending_count: pendingAttrs.length + pendingTranslations.length,
    });
  });

  // POST /admin/import-dataset
  fastify.post("/admin/import-dataset", async (request, reply) => {
    const body = request.body as { dataset_dir?: string } | undefined;
    const datasetDir = body?.dataset_dir || path.resolve(process.cwd(), "../DATASET");

    try {
      const summary = await DatasetImporter.importAll(datasetDir);
      return reply.status(200).send({
        success: true,
        message: "Dataset imported successfully",
        summary,
      });
    } catch (err: unknown) {
      return reply.status(500).send({
        error: {
          code: "DATASET_IMPORT_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });

  // GET /admin/district-coverage
  fastify.get("/admin/district-coverage", async (_request, reply) => {
    const rows = await db.select().from(schema.vidarbhaSchemeDistricts);

    const districtMap = new Map<string, {
      district_id: string;
      district: string;
      total_schemes: number;
      online_count: number;
      offline_count: number;
      schemes: Array<{ scheme_id: string; scheme_name: string; application_mode: string | null; portal: string | null }>;
    }>();

    for (const r of rows) {
      if (!districtMap.has(r.district_id)) {
        districtMap.set(r.district_id, {
          district_id: r.district_id,
          district: r.district,
          total_schemes: 0,
          online_count: 0,
          offline_count: 0,
          schemes: [],
        });
      }
      const entry = districtMap.get(r.district_id)!;
      entry.total_schemes++;
      if (r.application_mode?.toLowerCase().includes("online")) {
        entry.online_count++;
      } else {
        entry.offline_count++;
      }
      entry.schemes.push({
        scheme_id: r.scheme_id,
        scheme_name: r.scheme_name,
        application_mode: r.application_mode,
        portal: r.portal,
      });
    }

    const districts = Array.from(districtMap.values()).sort((a, b) => b.total_schemes - a.total_schemes);
    return reply.status(200).send({
      region: "Vidarbha (11 Districts)",
      districts,
      total_mapped_schemes: rows.length,
    });
  });

  // GET /admin/under-served-areas
  fastify.get("/admin/under-served-areas", async (_request, reply) => {
    const rows = await db.select().from(schema.vidarbhaSchemeDistricts);

    const districtStats = new Map<string, {
      district_id: string;
      district: string;
      total: number;
      offline: number;
      online: number;
    }>();

    for (const r of rows) {
      if (!districtStats.has(r.district_id)) {
        districtStats.set(r.district_id, {
          district_id: r.district_id,
          district: r.district,
          total: 0,
          offline: 0,
          online: 0,
        });
      }
      const st = districtStats.get(r.district_id)!;
      st.total++;
      if (r.application_mode?.toLowerCase().includes("online")) {
        st.online++;
      } else {
        st.offline++;
      }
    }

    const ranked = Array.from(districtStats.values()).map((d) => {
      const offlineRatio = d.total > 0 ? (d.offline / d.total) * 100 : 0;
      let frictionLevel = "LOW";
      let recommendedAction = "Maintain digital portal awareness drives.";
      if (offlineRatio > 40) {
        frictionLevel = "HIGH";
        recommendedAction = "Deploy on-ground volunteer camps & Setu Kendra mobile assistance units.";
      } else if (offlineRatio > 25) {
        frictionLevel = "MODERATE";
        recommendedAction = "Expand CSC / Maha e-Seva Kendra operator training.";
      }

      return {
        district_id: d.district_id,
        district: d.district,
        total_schemes_active: d.total,
        offline_schemes_count: d.offline,
        offline_friction_percentage: Math.round(offlineRatio),
        friction_level: frictionLevel,
        recommended_ngo_intervention: recommendedAction,
      };
    }).sort((a, b) => b.offline_friction_percentage - a.offline_friction_percentage);

    return reply.status(200).send({
      analysis_date: "2026-11-19",
      region: "Vidarbha, Maharashtra",
      districts_ranked_by_friction: ranked,
    });
  });

  // GET /admin/schemes-uptake?synthetic_only=
  fastify.get("/admin/schemes-uptake", async (request, reply) => {
    const query = request.query as { synthetic_only?: string };
    const syntheticOnly = query.synthetic_only === "true";

    const hhCondition = syntheticOnly ? eq(schema.households.is_synthetic, true) : undefined;
    const appCondition = syntheticOnly ? eq(schema.applications.is_synthetic, true) : undefined;

    const totalHouseholds = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.households)
      .where(hhCondition);

    const totalApplications = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.applications)
      .where(appCondition);

    const appsByStatus = await db
      .select({
        status: schema.applications.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.applications)
      .where(appCondition)
      .groupBy(schema.applications.status);

    const appsByScheme = await db
      .select({
        scheme_id: schema.applications.scheme_id,
        count: sql<number>`count(*)`,
      })
      .from(schema.applications)
      .where(appCondition)
      .groupBy(schema.applications.scheme_id)
      .limit(20);

    return reply.status(200).send({
      mode: syntheticOnly ? "synthetic_only" : "blended",
      label: syntheticOnly ? "Synthetic Only" : "Blended (Real + Synthetic)",
      is_blended: !syntheticOnly,
      total_households_enrolled: Number(totalHouseholds[0]?.count || 0),
      total_applications_initiated: Number(totalApplications[0]?.count || 0),
      applications_by_status: appsByStatus.reduce((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {} as Record<string, number>),
      top_schemes_applied: appsByScheme,
    });
  });

  // GET /admin/district-metrics?synthetic_only=
  fastify.get("/admin/district-metrics", async (request, reply) => {
    const query = request.query as { synthetic_only?: string };
    const syntheticOnly = query.synthetic_only === "true";

    const rows = await db
      .select({
        district_id: schema.households.district_id,
        total: sql<number>`count(*)`,
        synthetic: sql<number>`count(*) filter (where ${schema.households.is_synthetic} = true)`,
      })
      .from(schema.households)
      .groupBy(schema.households.district_id);

    return reply.status(200).send({
      mode: syntheticOnly ? "synthetic_only" : "blended",
      label: syntheticOnly ? "Synthetic Only" : "Blended (Real + Synthetic)",
      is_blended: !syntheticOnly,
      districts: rows.map((r) => ({
        district_id: r.district_id || "UNKNOWN",
        count: syntheticOnly ? Number(r.synthetic) : Number(r.total),
        synthetic_count: Number(r.synthetic),
        total_count: Number(r.total),
      })),
    });
  });

  // GET /admin/rejection-reasons?scheme_id=&synthetic_only=
  fastify.get("/admin/rejection-reasons", async (request, reply) => {
    const query = request.query as { scheme_id?: string; synthetic_only?: string };
    const syntheticOnly = query.synthetic_only === "true";

    const reasonRows = await db.select().from(schema.rejectionReasons);
    const reasonMap = new Map(reasonRows.map((r) => [r.code, r]));
    const fallbackMap = new Map(REJECTION_REASONS.map((r) => [r.code, r]));

    const conditions = [eq(schema.applications.outcome, "rejected")];
    if (query.scheme_id) {
      conditions.push(eq(schema.applications.scheme_id, query.scheme_id));
    }
    if (syntheticOnly) {
      conditions.push(eq(schema.applications.is_synthetic, true));
    }

    const whereClause = and(...conditions);

    const rejectedApps = await db
      .select({
        scheme_id: schema.applications.scheme_id,
        rejection_reason_code: schema.applications.rejection_reason_code,
      })
      .from(schema.applications)
      .where(whereClause);

    const totalRejections = rejectedApps.length;
    const countsByCode = new Map<string, number>();

    for (const app of rejectedApps) {
      const code = app.rejection_reason_code || "OTHER";
      countsByCode.set(code, (countsByCode.get(code) || 0) + 1);
    }

    const aggregated = Array.from(countsByCode.entries()).map(([code, count]) => {
      const meta = reasonMap.get(code) || fallbackMap.get(code);
      const percentage = totalRejections > 0 ? Math.round((count / totalRejections) * 100) : 0;
      const mappedAttr = meta?.mapped_attribute || null;
      const possibleRuleProblem = Boolean(mappedAttr && (percentage >= 30 || count >= 3));

      let note: string | undefined = undefined;
      if (possibleRuleProblem) {
        note = `High rejection frequency for '${code}' (${percentage}%). Consider reviewing scheme criteria for attribute '${mappedAttr}'.`;
      }

      return {
        code,
        count,
        percentage,
        mapped_attribute: mappedAttr,
        possible_rule_problem: possibleRuleProblem,
        note,
      };
    });

    aggregated.sort((a, b) => b.count - a.count);

    return reply.status(200).send({
      mode: syntheticOnly ? "synthetic_only" : "blended",
      label: syntheticOnly ? "Synthetic Only" : "Blended (Real + Synthetic)",
      is_blended: !syntheticOnly,
      scheme_id: query.scheme_id || null,
      total_rejections: totalRejections,
      reasons: aggregated,
    });
  });
};
