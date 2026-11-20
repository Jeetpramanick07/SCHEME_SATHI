import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export type UserRole = "citizen_or_volunteer" | "admin";

declare module "fastify" {
  interface FastifyRequest {
    userRole?: UserRole;
  }
}

export async function setupAuth(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest("userRole", undefined);

  fastify.addHook("onRequest", async (request) => {
    const key = request.headers["x-api-key"];
    if (typeof key === "string" && key.length > 0) {
      if (config.apiKeyAdmin && key === config.apiKeyAdmin) {
        request.userRole = "admin";
      } else if (config.apiKeyCitizen && key === config.apiKeyCitizen) {
        request.userRole = "citizen_or_volunteer";
      }
    }
  });
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userRole || !allowedRoles.includes(request.userRole)) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]. Provide a valid X-API-Key header.`,
        },
      });
    }
  };
}
