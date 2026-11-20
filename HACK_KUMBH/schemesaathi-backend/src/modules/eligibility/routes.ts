import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { EvaluateRequestSchema, NextQuestionsRequestSchema } from "./schema.js";
import { EligibilityService } from "./service.js";
import { requireRole } from "../../services/auth.js";

export const eligibilityRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /eligibility/evaluate (stateless)
  fastify.post("/eligibility/evaluate", async (request) => {
    const body = EvaluateRequestSchema.parse(request.body);
    return await EligibilityService.evaluate(body);
  });

  // POST /eligibility/next-questions (adaptive questions)
  fastify.post("/eligibility/next-questions", async (request) => {
    const body = NextQuestionsRequestSchema.parse(request.body);
    return await EligibilityService.getNextQuestions(body);
  });

  // POST /households/:id/eligibility (persisted)
  fastify.post(
    "/households/:id/eligibility",
    { preHandler: requireRole(["citizen_or_volunteer", "admin"]) },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr" };

    const hh = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.household_id, id))
      .limit(1);

    if (hh.length === 0 || !hh[0]) {
      return reply.status(404).send({
        error: { code: "HOUSEHOLD_NOT_FOUND", message: `Household '${id}' not found` },
      });
    }

    const members = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.household_id, id));

    if (members.length === 0) {
      return reply.status(400).send({
        error: { code: "NO_MEMBERS", message: "Household has no registered members to evaluate" },
      });
    }

    // Check approved applications for parent benefit derivation
    const approvedApps = await db
      .select({ scheme_id: schema.applications.scheme_id })
      .from(schema.applications)
      .where(eq(schema.applications.household_id, id));

    const approvedSchemeIds = approvedApps.map((a) => a.scheme_id);

    const evaluatePayload = {
      household: {
        household_id: hh[0].household_id,
        state: hh[0].state || "Maharashtra",
        district_id: hh[0].district_id || undefined,
        taluka: hh[0].taluka || undefined,
      },
      members: members.map((m) => ({
        member_id: m.member_id,
        relation_to_head: m.relation_to_head || undefined,
        age: m.age || undefined,
        gender: m.gender || undefined,
        occupation: m.occupation || undefined,
        caste_category: m.caste_category || undefined,
        marital_status: m.marital_status || undefined,
        answers: (m.answers as Record<string, unknown>) || {},
      })),
      approved_parent_benefits: approvedSchemeIds,
      lang: query.lang || (hh[0].preferred_lang as "en" | "hi" | "mr") || "mr",
    };

    return await EligibilityService.evaluate(evaluatePayload);
  });
};
