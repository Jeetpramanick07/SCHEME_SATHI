import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { IngestionPipeline } from "../../ingest/pipeline.js";
import { requireRole } from "../../services/auth.js";
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
      .from(schema.schemes);

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
};
