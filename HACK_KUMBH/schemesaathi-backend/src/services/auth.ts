import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";

export type UserRole = "citizen" | "volunteer" | "admin" | "citizen_or_volunteer";

declare module "fastify" {
  interface FastifyRequest {
    userRole?: UserRole;
  }
}

export async function setupAuth(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest("userRole", "citizen");

  fastify.addHook("onRequest", async (request) => {
    const key = request.headers["x-api-key"];
    // Derive role ONLY from the configured API key
    if (typeof key === "string") {
      if (key === config.apiKeyAdmin) {
        request.userRole = "admin";
      } else if (key === config.apiKeyVolunteer) {
        request.userRole = "volunteer";
      } else if (key === config.apiKeyCitizen) {
        request.userRole = "citizen";
      } else {
        request.userRole = "citizen";
      }
    } else {
      // Default to citizen for unauthenticated requests
      request.userRole = "citizen";
    }
    // Explicitly ignore X-Assisted-By and X-User-Role for role authorization
  });
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.userRole || "citizen";
    const isAllowed =
      allowedRoles.includes(role) ||
      (allowedRoles.includes("citizen_or_volunteer") && (role === "citizen" || role === "volunteer"));

    if (!isAllowed) {
      const apiKey = request.headers["x-api-key"];
      const isKnownKey =
        typeof apiKey === "string" &&
        (apiKey === config.apiKeyCitizen ||
          apiKey === config.apiKeyVolunteer ||
          apiKey === config.apiKeyAdmin);

      if (isKnownKey) {
        return reply.status(403).send({
          error: {
            code: "FORBIDDEN",
            message: `Access forbidden. Requires one of roles: [${allowedRoles.join(", ")}]. Your authenticated role '${role}' is not permitted.`,
          },
        });
      }

      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]. Provide a valid X-API-Key header.`,
        },
      });
    }
  };
}

export async function verifyHouseholdAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  householdId: string
): Promise<boolean> {
  const role = request.userRole || "citizen";
  // Volunteer and admin keys bypass household secret
  if (role === "volunteer" || role === "admin") {
    return true;
  }

  // Citizen role requires access secret if set on household
  const [hh] = await db
    .select({ access_secret_hash: schema.households.access_secret_hash })
    .from(schema.households)
    .where(eq(schema.households.household_id, householdId))
    .limit(1);

  if (!hh) {
    reply.status(404).send({
      error: {
        code: "HOUSEHOLD_NOT_FOUND",
        message: "Household not found",
      },
    });
    return false;
  }

  if (!hh.access_secret_hash) {
    reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Household has no access secret configured. Citizen access forbidden.",
      },
    });
    return false;
  }

  const providedSecret = request.headers["x-household-secret"];
  if (!providedSecret || typeof providedSecret !== "string" || !providedSecret.trim()) {
    reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Missing X-Household-Secret header for this household",
      },
    });
    return false;
  }

  const hash = crypto.createHash("sha256").update(providedSecret.trim()).digest("hex");
  if (hash !== hh.access_secret_hash) {
    reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Invalid X-Household-Secret header for this household",
      },
    });
    return false;
  }

  return true;
}
