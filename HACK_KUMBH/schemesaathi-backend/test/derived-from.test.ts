import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { QUESTION_BANK } from "../src/seed/question-bank.js";

interface DatasetRule {
  rule_id: string;
  attribute: string;
  operator: string;
  value: unknown;
  explanation?: string;
}

interface DatasetScheme {
  scheme_id: string;
  official_name: string;
  scheme_classification?: Record<string, unknown>;
  eligibility?: {
    rules?: DatasetRule[];
    exclusion_rules?: unknown[];
    minimum_age?: number;
    maximum_age?: number;
    gender_restrictions?: string[];
    eligible_communities?: string[];
    eligible_occupations?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

describe("Question Bank derived_from Integrity", () => {
  const datasetPath = path.resolve(process.cwd(), "data/government_welfare_schemes.json");
  const rawData = fs.readFileSync(datasetPath, "utf-8");
  const dataset = JSON.parse(rawData) as { schemes: DatasetScheme[] };

  const schemeMap = new Map<string, DatasetScheme>(dataset.schemes.map((s) => [s.scheme_id, s]));

  it("must ensure EVERY curated question bank entry with derived_from cites a real scheme_id and valid field/rule in dataset", () => {
    expect(dataset.schemes.length).toBe(24);
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(50);

    for (const item of QUESTION_BANK) {
      if (!item.derived_from) continue;

      const firstDot = item.derived_from.indexOf(".");
      expect(firstDot).toBeGreaterThan(0);

      const schemeId = item.derived_from.slice(0, firstDot);
      const fieldPath = item.derived_from.slice(firstDot + 1);

      // 1. Assert scheme_id exists in loaded dataset
      expect(schemeMap.has(schemeId)).toBe(true);
      const scheme = schemeMap.get(schemeId)!;

      // 2. Assert field path exists in that scheme
      let fieldExists = false;

      if (fieldPath.startsWith("scheme_classification.")) {
        const sub = fieldPath.replace("scheme_classification.", "");
        fieldExists = scheme.scheme_classification && scheme.scheme_classification[sub] !== undefined;
      } else if (fieldPath.startsWith("eligibility.rules.")) {
        const attr = fieldPath.replace("eligibility.rules.", "");
        fieldExists = scheme.eligibility?.rules?.some((r) => r.attribute === attr) ?? false;
      } else if (fieldPath.startsWith("eligibility.exclusion_rules.")) {
        const term = fieldPath.replace("eligibility.exclusion_rules.", "");
        fieldExists =
          scheme.eligibility?.exclusion_rules?.some((e) =>
            typeof e === "string" ? e.includes(term) : JSON.stringify(e).includes(term)
          ) ?? false;
      } else if (fieldPath.startsWith("eligibility.")) {
        const sub = fieldPath.replace("eligibility.", "");
        fieldExists = scheme.eligibility && scheme.eligibility[sub] !== undefined;
      }

      expect(fieldExists, `Field path '${fieldPath}' must exist in scheme ${schemeId} for key '${item.key}'`).toBe(
        true
      );
    }
  });

  it("fails if a derived_from references a non-existent scheme_id or non-existent rule field", () => {
    // Negative test proving strict assertion behavior
    const fakeDerivedFromInvalidScheme = "FAKE-SCHEME-999.eligibility.minimum_age";
    const fakeFirstDot = fakeDerivedFromInvalidScheme.indexOf(".");
    const fakeSchemeId = fakeDerivedFromInvalidScheme.slice(0, fakeFirstDot);
    expect(schemeMap.has(fakeSchemeId)).toBe(false);

    const realScheme = schemeMap.get("CENT-MOAFW-PMKISAN-001");
    expect(realScheme).toBeDefined();
    const fakeFieldExists =
      realScheme?.eligibility?.rules?.some((r) => r.attribute === "non_existent_attribute_xyz") ?? false;
    expect(fakeFieldExists).toBe(false);
  });
});
