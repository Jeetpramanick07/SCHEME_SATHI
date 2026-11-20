import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import {
  CreateHouseholdSchema,
  CreateMemberSchema,
  PatchHouseholdSchema,
  PatchMemberSchema,
  UpdateHouseholdDocumentSchema,
} from "./schema.js";
import { HouseholdService } from "./service.js";
import { requireRole } from "../../services/auth.js";

export const householdRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireRole(["citizen_or_volunteer", "admin"]));

  // POST /households
  fastify.post("/households", async (request, reply) => {
    const body = CreateHouseholdSchema.parse(request.body);
    const created = await HouseholdService.createHousehold(body);
    return reply.status(201).send(created);
  });

  // GET /households/:id
  fastify.get("/households/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const hh = await HouseholdService.getHousehold(id);
    if (!hh) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }
    return hh;
  });

  // PATCH /households/:id
  fastify.patch("/households/:id", async (request, _reply) => {
    const { id } = request.params as { id: string };
    const body = PatchHouseholdSchema.parse(request.body);

    await db
      .update(schema.households)
      .set({
        ...body,
        updated_at: new Date(),
      })
      .where(eq(schema.households.household_id, id));

    const updated = await HouseholdService.getHousehold(id);
    return updated;
  });

  // POST /households/:id/members
  fastify.post("/households/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CreateMemberSchema.parse(request.body);

    const hh = await db
      .select({ id: schema.households.household_id })
      .from(schema.households)
      .where(eq(schema.households.household_id, id))
      .limit(1);

    if (!hh[0]) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }

    const member = await HouseholdService.addMember(id, body);
    return reply.status(201).send(member);
  });

  // PATCH /households/:id/members/:memberId
  fastify.patch("/households/:id/members/:memberId", async (request, reply) => {
    const { memberId } = request.params as { id: string; memberId: string };
    const body = PatchMemberSchema.parse(request.body);

    await db
      .update(schema.householdMembers)
      .set({
        ...body,
        updated_at: new Date(),
      })
      .where(eq(schema.householdMembers.member_id, memberId));

    const mem = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.member_id, memberId))
      .limit(1);

    if (!mem[0]) {
      return reply.status(404).send({
        error: { code: "MEMBER_NOT_FOUND", message: `Member '${memberId}' not found` },
      });
    }

    return mem[0];
  });

  // DELETE /households/:id/members/:memberId
  fastify.delete("/households/:id/members/:memberId", async (request, reply) => {
    const { memberId } = request.params as { id: string; memberId: string };
    await db
      .delete(schema.householdMembers)
      .where(eq(schema.householdMembers.member_id, memberId));
    return reply.status(204).send();
  });

  // PUT /households/:id/documents/:docId
  fastify.put("/households/:id/documents/:docId", async (request) => {
    const { id, docId } = request.params as { id: string; docId: string };
    const body = UpdateHouseholdDocumentSchema.parse(request.body);
    return await HouseholdService.updateDocumentStatus(id, docId, body);
  });

  // GET /households/:id/schemes/:schemeId/checklist
  fastify.get("/households/:id/schemes/:schemeId/checklist", async (request, reply) => {
    const { id, schemeId } = request.params as { id: string; schemeId: string };
    const query = request.query as { member_id?: string; lang?: "en" | "hi" | "mr" };
    const lang = query.lang || (await HouseholdService.getPreferredLang(id));

    const checklist = await HouseholdService.getSchemeChecklist(
      id,
      schemeId,
      query.member_id,
      lang
    );

    if (!checklist) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Scheme '${schemeId}' or Household '${id}' not found` },
      });
    }

    return checklist;
  });

  // GET /households/:id/document-plan
  fastify.get("/households/:id/document-plan", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr" };
    const lang = query.lang || (await HouseholdService.getPreferredLang(id));

    const plan = await HouseholdService.getDocumentPlan(id, lang);
    if (!plan) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }

    return plan;
  });

  // GET /households/:id/reminders
  fastify.get("/households/:id/reminders", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr" };

    const hh = await HouseholdService.getHousehold(id);
    if (!hh) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }

    const lang = query.lang || (hh.preferred_lang as "en" | "hi" | "mr") || "mr";
    const { ReminderService } = await import("../reminders/service.js");
    return await ReminderService.getRemindersForHousehold(id, lang);
  });
};
