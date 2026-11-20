import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GeoScopeResolver, DistrictRecord } from "../src/ingest/geography.js";
import { CatalogueService } from "../src/modules/catalogue/service.js";
import { initDb, closeDb } from "../src/db/index.js";

const sampleDistricts: DistrictRecord[] = [
  { district_id: "DIST_MH_NGP", district_name: "Nagpur", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_AMR", district_name: "Amravati", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_CHA", district_name: "Chandrapur", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_GAD", district_name: "Gadchiroli", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_WRD", district_name: "Wardha", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_BHA", district_name: "Bhandara", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_GON", district_name: "Gondia", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_AKO", district_name: "Akola", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_YAV", district_name: "Yavatmal", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_BUL", district_name: "Buldhana", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_WAS", district_name: "Washim", state: "Maharashtra", is_vidarbha: true },
  { district_id: "DIST_MH_PUN", district_name: "Pune", state: "Maharashtra", is_vidarbha: false },
  { district_id: "DIST_DL_CDL", district_name: "Central Delhi", state: "Delhi", is_vidarbha: false },
];

describe("Geo Scope Token Resolution & Urban/ULB Awareness", () => {
  const resolver = new GeoScopeResolver(sampleDistricts);

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("resolves ALL_INDIA_URBAN to all districts nationwide and state ALL_INDIA", () => {
    const res = resolver.resolve("SCHEME_SVANIDHI", null, ["ALL_INDIA_URBAN"]);
    expect(res.states).toContain("ALL_INDIA");
    expect(res.district_ids).toContain("DIST_MH_NGP");
    expect(res.district_ids).toContain("DIST_MH_PUN");
    expect(res.district_ids).toContain("DIST_DL_CDL");
    expect(res.issues.length).toBe(0);
  });

  it("resolves NAGPUR_NMC_10_ZONES specifically to Nagpur district DIST_MH_NGP", () => {
    const res = resolver.resolve("SCHEME_NMC_ZONE", "Maharashtra", ["NAGPUR_NMC_10_ZONES"]);
    expect(res.states).toContain("Maharashtra");
    expect(res.district_ids).toEqual(["DIST_MH_NGP"]);
    expect(res.district_ids).not.toContain("DIST_MH_PUN");
    expect(res.issues.length).toBe(0);
  });

  it("resolves VIDARBHA_ULBS to all 11 Vidarbha districts without non-Vidarbha districts", () => {
    const res = resolver.resolve("SCHEME_VIDARBHA_MUNI", "Maharashtra", ["VIDARBHA_ULBS"]);
    expect(res.states).toContain("Maharashtra");
    expect(res.district_ids.length).toBe(11);
    expect(res.district_ids).toContain("DIST_MH_NGP");
    expect(res.district_ids).toContain("DIST_MH_AMR");
    expect(res.district_ids).toContain("DIST_MH_GAD");
    expect(res.district_ids).not.toContain("DIST_MH_PUN"); // Pune is not Vidarbha
    expect(res.issues.length).toBe(0);
  });

  it("handles unknown geo tokens gracefully with a warning issue, never crashing", () => {
    const res = resolver.resolve("SCHEME_UNKNOWN", "Maharashtra", ["SOME_UNREGISTERED_REGION"]);
    expect(res.issues.length).toBe(1);
    expect(res.issues[0]?.severity).toBe("warn");
    expect(res.issues[0]?.code).toBe("UNKNOWN_GEO_TOKEN");
  });

  it("ensures urban-targeted schemes are never silently hidden from Nagpur users", async () => {
    // Test catalogue pre-filtering with district=DIST_MH_NGP and search query
    const list = await CatalogueService.listSchemes({
      q: "SVANidhi",
      district: "DIST_MH_NGP",
      limit: 20,
      include_test: false,
    });

    // PM SVANidhi (uses ALL_INDIA_URBAN) should be present
    const hasSvanidhi = list.items.some(
      (item) => String(item.scheme_id).includes("PMSVANIDHI") || String(item.official_name).includes("SVANidhi")
    );
    expect(hasSvanidhi).toBe(true);
  });
});
