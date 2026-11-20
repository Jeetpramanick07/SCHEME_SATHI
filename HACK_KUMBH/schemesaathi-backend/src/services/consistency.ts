import fs from "fs";
import path from "path";
import { z } from "zod";

export interface ConsistencyWarning {
  code: string;
  field: string;
  attribute?: string;
  message_key: string;
  message: string;
  severity: "warning";
  needs_verification?: boolean;
}

export const ConsistencyRuleConfigSchema = z.object({
  id: z.string(),
  code: z.string(),
  field: z.string(),
  message_key: z.string(),
  needs_verification: z.boolean(),
  description: z.string().optional(),
  age_tolerance_years: z.number().optional(),
  max_bpl_annual_income: z.number().optional(),
  min_married_family_size: z.number().optional(),
  max_marginal_land_hectares: z.number().optional(),
});

export const ConsistencyRulesFileSchema = z.array(ConsistencyRuleConfigSchema);
export type ConsistencyRuleConfig = z.infer<typeof ConsistencyRuleConfigSchema>;

// 12-digit Aadhaar pattern: 12 digits, optional spaces or hyphens every 4 digits, starting with 2-9
const AADHAAR_REGEX = /\b[2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4}\b/;
// 10-char PAN pattern: 5 letters, 4 digits, 1 letter
const PAN_REGEX = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/;

/**
 * Checks if any value or nested structure contains government ID patterns (Aadhaar, PAN).
 * Scans ONLY free-text string values. Numeric answers are never scanned to avoid false positives.
 */
export function detectSensitiveId(value: unknown): { detected: boolean; type?: "AADHAAR" | "PAN" } {
  if (value === null || value === undefined) return { detected: false };

  // Only scan free-text string values
  if (typeof value === "string") {
    if (AADHAAR_REGEX.test(value)) return { detected: true, type: "AADHAAR" };
    if (PAN_REGEX.test(value)) return { detected: true, type: "PAN" };
  } else if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const res = detectSensitiveId(v);
      if (res.detected) return res;
    }
  }

  return { detected: false };
}

let loadedRulesCache: ConsistencyRuleConfig[] | null = null;

export function loadConsistencyRules(filePath?: string): ConsistencyRuleConfig[] {
  if (loadedRulesCache && !filePath) {
    return loadedRulesCache;
  }

  const resolvedPath = filePath || path.resolve(process.cwd(), "src/seed/consistency-rules.json");
  if (fs.existsSync(resolvedPath)) {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = ConsistencyRulesFileSchema.parse(parsed);
    loadedRulesCache = validated;
    return validated;
  }

  // Fallback defaults if file cannot be located
  return [
    {
      id: "dob_vs_age",
      code: "DOB_AGE_MISMATCH",
      field: "age",
      age_tolerance_years: 1,
      message_key: "consistency.dob_age_mismatch",
      needs_verification: false,
    },
    {
      id: "income_vs_bpl",
      code: "BPL_HIGH_INCOME",
      field: "annual_family_income",
      max_bpl_annual_income: 150000,
      message_key: "consistency.bpl_high_income",
      needs_verification: true,
    },
    {
      id: "marital_status_vs_family_size",
      code: "MARRIED_SINGLE_MEMBER",
      field: "family_size",
      min_married_family_size: 2,
      message_key: "consistency.married_single_member",
      needs_verification: true,
    },
    {
      id: "widow_vs_gender",
      code: "WIDOW_GENDER_MISMATCH",
      field: "marital_status",
      message_key: "consistency.widow_gender_mismatch",
      needs_verification: false,
    },
    {
      id: "landholding_vs_farmer_type",
      code: "MARGINAL_FARMER_LAND_MISMATCH",
      field: "landholding_hectares",
      max_marginal_land_hectares: 1.0,
      message_key: "consistency.marginal_farmer_land_mismatch",
      needs_verification: true,
    },
  ];
}

/**
 * Validates consistency between answer fields and returns non-blocking warnings.
 * Uses thresholds loaded from consistency-rules.json with zero numbers hardcoded.
 */
export function validateConsistency(
  answers: Record<string, unknown>,
  context?: { familySize?: number; memberCount?: number }
): ConsistencyWarning[] {
  const rules = loadConsistencyRules();
  const ruleMap = new Map<string, ConsistencyRuleConfig>(rules.map((r) => [r.id, r]));
  const warnings: ConsistencyWarning[] = [];

  // 1. DOB vs Age
  const dobRule = ruleMap.get("dob_vs_age");
  const dobVal = answers.date_of_birth || answers.dob;
  const ageVal = answers.age;
  if (dobRule && typeof dobVal === "string" && typeof ageVal === "number") {
    const birthYear = parseInt(dobVal.substring(0, 4), 10);
    if (!isNaN(birthYear)) {
      const calculatedAge = new Date().getFullYear() - birthYear;
      const tolerance = dobRule.age_tolerance_years ?? 0;
      if (Math.abs(calculatedAge - ageVal) > tolerance) {
        warnings.push({
          code: dobRule.code,
          field: dobRule.field,
          message_key: dobRule.message_key,
          message: `Declared age (${ageVal}) does not match calculated age from date of birth (${calculatedAge}).`,
          severity: "warning",
          needs_verification: dobRule.needs_verification,
        });
      }
    }
  }

  // 2. Income vs BPL card status
  const incomeRule = ruleMap.get("income_vs_bpl");
  const bpl = answers.belongs_to_bpl_household === true || answers.bpl_card_holder === true;
  const income = typeof answers.annual_family_income === "number" ? answers.annual_family_income : null;
  if (incomeRule && bpl && income !== null && incomeRule.max_bpl_annual_income !== undefined) {
    if (income > incomeRule.max_bpl_annual_income) {
      warnings.push({
        code: incomeRule.code,
        field: incomeRule.field,
        message_key: incomeRule.message_key,
        message: `Annual family income (₹${income}) is unusually high for a BPL/Antyodaya household.`,
        severity: "warning",
        needs_verification: incomeRule.needs_verification,
      });
    }
  }

  // 3. Marital status married vs single-person household
  const maritalRule = ruleMap.get("marital_status_vs_family_size");
  const marital = String(answers.marital_status || "").toUpperCase();
  const famSize = typeof answers.family_size === "number" ? answers.family_size : context?.familySize || context?.memberCount;
  if (maritalRule && marital === "MARRIED" && typeof famSize === "number" && maritalRule.min_married_family_size !== undefined) {
    if (famSize < maritalRule.min_married_family_size) {
      warnings.push({
        code: maritalRule.code,
        field: maritalRule.field,
        message_key: maritalRule.message_key,
        message: "Marital status is 'Married' but family size is declared as 1.",
        severity: "warning",
        needs_verification: maritalRule.needs_verification,
      });
    }
  }

  // 4. Widow status vs Gender
  const widowRule = ruleMap.get("widow_vs_gender");
  const isWidow = answers.is_widow === true || marital === "WIDOW" || marital === "WIDOWED";
  const gender = String(answers.gender || "").toUpperCase();
  if (widowRule && isWidow && gender === "MALE") {
    warnings.push({
      code: widowRule.code,
      field: widowRule.field,
      message_key: widowRule.message_key,
      message: "Applicant is marked as widow but gender is declared as Male (should be widower or verified).",
      severity: "warning",
      needs_verification: widowRule.needs_verification,
    });
  }

  // 5. Landholding vs Farmer Type
  const landRule = ruleMap.get("landholding_vs_farmer_type");
  const farmerType = String(answers.farmer_type || "").toLowerCase();
  const land = typeof answers.landholding_hectares === "number" ? answers.landholding_hectares : null;
  if (landRule && farmerType === "marginal" && land !== null && landRule.max_marginal_land_hectares !== undefined) {
    if (land > landRule.max_marginal_land_hectares) {
      warnings.push({
        code: landRule.code,
        field: landRule.field,
        message_key: landRule.message_key,
        message: `Declared landholding (${land} ha) exceeds the standard ceiling of ${landRule.max_marginal_land_hectares} hectare for marginal farmers.`,
        severity: "warning",
        needs_verification: landRule.needs_verification,
      });
    }
  }

  return warnings;
}
