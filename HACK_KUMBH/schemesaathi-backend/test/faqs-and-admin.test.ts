import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "../src/db/index.js";
import { buildServer } from "../src/server.js";

describe("Dataset Expansion, FAQs & NGO Admin Dashboard", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    await initDb();
    app = await buildServer();
  });

  it("GET /api/v1/faqs searches across 8,800+ FAQs", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/faqs?q=pension&limit=5",
      headers: {
        "x-api-key": "citizen-secret-key",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("question");
    expect(body.items[0]).toHaveProperty("answer");
  });

  it("GET /api/v1/schemes/:id/faqs returns FAQs cross-linked via myscheme_id", async () => {
    // PM-JAY has curated_scheme_id CENT-MOHFW-PMJAY-002 cross-linked with ab-pmjay
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/schemes/CENT-MOHFW-PMJAY-002/faqs",
      headers: {
        "x-api-key": "citizen-secret-key",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scheme_id).toBe("CENT-MOHFW-PMJAY-002");
    expect(body.count).toBeGreaterThan(0);
    expect(body.faqs.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/admin/district-coverage returns 11 Vidarbha districts coverage summary", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/district-coverage",
      headers: {
        "x-api-key": "admin-secret-key",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.region).toContain("Vidarbha");
    expect(body.districts.length).toBeGreaterThanOrEqual(11);
    expect(body.total_mapped_schemes).toBe(1080);

    const nagpur = body.districts.find((d: { district: string }) => d.district === "Nagpur");
    expect(nagpur).toBeDefined();
    expect(nagpur.total_schemes).toBeGreaterThan(0);
  });

  it("GET /api/v1/admin/under-served-areas ranks districts by offline friction and intervention", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/under-served-areas",
      headers: {
        "x-api-key": "admin-secret-key",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.districts_ranked_by_friction).toBeDefined();
    expect(body.districts_ranked_by_friction.length).toBeGreaterThanOrEqual(11);

    const topFriction = body.districts_ranked_by_friction[0];
    expect(topFriction).toHaveProperty("offline_friction_percentage");
    expect(topFriction).toHaveProperty("recommended_ngo_intervention");
  });

  it("GET /api/v1/admin/schemes-uptake returns application statistics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/schemes-uptake",
      headers: {
        "x-api-key": "admin-secret-key",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("total_households_enrolled");
    expect(body).toHaveProperty("total_applications_initiated");
    expect(body).toHaveProperty("applications_by_status");
  });

  // Admin Access Checks: requirement 6
  describe("Admin Route Role Access Checks (/admin/*)", () => {
    it("returns 403 FORBIDDEN when citizen key accesses /admin/district-coverage", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/district-coverage",
        headers: {
          "x-api-key": "citizen-secret-key",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Access forbidden");
    });

    it("returns 403 FORBIDDEN when volunteer key accesses /admin/district-coverage", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/district-coverage",
        headers: {
          "x-api-key": "volunteer-secret-key",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Access forbidden");
    });

    it("returns 401 UNAUTHORIZED when no API key is provided for /admin/district-coverage", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/district-coverage",
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 UNAUTHORIZED when invalid API key is provided for /admin/district-coverage", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/district-coverage",
        headers: {
          "x-api-key": "invalid-random-secret",
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 200 OK when admin key is provided for /admin/district-coverage", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/district-coverage",
        headers: {
          "x-api-key": "admin-secret-key",
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
