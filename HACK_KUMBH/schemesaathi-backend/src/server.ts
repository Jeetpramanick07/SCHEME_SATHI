import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { config } from "./config.js";
import { initDb, closeDb, getDbType, db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { setupAuth } from "./services/auth.js";
import { rulesCache } from "./services/cache.js";
import { catalogueRoutes } from "./modules/catalogue/routes.js";
import { eligibilityRoutes } from "./modules/eligibility/routes.js";
import { householdRoutes } from "./modules/households/routes.js";
import { applicationRoutes } from "./modules/applications/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { voiceRoutes } from "./modules/voice/voice.routes.js";

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.nodeEnv === "test" ? "silent" : "info",
    },
    requestIdHeader: "x-request-id",
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  });

  // Set Zod compilers
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Plugins
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024, // 15MB max file size
    },
  });

  await server.register(fastifySwagger, {
    openapi: {
      info: {
        title: "SchemeSaathi API",
        description:
          "Multilingual government welfare-scheme assistant backend (Nagpur/Vidarbha, Maharashtra)",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
      servers: [
        {
          url: `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`,
          description: "Current Server",
        },
      ],
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Auth Setup
  await setupAuth(server);

  // Consistent Error Handler
  server.setErrorHandler((error: { statusCode?: number; code?: string; message?: string; validation?: unknown }, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    return reply.status(statusCode).send({
      error: {
        code: error.code || (statusCode === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR"),
        message: error.message || "An unexpected error occurred",
        requestId: request.id,
        details: error.validation || undefined,
      },
    });
  });

  // GET /health
  server.get("/health", async () => {
    let schemeCount = 0;
    try {
      const rows = await db.select({ id: schema.schemes.scheme_id }).from(schema.schemes);
      schemeCount = rows.length;
    } catch {
      schemeCount = 0;
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: getDbType(),
      dataset_version: rulesCache.getVersion(),
      active_schemes_count: schemeCount,
    };
  });

  // Register Feature Modules under /api/v1
  await server.register(
    async (v1) => {
      await v1.register(catalogueRoutes);
      await v1.register(eligibilityRoutes);
      await v1.register(householdRoutes);
      await v1.register(applicationRoutes);
      await v1.register(adminRoutes);
      await v1.register(voiceRoutes);
    },
    { prefix: "/api/v1" }
  );

  return server;
}

export async function startServer() {
  await initDb();
  const server = await buildServer();

  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    server.log.info(`SchemeSaathi Backend running at ${address}`);
    server.log.info(`Swagger UI OpenAPI documentation available at ${address}/docs`);
    return server;
  } catch (err) {
    server.log.error(err);
    await closeDb();
    process.exit(1);
  }
}

// Direct execution
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  startServer();
}
