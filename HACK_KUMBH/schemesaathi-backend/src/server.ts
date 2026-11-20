import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import fastifyMultipart from "@fastify/multipart";
import { config } from "./config.js";
import { initDb, closeDb, getDbType, db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq } from "drizzle-orm";
import { setupAuth } from "./services/auth.js";
import { rulesCache } from "./services/cache.js";
import { catalogueRoutes } from "./modules/catalogue/routes.js";
import { eligibilityRoutes } from "./modules/eligibility/routes.js";
import { householdRoutes } from "./modules/households/routes.js";
import { applicationRoutes } from "./modules/applications/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { prefillRoutes } from "./modules/prefill/routes.js";
import { voiceRoutes } from "./modules/voice/routes.js";
import { smsRoutes } from "./modules/sms/routes.js";
import { authRoutes } from "./modules/auth/routes.js";

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
    origin: config.corsOrigins,
    credentials: true,
  });

  await server.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
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
      // GET /api/v1/meta: dataset version, synthetic flags, counts
      v1.get("/meta", async () => {
        let total = 0;
        let curated = 0;
        let imported = 0;
        let verified = 0;
        let synthetic = 0;
        let syntheticHouseholds = 0;
        let syntheticApps = 0;

        try {
          const rows = await db
            .select({
              scheme_id: schema.schemes.scheme_id,
              source: schema.schemes.source,
              verified: schema.schemes.verified,
              is_test: schema.schemes.is_test,
              status: schema.schemes.status,
            })
            .from(schema.schemes);

          total = rows.length;
          for (const r of rows) {
            if (r.is_test) synthetic++;
            if (r.source === "curated") curated++;
            else if (r.source === "imported") imported++;
            if (r.verified) verified++;
          }

          const synthHh = await db
            .select({ id: schema.households.household_id })
            .from(schema.households)
            .where(eq(schema.households.is_synthetic, true));
          syntheticHouseholds = synthHh.length;

          const synthAppRows = await db
            .select({ id: schema.applications.application_id })
            .from(schema.applications)
            .where(eq(schema.applications.is_synthetic, true));
          syntheticApps = synthAppRows.length;
        } catch {
          // Fallback if DB query fails during initialization
        }

        return {
          dataset_version: rulesCache.getVersion() || "1.0.0",
          synthetic_flags: {
            has_synthetic_schemes: synthetic > 0,
            synthetic_schemes_count: synthetic,
            has_synthetic_data: syntheticHouseholds > 0 || syntheticApps > 0 || synthetic > 0,
            synthetic_households_count: syntheticHouseholds,
            synthetic_applications_count: syntheticApps,
          },
          counts: {
            total_schemes: total,
            curated_schemes: curated,
            imported_schemes: imported,
            verified_schemes: verified,
            active_schemes: total - synthetic,
          },
          db: getDbType(),
          cors_origins: config.corsOrigins,
          timestamp: new Date().toISOString(),
        };
      });

      await v1.register(catalogueRoutes);
      await v1.register(eligibilityRoutes);
      await v1.register(householdRoutes);
      await v1.register(applicationRoutes);
      await v1.register(adminRoutes);
      await v1.register(prefillRoutes);
      await v1.register(voiceRoutes, { prefix: "/voice" });
      await v1.register(smsRoutes);
      await v1.register(authRoutes);
    },
    { prefix: "/api/v1" }
  );

  // Direct root aliases
  await server.register(voiceRoutes, { prefix: "/voice" });
  await server.register(smsRoutes);

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
