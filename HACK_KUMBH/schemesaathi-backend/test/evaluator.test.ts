import { describe, it, expect } from "vitest";
import { Evaluator } from "../src/engine/evaluator.js";
import { ExpressionParser } from "../src/engine/expression-parser.js";
import { SchemeCompiledRules } from "../src/engine/types.js";

describe("Eligibility Evaluator", () => {
  const baseScheme: SchemeCompiledRules = {
    scheme_id: "TEST_SCHEME_001",
    status: "ACTIVE",
    accepting_applications: "YES",
    rules: [
      {
        rule_id: "R1",
        attribute: "age",
        operator: "GREATER_THAN_OR_EQUAL",
        value: 60,
        mandatory: true,
        advisory_only: false,
      },
      {
        rule_id: "R2",
        attribute: "annual_family_income",
        operator: "LESS_THAN_OR_EQUAL",
        value: 200000,
        mandatory: true,
        advisory_only: false,
      },
    ],
    exclusion_rules: [],
    other_conditions: [],
    hard_filters: {
      min_age: 60,
      max_income: 200000,
    },
  };

  it("evaluates boundary conditions correctly", () => {
    // Exactly at boundary
    const resAtBoundary = Evaluator.evaluate(
      { age: 60, answers: {} },
      { household: { annual_family_income: 200000 } },
      baseScheme
    );
    expect(resAtBoundary.status).toBe("ELIGIBLE");

    // Below age boundary
    const resBelow = Evaluator.evaluate(
      { age: 59, answers: {} },
      { household: { annual_family_income: 200000 } },
      baseScheme
    );
    expect(resBelow.status).toBe("NOT_ELIGIBLE");
    expect(resBelow.unmet.some((u) => u.attribute === "age")).toBe(true);

    // Above income boundary
    const resAboveInc = Evaluator.evaluate(
      { age: 65, answers: {} },
      { household: { annual_family_income: 200001 } },
      baseScheme
    );
    expect(resAboveInc.status).toBe("NOT_ELIGIBLE");
    expect(resAboveInc.unmet.some((u) => u.attribute === "annual_family_income")).toBe(true);
  });

  it("propagates UNKNOWN when attributes are unanswered", () => {
    // Age provided, but annual_family_income missing
    const res = Evaluator.evaluate(
      { age: 65, answers: {} },
      { household: {} },
      baseScheme
    );
    expect(res.status).toBe("UNKNOWN");
    expect(res.unknown_attributes).toContain("annual_family_income");
  });

  it("evaluates OR qualifying pathways and picks matching pathway", () => {
    const orScheme: SchemeCompiledRules = {
      ...baseScheme,
      scheme_id: "TEST_OR_SCHEME",
      rules: [
        {
          rule_id: "R_OR",
          attribute: "qualifying_pathway",
          operator: "OR",
          value: [],
          mandatory: true,
          advisory_only: false,
          parsed_expressions: [
            ExpressionParser.parse("age >= 70"),
            ExpressionParser.parse("holds_nfsa_ration_card == true"),
          ],
        },
      ],
      hard_filters: {},
    };

    // Pathway 1 passes (age >= 70)
    const res1 = Evaluator.evaluate(
      { age: 72, answers: {} },
      { household: {} },
      orScheme
    );
    expect(res1.status).toBe("ELIGIBLE");
    expect(res1.matched_pathway).toBe("Pathway #1");

    // Pathway 2 passes (holds_nfsa_ration_card)
    const res2 = Evaluator.evaluate(
      { age: 50, answers: { holds_nfsa_ration_card: true } },
      { household: {} },
      orScheme
    );
    expect(res2.status).toBe("ELIGIBLE");
    expect(res2.matched_pathway).toBe("Pathway #2");

    // Neither passes
    const res3 = Evaluator.evaluate(
      { age: 50, answers: { holds_nfsa_ration_card: false } },
      { household: {} },
      orScheme
    );
    expect(res3.status).toBe("NOT_ELIGIBLE");
  });

  it("evaluates subscheme variants without asking subscheme", () => {
    const subschemeScheme: SchemeCompiledRules = {
      ...baseScheme,
      scheme_id: "TEST_NSAP",
      rules: [
        {
          rule_id: "R_SUBSCHEME",
          attribute: "qualifying_pathway",
          operator: "OR",
          value: [],
          mandatory: true,
          advisory_only: false,
          parsed_expressions: [
            ExpressionParser.parse("subscheme == 'IGNOAPS' AND age >= 60"),
            ExpressionParser.parse("subscheme == 'IGNWPS' AND gender == 'FEMALE' AND is_widow == true AND age >= 40"),
          ],
        },
      ],
      hard_filters: {},
    };

    // Evaluates 45-year-old widow female -> IGNWPS
    const res = Evaluator.evaluate(
      {
        age: 45,
        gender: "FEMALE",
        answers: { is_widow: true },
      },
      { household: {} },
      subschemeScheme
    );
    expect(res.status).toBe("ELIGIBLE");
    expect(res.variant).toBe("IGNWPS");
    expect(res.unknown_attributes).not.toContain("subscheme");
  });

  it("gates eligibility immediately when an exclusion is hit", () => {
    const excludedScheme: SchemeCompiledRules = {
      ...baseScheme,
      exclusion_rules: [
        ExpressionParser.parse("family_member_income_tax_payer == true"),
      ],
    };

    const res = Evaluator.evaluate(
      { age: 65, answers: { family_member_income_tax_payer: true } },
      { household: { annual_family_income: 100000 } },
      excludedScheme
    );

    expect(res.status).toBe("NOT_ELIGIBLE");
    expect(res.exclusions_hit.length).toBeGreaterThan(0);
    expect(res.exclusions_hit[0]?.reason.en).toContain("Excluded due to");
  });
});
