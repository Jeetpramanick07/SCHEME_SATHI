import { ValidationIssue } from "./types.js";

export interface DistrictRecord {
  district_id: string;
  district_name: string;
  state: string;
  is_vidarbha?: boolean | null;
}

export interface GeoResolutionResult {
  district_ids: string[];
  states: string[];
  area_type?: "URBAN" | "RURAL" | "ALL";
  excluded_talukas?: string[];
  included_talukas?: string[];
  issues: ValidationIssue[];
}

export interface GeoScopeTokenDefinition {
  token: string;
  states: string[];
  description: string;
  area_type?: "URBAN" | "RURAL" | "ALL";
  excluded_talukas?: string[];
  included_talukas?: string[];
  resolveDistricts: (districts: DistrictRecord[]) => string[];
}

export const BUILTIN_GEO_TOKENS: GeoScopeTokenDefinition[] = [
  {
    token: "ALL_INDIA",
    states: ["ALL_INDIA"],
    description: "All districts and territories nationwide across India",
    area_type: "ALL",
    resolveDistricts: (districts) => districts.map((d) => d.district_id),
  },
  {
    token: "CENTRAL",
    states: ["ALL_INDIA"],
    description: "Central government scheme implementing nationwide",
    area_type: "ALL",
    resolveDistricts: (districts) => districts.map((d) => d.district_id),
  },
  {
    token: "ALL_INDIA_URBAN",
    states: ["ALL_INDIA"],
    description: "All Statutory Towns and Urban Local Bodies (ULBs) across India",
    area_type: "URBAN",
    resolveDistricts: (districts) => districts.map((d) => d.district_id),
  },
  {
    token: "ALL_36_MAHARASHTRA_DISTRICTS",
    states: ["Maharashtra"],
    description: "All 36 administrative districts in Maharashtra State",
    area_type: "ALL",
    resolveDistricts: (districts) =>
      districts
        .filter((d) => d.state.toLowerCase() === "maharashtra")
        .map((d) => d.district_id),
  },
  {
    token: "MAHARASHTRA",
    states: ["Maharashtra"],
    description: "State-wide Maharashtra jurisdiction",
    area_type: "ALL",
    resolveDistricts: (districts) =>
      districts
        .filter((d) => d.state.toLowerCase() === "maharashtra")
        .map((d) => d.district_id),
  },
  {
    token: "VIDARBHA_ALL_11",
    states: ["Maharashtra"],
    description: "All 11 districts of the Vidarbha region, Maharashtra",
    area_type: "ALL",
    resolveDistricts: (districts) =>
      districts.filter((d) => d.is_vidarbha).map((d) => d.district_id),
  },
  {
    token: "VIDARBHA",
    states: ["Maharashtra"],
    description: "All 11 districts of Vidarbha region",
    area_type: "ALL",
    resolveDistricts: (districts) =>
      districts.filter((d) => d.is_vidarbha).map((d) => d.district_id),
  },
  {
    token: "VIDARBHA_ULBS",
    states: ["Maharashtra"],
    description: "All Urban Local Bodies (Municipal Corporations, Councils) across Vidarbha districts",
    area_type: "URBAN",
    resolveDistricts: (districts) =>
      districts.filter((d) => d.is_vidarbha).map((d) => d.district_id),
  },
  {
    token: "NAGPUR_NMC_10_ZONES",
    states: ["Maharashtra"],
    description: "Nagpur Municipal Corporation (NMC) jurisdiction across all 10 municipal zones in Nagpur district",
    area_type: "URBAN",
    excluded_talukas: ["KATOL", "NARKHED", "SAONER", "RAMTEK", "MOUDA", "UMRED", "KUHI", "BHIWAPUR", "HINGNA", "PARSEONI"],
    included_talukas: ["NAGPUR", "NAGPUR_URBAN", "NMC"],
    resolveDistricts: (districts) => {
      const ngp = districts.find(
        (d) => d.district_id === "DIST_MH_NGP" || d.district_name.toLowerCase() === "nagpur"
      );
      return ngp ? [ngp.district_id] : ["DIST_MH_NGP"];
    },
  },
];

export class GeoScopeResolver {
  private districts: DistrictRecord[];
  private tokenMap = new Map<string, GeoScopeTokenDefinition>();

  constructor(districts: DistrictRecord[]) {
    this.districts = districts;
    for (const def of BUILTIN_GEO_TOKENS) {
      this.tokenMap.set(def.token.toUpperCase(), def);
    }
  }

  resolve(
    schemeId: string,
    stateToken?: string | null,
    districtTokens?: string[] | null
  ): GeoResolutionResult {
    const issues: ValidationIssue[] = [];
    const resolvedDistricts = new Set<string>();
    const resolvedStates = new Set<string>();
    let resolvedAreaType: "URBAN" | "RURAL" | "ALL" = "ALL";
    const resolvedExcludedTalukas = new Set<string>();
    const resolvedIncludedTalukas = new Set<string>();

    // 1. Process State Token
    let stateTokenDef: GeoScopeTokenDefinition | undefined = undefined;
    if (stateToken && stateToken.trim().length > 0) {
      const trimmedState = stateToken.trim();
      const upperState = trimmedState.toUpperCase();
      stateTokenDef = this.tokenMap.get(upperState);
      if (stateTokenDef) {
        for (const st of stateTokenDef.states) resolvedStates.add(st);
        if (stateTokenDef.area_type && stateTokenDef.area_type !== "ALL") {
          resolvedAreaType = stateTokenDef.area_type;
        }
      } else {
        resolvedStates.add(trimmedState);
      }
    }

    // 2. Process District Tokens
    const cleanDistrictTokens = (districtTokens || [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());

    if (cleanDistrictTokens.length > 0) {
      for (const token of cleanDistrictTokens) {
        const upper = token.toUpperCase();

        // Check registered token definitions
        const tokenDef = this.tokenMap.get(upper);
        if (tokenDef) {
          for (const st of tokenDef.states) resolvedStates.add(st);
          const matchedDistIds = tokenDef.resolveDistricts(this.districts);
          for (const dId of matchedDistIds) resolvedDistricts.add(dId);
          if (tokenDef.area_type && tokenDef.area_type !== "ALL") {
            resolvedAreaType = tokenDef.area_type;
          }
          if (tokenDef.excluded_talukas) {
            for (const t of tokenDef.excluded_talukas) resolvedExcludedTalukas.add(t);
          }
          if (tokenDef.included_talukas) {
            for (const t of tokenDef.included_talukas) resolvedIncludedTalukas.add(t);
          }
          continue;
        }

        // Check match by exact district_id or district_name
        const matched = this.districts.find(
          (d) =>
            d.district_id.toUpperCase() === upper ||
            d.district_name.toUpperCase() === upper
        );

        if (matched) {
          resolvedDistricts.add(matched.district_id);
          resolvedStates.add(matched.state);
          continue;
        }

        // Unknown geographic token - report warning, do not crash
        issues.push({
          scheme_id: schemeId,
          field: "scheme_classification.implementing_districts",
          severity: "warn",
          code: "UNKNOWN_GEO_TOKEN",
          message: `Unknown geographic token '${token}' could not be resolved to a district ID`,
          details: { token },
        });
      }
    } else if (stateTokenDef) {
      // No specific district token provided; inherit districts from state token
      const matchedDistIds = stateTokenDef.resolveDistricts(this.districts);
      for (const dId of matchedDistIds) resolvedDistricts.add(dId);
    } else if (stateToken && stateToken.trim().length > 0) {
      // Match all districts belonging to this state name
      const stName = stateToken.trim().toLowerCase();
      const matchedDists = this.districts.filter((d) => d.state.toLowerCase() === stName);
      for (const d of matchedDists) resolvedDistricts.add(d.district_id);
    }

    return {
      district_ids: Array.from(resolvedDistricts),
      states: Array.from(resolvedStates),
      area_type: resolvedAreaType,
      excluded_talukas: resolvedExcludedTalukas.size > 0 ? Array.from(resolvedExcludedTalukas) : undefined,
      included_talukas: resolvedIncludedTalukas.size > 0 ? Array.from(resolvedIncludedTalukas) : undefined,
      issues,
    };
  }
}
