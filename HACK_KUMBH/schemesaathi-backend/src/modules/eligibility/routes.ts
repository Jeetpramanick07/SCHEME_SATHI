import { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { EvaluateRequestSchema, NextQuestionsRequestSchema } from "./schema.js";
import { EligibilityService } from "./service.js";
import { verifyHouseholdAccess } from "../../services/auth.js";

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
  fastify.post("/households/:id/eligibility", async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await verifyHouseholdAccess(request, reply, id);
    if (!ok) return reply;
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

    // Merge answers from memberAnswers table so patched answers are used
    const confirmedRows = await db
      .select()
      .from(schema.memberAnswers)
      .where(
        and(
          eq(schema.memberAnswers.household_id, id),
          eq(schema.memberAnswers.status, "confirmed")
        )
      );

    const confirmedMap = new Map<string, Record<string, unknown>>();
    const hhConfirmed: Record<string, unknown> = {};
    for (const r of confirmedRows) {
      if (r.value !== null) {
        if (r.member_id) {
          const mAns = confirmedMap.get(r.member_id) || {};
          mAns[r.attribute_key] = r.value;
          confirmedMap.set(r.member_id, mAns);
        } else {
          hhConfirmed[r.attribute_key] = r.value;
        }
      }
    }

    const evaluatePayload = {
      household: {
        household_id: hh[0].household_id,
        state: hh[0].state || "Maharashtra",
        district_id: hh[0].district_id || undefined,
        taluka: hh[0].taluka || undefined,
        annual_family_income:
          typeof hhConfirmed.annual_family_income === "number"
            ? (hhConfirmed.annual_family_income as number)
            : undefined,
      },
      members: members.map((m) => {
        const mergedAnswers = {
          ...((m.answers as Record<string, unknown>) || {}),
          ...hhConfirmed,
          ...(confirmedMap.get(m.member_id) || {}),
        };
        return {
          member_id: m.member_id,
          relation_to_head: m.relation_to_head || undefined,
          age: typeof mergedAnswers.age === "number" ? (mergedAnswers.age as number) : (m.age || undefined),
          gender: typeof mergedAnswers.gender === "string" ? (mergedAnswers.gender as string) : (m.gender || undefined),
          occupation: typeof mergedAnswers.occupation === "string" ? (mergedAnswers.occupation as string) : (m.occupation || undefined),
          caste_category: typeof mergedAnswers.caste_category === "string" ? (mergedAnswers.caste_category as string) : (m.caste_category || undefined),
          marital_status: typeof mergedAnswers.marital_status === "string" ? (mergedAnswers.marital_status as string) : (m.marital_status || undefined),
          answers: mergedAnswers,
        };
      }),
      approved_parent_benefits: approvedSchemeIds,
      lang: (query as Record<string, unknown>).lang as "en" | "hi" | "mr" || "en",
      include_explore:
        (query as Record<string, unknown>).include_explore === true ||
        (query as Record<string, unknown>).include_explore === "true",
      include_all:
        (query as Record<string, unknown>).include_all === true ||
        (query as Record<string, unknown>).include_all === "true",
    };

    return await EligibilityService.evaluate(evaluatePayload);
  });
};
