import { FastifyPluginAsync } from "fastify";
import { SmsService, SmsServiceError } from "./service.js";
import crypto from "crypto";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const smsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /sms/send-test
  fastify.post<{
    Body: {
      household_id?: string;
      to?: string;
      lang?: "en" | "hi" | "mr";
      message?: string;
    };
  }>("/sms/send-test", async (request, reply) => {
    try {
      const { household_id, to, lang, message } = request.body || {};

      if (!household_id && !to) {
        return reply.status(400).send({
          error: {
            code: "PHONE_REQUIRED",
            message: "A valid recipient phone number or household ID is required.",
          },
        });
      }

      let result;
      if (message) {
        result = await SmsService.sendSms({
          household_id,
          to: to || "",
          message,
        });
      } else {
        result = await SmsService.sendTestReminder({
          household_id,
          to,
          lang,
        });
      }

      return reply.status(200).send({
        success: true,
        result,
      });
    } catch (err: unknown) {
      if (err instanceof SmsServiceError) {
        return reply.status(err.statusCode).send({
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      return reply.status(500).send({
        error: {
          code: "SMS_SEND_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });

  // GET /sms/simulated
  fastify.get<{
    Querystring: {
      limit?: number;
      household_id?: string;
    };
  }>("/sms/simulated", async (request, reply) => {
    const role = request.userRole || "citizen";
    const limit = request.query.limit ? Number(request.query.limit) : 50;

    if (role === "admin" || role === "volunteer") {
      const messages = await SmsService.getSimulatedMessages({
        household_id: request.query.household_id,
        limit,
      });
      return reply.status(200).send({
        provider: SmsService.getProvider().name,
        count: messages.length,
        messages,
      });
    }

    // Citizen role: sees ONLY own household's messages with X-Household-Secret
    const providedSecret = request.headers["x-household-secret"];
    if (!providedSecret || typeof providedSecret !== "string" || !providedSecret.trim()) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Access denied. Citizens must provide a valid X-Household-Secret header to view messages.",
        },
      });
    }

    const secretHash = crypto.createHash("sha256").update(providedSecret.trim()).digest("hex");
    const [hh] = await db
      .select({ household_id: schema.households.household_id })
      .from(schema.households)
      .where(eq(schema.households.access_secret_hash, secretHash))
      .limit(1);

    if (!hh) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Invalid X-Household-Secret. No matching household found.",
        },
      });
    }

    if (request.query.household_id && request.query.household_id !== hh.household_id) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Access denied. You can only view messages for your own household.",
        },
      });
    }

    const messages = await SmsService.getSimulatedMessages({
      household_id: hh.household_id,
      limit,
    });

    return reply.status(200).send({
      provider: SmsService.getProvider().name,
      count: messages.length,
      messages,
    });
  });

  // DELETE /sms/simulated
  fastify.delete("/sms/simulated", async (request, reply) => {
    const role = request.userRole || "citizen";
    if (role !== "admin" && role !== "volunteer") {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Access denied. Admin or volunteer role required to clear simulated SMS inbox.",
        },
      });
    }

    const cleared = await SmsService.clearSimulatedMessages();
    return reply.status(200).send({
      success: true,
      cleared_count: cleared,
    });
  });
};
