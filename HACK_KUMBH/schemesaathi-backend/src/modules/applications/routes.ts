import { FastifyPluginAsync } from "fastify";
import {
  CreateApplicationSchema,
  PatchApplicationStatusSchema,
  UpdateStepStatusSchema,
  RecordOutcomeSchema,
} from "./schema.js";
import { ApplicationService } from "./service.js";

export const applicationRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /applications
  fastify.post("/applications", async (request, reply) => {
    const body = CreateApplicationSchema.parse(request.body);
    const app = await ApplicationService.createApplication(body);
    return reply.status(201).send(app);
  });

  // GET /applications/:id
  fastify.get("/applications/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await ApplicationService.getApplication(id);
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
    const body = PatchApplicationStatusSchema.parse(request.body);

    const updated = await ApplicationService.updateStatus(
      id,
      body.status,
      body.note,
      body.current_step_number
    );

    if (!updated) {
      return reply.status(404).send({
        error: { code: "APPLICATION_NOT_FOUND", message: `Application '${id}' not found` },
      });
    }

    return updated;
  });

  // PATCH /applications/:id/outcome
  fastify.patch("/applications/:id/outcome", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = RecordOutcomeSchema.parse(request.body);

    const updated = await ApplicationService.recordOutcome(id, body);
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
