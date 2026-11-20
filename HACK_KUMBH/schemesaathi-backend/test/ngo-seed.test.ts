import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, db } from "../src/db/index.js";
import { buildServer } from "../src/server.js";
import { FastifyInstance } from "fastify";
import * as schema from "../src/db/schema.js";
import { eq, or, like } from "drizzle-orm";
import { seedDemoNgo, clearSyntheticDemoData } from "../src/seed/demo-ngo.js";

describe("NGO Demo Seed & Synthetic Vidarbha Suite", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  it("seeds clearly marked synthetic households, members, applications, and outcomes across Vidarbha", async () => {
    const res = await seedDemoNgo({ reset: true });

    expect(res.households_count).toBeGreaterThanOrEqual(8);
    expect(res.applications_count).toBeGreaterThanOrEqual(8);
    expect(res.outcomes.approved).toBeGreaterThanOrEqual(2);
    expect(res.outcomes.rejected).toBeGreaterThanOrEqual(2);
    expect(res.outcomes.pending).toBeGreaterThanOrEqual(2);
    expect(res.outcomes.stuck).toBeGreaterThanOrEqual(1);

    // Verify districts covered span Vidarbha
    expect(res.districts).toContain("DIST_MH_NGP"); // Nagpur
    expect(res.districts).toContain("DIST_MH_WRD"); // Wardha
    expect(res.districts).toContain("DIST_MH_CHA"); // Chandrapur
    expect(res.districts).toContain("DIST_MH_GAD"); // Gadchiroli

    // Verify all seeded households have is_synthetic = true and start with hh_synth_
    const synthHouseholds = await db
      .select()
      .from(schema.households)
      .where(or(eq(schema.households.is_synthetic, true), like(schema.households.household_id, "hh_synth_%")));

    expect(synthHouseholds.length).toBeGreaterThanOrEqual(8);
    for (const hh of synthHouseholds) {
      expect(hh.is_synthetic).toBe(true);
      expect(hh.household_id.startsWith("hh_synth_")).toBe(true);
      expect(hh.state).toBe("Maharashtra");
    }

    // Verify all seeded applications have is_synthetic = true and start with app_synth_
    const synthApps = await db
      .select()
      .from(schema.applications)
      .where(or(eq(schema.applications.is_synthetic, true), like(schema.applications.application_id, "app_synth_%")));

    expect(synthApps.length).toBeGreaterThanOrEqual(8);
    for (const app of synthApps) {
      expect(app.is_synthetic).toBe(true);
      expect(app.application_id.startsWith("app_synth_")).toBe(true);
      expect(app.reference_no?.startsWith("SYNTH-")).toBe(true);
    }

    // Verify rejection reasons and notes are properly recorded
    const rejectedApps = synthApps.filter((a) => a.outcome === "rejected");
    expect(rejectedApps.length).toBeGreaterThanOrEqual(2);
    for (const rApp of rejectedApps) {
      expect(rApp.rejection_reason_code).toBeDefined();
      expect(rApp.rejection_note).toBeDefined();
      expect(rApp.outcome_recorded_by_role).toBe("admin");
    }

    // Verify stuck applications (documents pending > 7 days)
    const now = Date.now();
    const stuckApps = synthApps.filter((a) => {
      if (!a.created_at) return false;
      const ageDays = (now - new Date(a.created_at).getTime()) / (1000 * 86400);
      return a.outcome === "pending" && ageDays >= 7;
    });
    expect(stuckApps.length).toBeGreaterThanOrEqual(1);

    // Verify associated steps exist for stuck application
    const stuckSteps = await db
      .select()
      .from(schema.applicationSteps)
      .where(eq(schema.applicationSteps.application_id, stuckApps[0].application_id));
    expect(stuckSteps.length).toBeGreaterThanOrEqual(1);
    expect(stuckSteps.some((s) => s.status === "PENDING")).toBe(true);
  });

  it("proves seed:demo-ngo is idempotent and supports --reset", async () => {
    // 1. Run seed a second time without error
    const run1 = await seedDemoNgo({ reset: false });
    expect(run1.households_count).toBeGreaterThanOrEqual(8);

    // Count before reset
    const countBefore = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.is_synthetic, true));

    // 2. Run with reset -> must clean up and reseed cleanly without row multiplication
    const run2 = await seedDemoNgo({ reset: true });
    expect(run2.reset).toBe(true);
    expect(run2.households_count).toBe(countBefore.length);

    const countAfter = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.is_synthetic, true));
    expect(countAfter.length).toBe(countBefore.length);
  });

  it("verifies GET /api/v1/meta reports synthetic flags for dashboard banner", async () => {
    // Ensure demo data is seeded
    await seedDemoNgo();

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/meta",
    });

    expect(res.statusCode).toBe(200);
    const meta = JSON.parse(res.body);

    expect(meta.synthetic_flags).toBeDefined();
    expect(meta.synthetic_flags.has_synthetic_data).toBe(true);
    expect(meta.synthetic_flags.synthetic_households_count).toBeGreaterThanOrEqual(8);
    expect(meta.synthetic_flags.synthetic_applications_count).toBeGreaterThanOrEqual(8);
  });
});
