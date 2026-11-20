import { ExpressionParser } from "./expression-parser.js";
import { AttributeNormalizer } from "./normalizer.js";
import {
  CompiledRule,
  ComparisonOperator,
  ExpressionNode,
  SchemeCompiledRules,
} from "./types.js";

export interface RawRuleInput {
  rule_id: string;
  attribute: string;
  operator: string;
  value?: unknown;
  unit?: string | null;
  mandatory?: boolean;
  logical_group?: "AND" | "OR" | null;
  parent_rule_id?: string | null;
  explanation?: string | null;
}

export interface RawSchemeEligibilityInput {
  scheme_id: string;
  parent_scheme_id?: string;
  operational_status?: { status?: string; accepting_applications?: string };
  eligibility?: {
    rules?: RawRuleInput[];
    minimum_age?: number | null;
    maximum_age?: number | null;
    minimum_income?: number | null;
    maximum_income?: number | null;
    gender_restrictions?: string[];
    exclusion_rules?: string[];
    other_conditions?: string[];
  };
  scheme_classification?: {
    implementing_state?: string;
    implementing_districts?: string[];
  };
  resolved_district_ids?: string[];
  resolved_states?: string[];
}

export class RuleCompiler {
  /**
   * Compiles raw scheme JSON eligibility structure into a strongly typed AST
   * and extracts hard SQL pre-filters.
   */
  static compile(input: RawSchemeEligibilityInput): SchemeCompiledRules {
    const rawRules = input.eligibility?.rules || [];
    const compiledRules: CompiledRule[] = [];

    let extractedMinAge = input.eligibility?.minimum_age ?? undefined;
    let extractedMaxAge = input.eligibility?.maximum_age ?? undefined;
    let extractedMinIncome = input.eligibility?.minimum_income ?? undefined;
    let extractedMaxIncome = input.eligibility?.maximum_income ?? undefined;
    const extractedGenders: Set<string> = new Set(
      input.eligibility?.gender_restrictions || []
    );

    for (const rule of rawRules) {
      const normalized = AttributeNormalizer.normalize(rule.attribute);
      const attribute = normalized.canonicalAttribute;
      const operator: ComparisonOperator = (normalized.inferredOperator ||
        rule.operator ||
        "EQUALS") as ComparisonOperator;
      const value = normalized.inferredValue !== undefined ? normalized.inferredValue : rule.value;
      const mandatory = rule.mandatory !== false;

      let parsedExpression: ExpressionNode | undefined;
      let parsedExpressions: ExpressionNode[] | undefined;

      // Check if value is expression string or array of expression strings (e.g. OR pathways)
      if (operator === "OR" || attribute === "qualifying_pathway") {
        if (Array.isArray(value)) {
          parsedExpressions = value
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((exprStr) => ExpressionParser.parse(exprStr));
        } else if (typeof value === "string" && value.trim().length > 0) {
          parsedExpression = ExpressionParser.parse(value);
        }
      } else if (typeof value === "string" && (value.includes("==") || value.includes(">=") || value.includes("<="))) {
        parsedExpression = ExpressionParser.parse(value);
      }

      compiledRules.push({
        rule_id: rule.rule_id,
        attribute,
        operator,
        value,
        unit: rule.unit || undefined,
        mandatory,
        logical_group: rule.logical_group || "AND",
        parent_rule_id: rule.parent_rule_id || undefined,
        explanation: rule.explanation || undefined,
        parsed_expression: parsedExpression,
        parsed_expressions: parsedExpressions,
        advisory_only: !mandatory,
      });

      // Extract hard filter boundaries for SQL pre-filtering
      if (mandatory) {
        if (attribute === "age") {
          if ((operator === "GREATER_THAN_OR_EQUAL" || operator === "GREATER_THAN") && typeof value === "number") {
            const boundary = operator === "GREATER_THAN" ? value + 1 : value;
            extractedMinAge = extractedMinAge !== undefined ? Math.max(extractedMinAge, boundary) : boundary;
          }
          if ((operator === "LESS_THAN_OR_EQUAL" || operator === "LESS_THAN") && typeof value === "number") {
            const boundary = operator === "LESS_THAN" ? value - 1 : value;
            extractedMaxAge = extractedMaxAge !== undefined ? Math.min(extractedMaxAge, boundary) : boundary;
          }
          if (operator === "BETWEEN" && Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
            extractedMinAge = extractedMinAge !== undefined ? Math.max(extractedMinAge, value[0]) : value[0];
            extractedMaxAge = extractedMaxAge !== undefined ? Math.min(extractedMaxAge, value[1]) : value[1];
          }
        }

        if (attribute === "annual_family_income" || attribute === "monthly_income") {
          const factor = attribute === "monthly_income" ? 12 : 1;
          if ((operator === "LESS_THAN_OR_EQUAL" || operator === "LESS_THAN") && typeof value === "number") {
            const inc = value * factor;
            extractedMaxIncome = extractedMaxIncome !== undefined ? Math.min(extractedMaxIncome, inc) : inc;
          }
        }

        if (attribute === "gender") {
          if (operator === "EQUALS" && typeof value === "string") {
            extractedGenders.add(value.toUpperCase());
          } else if (operator === "IN" && Array.isArray(value)) {
            for (const g of value) {
              if (typeof g === "string") extractedGenders.add(g.toUpperCase());
            }
          }
        }
      }
    }

    // Compile exclusions
    const compiledExclusions: ExpressionNode[] = [];
    for (const rawExclusion of input.eligibility?.exclusion_rules || []) {
      if (typeof rawExclusion === "string" && rawExclusion.trim().length > 0) {
        compiledExclusions.push(ExpressionParser.parse(rawExclusion));
      }
    }

    // Compile other conditions
    const compiledOtherConditions: ExpressionNode[] = [];
    for (const rawCond of input.eligibility?.other_conditions || []) {
      if (typeof rawCond === "string" && rawCond.trim().length > 0) {
        try {
          compiledOtherConditions.push(ExpressionParser.parse(rawCond));
        } catch {
          // If condition is prose rather than expression, wrap as a term note
        }
      }
    }

    const state = input.scheme_classification?.implementing_state;
    const statesList = input.resolved_states || (state && state !== "ALL_INDIA" ? [state] : []);
    const districtIdsList = input.resolved_district_ids || input.scheme_classification?.implementing_districts || [];

    const districtTokens = input.scheme_classification?.implementing_districts || [];
    const isUrbanToken = districtTokens.some((t) =>
      typeof t === "string" && ["ALL_INDIA_URBAN", "NAGPUR_NMC_10_ZONES", "VIDARBHA_ULBS"].includes(t.toUpperCase())
    );
    const isNmcToken = districtTokens.some((t) =>
      typeof t === "string" && t.toUpperCase() === "NAGPUR_NMC_10_ZONES"
    );
    const areaType = isUrbanToken ? "URBAN" : "ALL";

    return {
      scheme_id: input.scheme_id,
      parent_scheme_id: input.parent_scheme_id,
      status: input.operational_status?.status || "ACTIVE",
      accepting_applications: input.operational_status?.accepting_applications || "YES",
      rules: compiledRules,
      exclusion_rules: compiledExclusions,
      other_conditions: compiledOtherConditions,
      hard_filters: {
        min_age: extractedMinAge,
        max_age: extractedMaxAge,
        min_income: extractedMinIncome,
        max_income: extractedMaxIncome,
        allowed_genders: extractedGenders.size > 0 ? Array.from(extractedGenders) : undefined,
        states: statesList.length > 0 ? statesList : undefined,
        district_ids: districtIdsList.length > 0 ? districtIdsList : undefined,
        area_type: areaType,
        nmc_only: isNmcToken,
      },
    };
  }
}
