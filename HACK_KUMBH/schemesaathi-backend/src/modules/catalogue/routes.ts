import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { CatalogueService } from "./service.js";
import { HelpCentreQuerySchema, SchemeQuerySchema } from "./schema.js";

export const catalogueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /schemes
  fastify.get("/schemes", async (request, reply) => {
    const query = SchemeQuerySchema.parse(request.query);
    const etag = CatalogueService.generateETag(JSON.stringify(query));

    if (request.headers["if-none-match"] === etag) {
      return reply.status(304).send();
    }

    const data = await CatalogueService.listSchemes(query);
    return reply
      .header("ETag", etag)
      .header("Cache-Control", "public, max-age=60")
      .send(data);
  });

  // GET /schemes/facets
  fastify.get("/schemes/facets", async (request, reply) => {
    const etag = CatalogueService.generateETag("facets");
    if (request.headers["if-none-match"] === etag) {
      return reply.status(304).send();
    }

    const facets = await CatalogueService.getFacets();
    return reply
      .header("ETag", etag)
      .header("Cache-Control", "public, max-age=60")
      .send(facets);
  });

  // GET /schemes/:id
  fastify.get("/schemes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lang?: "en" | "hi" | "mr" };
    const lang = query.lang || "en";

    const etag = CatalogueService.generateETag(`scheme:${id}:${lang}`);
    if (request.headers["if-none-match"] === etag) {
      return reply.status(304).send();
    }

    const item = await CatalogueService.getSchemeById(id, lang);
    if (!item) {
      return reply.status(404).send({
        error: { code: "SCHEME_NOT_FOUND", message: `Scheme '${id}' not found` },
      });
    }

    return reply
      .header("ETag", etag)
      .header("Cache-Control", "public, max-age=60")
      .send(item);
  });

  // GET /documents
  fastify.get("/documents", async () => {
    return await db.select().from(schema.documents);
  });

  // GET /documents/:id
  fastify.get("/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.document_id, id))
      .limit(1);

    if (doc.length === 0 || !doc[0]) {
      return reply.status(404).send({
        error: { code: "DOCUMENT_NOT_FOUND", message: `Document '${id}' not found` },
      });
    }

    return doc[0];
  });

  // GET /help-centres
  fastify.get("/help-centres", async (request) => {
    const query = HelpCentreQuerySchema.parse(request.query);
    return await CatalogueService.listHelpCentres(query);
  });

  // GET /districts
  fastify.get("/districts", async () => {
    return await db.select().from(schema.districts);
  });

  // GET /departments
  fastify.get("/departments", async () => {
    return await db.select().from(schema.departments);
  });

  // GET /beneficiary-categories
  fastify.get("/beneficiary-categories", async () => {
    return await db.select().from(schema.beneficiaryCategories);
  });

  // GET /faqs
  fastify.get("/faqs", async (request) => {
    const query = request.query as { q?: string; scheme_id?: string; limit?: string };
    return await CatalogueService.searchFaqs({
      q: query.q,
      scheme_id: query.scheme_id,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  });

  // GET /schemes/:id/faqs
  fastify.get("/schemes/:id/faqs", async (request) => {
    const { id } = request.params as { id: string };
    return await CatalogueService.getSchemeFaqs(id);
  });
};
