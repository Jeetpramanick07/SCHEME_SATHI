import { ComparisonOperator } from "./types.js";

export interface NormalizedAttributeResolution {
  canonicalAttribute: string;
  inferredOperator?: ComparisonOperator;
  inferredValue?: unknown;
  wasBaked: boolean;
}

export class AttributeNormalizer {
  /**
   * Normalizes an attribute name that may embed an operator and value.
   * Examples:
   *  annual_family_income_lte_800000 -> { canonicalAttribute: 'annual_family_income', inferredOperator: 'LESS_THAN_OR_EQUAL', inferredValue: 800000, wasBaked: true }
   *  monthly_income_lte_15000 -> { canonicalAttribute: 'monthly_income', inferredOperator: 'LESS_THAN_OR_EQUAL', inferredValue: 15000, wasBaked: true }
   *  years_in_state_gte -> { canonicalAttribute: 'years_in_state', inferredOperator: 'GREATER_THAN_OR_EQUAL', wasBaked: true }
   *  taluka_in -> { canonicalAttribute: 'taluka', inferredOperator: 'IN', wasBaked: true }
   *  marital_status_in -> { canonicalAttribute: 'marital_status', inferredOperator: 'IN', wasBaked: true }
   */
  static normalize(attributeName: string): NormalizedAttributeResolution {
    const raw = attributeName.trim();

    // 1. Check for suffix _lte_<digits>
    const matchLteVal = raw.match(/^(.+)_lte_(\d+)$/i);
    if (matchLteVal && matchLteVal[1] && matchLteVal[2]) {
      return {
        canonicalAttribute: matchLteVal[1],
        inferredOperator: "LESS_THAN_OR_EQUAL",
        inferredValue: Number(matchLteVal[2]),
        wasBaked: true,
      };
    }

    // 2. Check for suffix _gte_<digits>
    const matchGteVal = raw.match(/^(.+)_gte_(\d+)$/i);
    if (matchGteVal && matchGteVal[1] && matchGteVal[2]) {
      return {
        canonicalAttribute: matchGteVal[1],
        inferredOperator: "GREATER_THAN_OR_EQUAL",
        inferredValue: Number(matchGteVal[2]),
        wasBaked: true,
      };
    }

    // 3. Check for suffix _lte
    const matchLte = raw.match(/^(.+)_lte$/i);
    if (matchLte && matchLte[1]) {
      return {
        canonicalAttribute: matchLte[1],
        inferredOperator: "LESS_THAN_OR_EQUAL",
        wasBaked: true,
      };
    }

    // 4. Check for suffix _gte
    const matchGte = raw.match(/^(.+)_gte$/i);
    if (matchGte && matchGte[1]) {
      return {
        canonicalAttribute: matchGte[1],
        inferredOperator: "GREATER_THAN_OR_EQUAL",
        wasBaked: true,
      };
    }

    // 5. Check for suffix _in
    const matchIn = raw.match(/^(.+)_in$/i);
    if (matchIn && matchIn[1]) {
      return {
        canonicalAttribute: matchIn[1],
        inferredOperator: "IN",
        wasBaked: true,
      };
    }

    // 6. Check for suffix _eq
    const matchEq = raw.match(/^(.+)_eq$/i);
    if (matchEq && matchEq[1]) {
      return {
        canonicalAttribute: matchEq[1],
        inferredOperator: "EQUALS",
        wasBaked: true,
      };
    }

    return {
      canonicalAttribute: raw,
      wasBaked: false,
    };
  }

  /**
   * Helper to determine appropriate attribute scope (household vs member)
   */
  static inferScope(attribute: string): "member" | "household" | "derived" {
    if (
      attribute.startsWith("family_member_") ||
      attribute.startsWith("annual_family_income") ||
      attribute.includes("household") ||
      attribute.includes("pucca_house") ||
      attribute.includes("electricity_connection") ||
      attribute.includes("ration_card")
    ) {
      return "household";
    }
    if (
      attribute === "age" ||
      attribute === "gender" ||
      attribute === "date_of_birth"
    ) {
      return "member";
    }
    return "member";
  }

  /**
   * Helper to infer value_type (boolean, number, string, list, enum)
   */
  static inferValueType(attribute: string, sampleValue: unknown): "boolean" | "number" | "string" | "list" | "enum" | "date" {
    if (typeof sampleValue === "boolean") return "boolean";
    if (typeof sampleValue === "number") return "number";
    if (Array.isArray(sampleValue)) return "list";
    if (attribute.includes("income") || attribute.includes("age") || attribute.includes("percentage") || attribute.includes("days") || attribute.includes("years")) {
      return "number";
    }
    if (attribute.includes("is_") || attribute.includes("has_") || attribute.includes("owns_") || attribute.includes("holds_")) {
      return "boolean";
    }
    return "string";
  }
}
