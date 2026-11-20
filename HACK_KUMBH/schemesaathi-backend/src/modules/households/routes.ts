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
  ClaimHouseholdSchema,
  PatchAnswersSchema,
  ProposedAnswersSchema,
  ConfirmProposedSchema,
} from "./schema.js";
import { HouseholdService } from "./service.js";
import { AnswersService } from "./answers-service.js";
import { ConsentService } from "./consent-service.js";
import { ProfileSectionsService } from "../../services/profile-sections.js";
import { verifyHouseholdAccess } from "../../services/auth.js";

export const householdRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    // Only check household access secret on /households/:id routes
    if (!request.url.includes("/households/")) {
      return;
    }
    const params = request.params as { id?: string } | undefined;
    if (params && params.id) {
      const ok = await verifyHouseholdAccess(request, reply, params.id);
      if (!ok) {
        return reply;
      }
    }
  });
  // GET /profile/sections
  fastify.get("/profile/sections", async (request) => {
    const query = request.query as { lang?: "en" | "hi" | "mr" };
    return await ProfileSectionsService.getSections(query.lang || "en");
  });

  // GET /households/:id/profile
  fastify.get("/households/:id/profile", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr" };
    const profile = await ProfileSectionsService.getHouseholdProfile(id, query.lang || "en");
    if (!profile) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }
    return profile;
  });

  // POST /households/claim
  fastify.post("/households/claim", async (request, reply) => {
    const body = ClaimHouseholdSchema.parse(request.body);
    const created = await HouseholdService.claimHousehold(body);
    return reply.status(201).send(created);
  });

  // PATCH /households/:id/answers
  fastify.patch("/households/:id/answers", async (request) => {
    const { id } = request.params as { id: string };
    const body = PatchAnswersSchema.parse(request.body);

    const answersDict: Record<string, unknown> = {
      ...(body.answers || {}),
    };
    if (body.items) {
      for (const item of body.items) {
        answersDict[item.attribute_key] = item.value;
      }
    }

    // Derive role strictly from configured API key (never from untrusted headers)
    const userRole = request.userRole;
    // X-Assisted-By is kept strictly as an audit label
    const assistedBy = request.headers["x-assisted-by"] as string | undefined;

    return await AnswersService.patchAnswers(
      id,
      {
        answers: answersDict,
        member_id: body.member_id,
        source: body.source,
      },
      { role: userRole, assistedBy }
    );
  });

  // POST /households/:id/answers/proposed
  fastify.post("/households/:id/answers/proposed", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ProposedAnswersSchema.parse(request.body);
    const result = await AnswersService.storeProposed(id, body);
    return reply.status(201).send(result);
  });

  // POST /households/:id/answers/confirm
  fastify.post("/households/:id/answers/confirm", async (request) => {
    const { id } = request.params as { id: string };
    const body = ConfirmProposedSchema.parse(request.body);
    return await AnswersService.confirmProposed(id, body);
  });

  // PATCH /consents/:id/withdraw
  fastify.patch("/consents/:id/withdraw", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await ConsentService.withdrawConsent(Number(id));
    if (!result) {
      return reply.status(404).send({
        error: { code: "CONSENT_NOT_FOUND", message: `Consent record '${id}' not found` },
      });
    }
    return result;
  });

  // DELETE /households/:id (Right to be forgotten)
  fastify.delete("/households/:id", async (request) => {
    const { id } = request.params as { id: string };
    return await ConsentService.rightToBeForgotten(id);
  });

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

    const checklist = await HouseholdService.getSchemeChecklist(
      id,
      schemeId,
      query.member_id,
      query.lang || "en"
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

    const plan = await HouseholdService.getDocumentPlan(id, query.lang || "en");
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

    const { ReminderService } = await import("../reminders/service.js");
    return await ReminderService.getRemindersForHousehold(id, query.lang || "en");
  });
};
