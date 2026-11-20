import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import {
  CreateApplicationSchema,
  PatchApplicationStatusSchema,
  UpdateStepStatusSchema,
} from "./schema.js";
import { ApplicationService } from "./service.js";
import { requireRole } from "../../services/auth.js";

export const applicationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireRole(["citizen_or_volunteer", "admin"]));

  // POST /applications
  fastify.post("/applications", async (request, reply) => {
    const body = CreateApplicationSchema.parse(request.body);
    const app = await ApplicationService.createApplication(body);
    return reply.status(201).send(app);
  });

  // GET /applications/:id
  fastify.get("/applications/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr"; household_id?: string };
    let lang = query.lang;

    if (!lang) {
      const appRecord = await db
        .select({ household_id: schema.applications.household_id })
        .from(schema.applications)
        .where(eq(schema.applications.application_id, id))
        .limit(1);

      if (appRecord[0]?.household_id) {
        const hh = await db
          .select({ preferred_lang: schema.households.preferred_lang })
          .from(schema.households)
          .where(eq(schema.households.household_id, appRecord[0].household_id))
          .limit(1);
        lang = (hh[0]?.preferred_lang as "en" | "hi" | "mr") || "mr";
      } else {
        lang = "mr";
      }
    }

    const app = await ApplicationService.getApplication(id, lang, query.household_id);
    if (!app) {
      return reply.status(404).send({
        error: { code: "APPLICATION_NOT_FOUND", message: `Application '${id}' not found` },
      });
    }
    return app;
  });

  // PATCH /applications/:id/status
  fastify.patch("/applications/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { household_id?: string } | undefined;
    const body = PatchApplicationStatusSchema.parse(request.body);

    const updated = await ApplicationService.updateStatus(
      id,
      body.status,
      body.note,
      body.current_step_number,
      query?.household_id
    );

    if (!updated) {
      return reply.status(404).send({
        error: { code: "APPLICATION_NOT_FOUND", message: `Application '${id}' not found` },
      });
    }

    return updated;
  });

  // PATCH /applications/steps/:stepId
  fastify.patch("/applications/steps/:stepId", async (request, reply) => {
    const { stepId } = request.params as { stepId: string };
    const body = UpdateStepStatusSchema.parse(request.body);

    const updated = await ApplicationService.updateStepStatus(stepId, body.status);
    if (!updated) {
      return reply.status(404).send({
        error: { code: "STEP_NOT_FOUND", message: `Application step '${stepId}' not found` },
      });
    }

    return updated;
  });
};
