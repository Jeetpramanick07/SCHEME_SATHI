import { z } from "zod";

export type ComparisonOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "IN"
  | "NOT_IN"
  | "BETWEEN"
  | "OR";

export interface ComparisonTermNode {
  type: "term";
  attribute: string;
  operator: ComparisonOperator;
  value?: unknown;
}

export interface BinaryExpressionNode {
  type: "binary";
  operator: "AND" | "OR";
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode {
  type: "unary";
  operator: "NOT";
  argument: ExpressionNode;
}

export type ExpressionNode = ComparisonTermNode | BinaryExpressionNode | UnaryExpressionNode;

export const ExpressionNodeSchema: z.ZodType<ExpressionNode> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("term"),
      attribute: z.string(),
      operator: z.enum([
        "EQUALS",
        "NOT_EQUALS",
        "GREATER_THAN_OR_EQUAL",
        "LESS_THAN_OR_EQUAL",
        "GREATER_THAN",
        "LESS_THAN",
        "IN",
        "NOT_IN",
        "BETWEEN",
        "OR",
      ]),
      value: z.unknown(),
    }),
    z.object({
      type: z.literal("binary"),
      operator: z.enum(["AND", "OR"]),
      left: ExpressionNodeSchema,
      right: ExpressionNodeSchema,
    }),
    z.object({
      type: z.literal("unary"),
      operator: z.literal("NOT"),
      argument: ExpressionNodeSchema,
    }),
  ])
);

export interface CompiledRule {
  rule_id: string;
  attribute: string;
  operator: ComparisonOperator;
  value: unknown;
  unit?: string;
  mandatory: boolean;
  logical_group?: "AND" | "OR";
  parent_rule_id?: string;
  explanation?: string;
  parsed_expression?: ExpressionNode;
  parsed_expressions?: ExpressionNode[]; // For OR pathways containing array of expression strings
  advisory_only: boolean;
}

export const CompiledRuleSchema = z.object({
  rule_id: z.string(),
  attribute: z.string(),
  operator: z.string() as z.ZodType<ComparisonOperator>,
  value: z.unknown(),
  unit: z.string().optional(),
  mandatory: z.boolean(),
  logical_group: z.enum(["AND", "OR"]).optional(),
  parent_rule_id: z.string().optional(),
  explanation: z.string().optional(),
  parsed_expression: ExpressionNodeSchema.optional(),
  parsed_expressions: z.array(ExpressionNodeSchema).optional(),
  advisory_only: z.boolean(),
});

export interface SchemeCompiledRules {
  scheme_id: string;
  parent_scheme_id?: string;
  status: string;
  accepting_applications: string;
  source?: string;
  verified?: boolean;
  is_test?: boolean;
  beneficiary_categories?: string[];
  rules: CompiledRule[];
  exclusion_rules: ExpressionNode[];
  other_conditions: ExpressionNode[];
  hard_filters: {
    min_age?: number;
    max_age?: number;
    min_income?: number;
    max_income?: number;
    allowed_genders?: string[];
    states?: string[];
    district_ids?: string[];
    area_type?: string;
    nmc_only?: boolean;
    excluded_talukas?: string[];
    included_talukas?: string[];
  };
}

export const SchemeCompiledRulesSchema = z.object({
  scheme_id: z.string(),
  parent_scheme_id: z.string().optional(),
  status: z.string(),
  accepting_applications: z.string(),
  rules: z.array(CompiledRuleSchema),
  exclusion_rules: z.array(ExpressionNodeSchema),
  other_conditions: z.array(ExpressionNodeSchema),
  hard_filters: z.object({
    min_age: z.number().optional(),
    max_age: z.number().optional(),
    min_income: z.number().optional(),
    max_income: z.number().optional(),
    allowed_genders: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
    district_ids: z.array(z.string()).optional(),
    area_type: z.string().optional(),
    nmc_only: z.boolean().optional(),
    excluded_talukas: z.array(z.string()).optional(),
    included_talukas: z.array(z.string()).optional(),
  }),
});

export type EvaluationStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN" | "EXPLORE";

export interface EvaluationSubject {
  member_id?: string;
  relation_to_head?: string;
  age?: number;
  gender?: string;
  occupation?: string;
  caste_category?: string;
  marital_status?: string;
  answers: Record<string, unknown>;
}

export interface EvaluationContext {
  household?: {
    household_id?: string;
    state?: string;
    district_id?: string;
    taluka?: string;
    area_type?: "URBAN" | "RURAL" | "URBAN_SLUM";
    annual_family_income?: number;
    monthly_income?: number;
    bpl_card_holder?: boolean;
    answers?: Record<string, unknown>;
  };
  members?: EvaluationSubject[];
  approved_parent_benefits?: string[]; // IDs of approved parent schemes
  attribute_parent_mappings?: Record<string, string>; // Data-driven: attribute_key -> required_parent_scheme_id
  district_name_by_id?: Record<string, string>;
  attribute_labels?: Record<string, { en: string; hi: string; mr: string }>;
  language?: "en" | "hi" | "mr";
}

export interface UnmetCondition {
  attribute: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  reason: { en: string; hi: string; mr: string; review_status?: "machine_drafted" | "reviewed" };
}

export interface ExclusionHit {
  raw: string;
  reason: { en: string; hi: string; mr: string; review_status?: "machine_drafted" | "reviewed" };
}

export interface MemberSchemeResult {
  scheme_id: string;
  official_name?: string;
  status: EvaluationStatus;
  tier?: "can_apply" | "likely_confirm" | "not_eligible" | "explore";
  can_apply?: boolean;
  seasonal: boolean;
  score: number;
  variant?: string;
  matched_pathway?: string;
  unmet: UnmetCondition[];
  unknown_attributes: string[];
  mandatory_rules_evaluated_count?: number;
  is_curated?: boolean;
  is_verified?: boolean;
  source?: string;
  relevance_score?: number;
  what_to_confirm?: Array<{ attribute_key: string; label: string; why_it_matters: string }>;
  confidence_badge?: "high" | "medium" | "needs_confirmation";
  last_verified?: string | null;
  disclaimer_keys?: string[];
  pre_trip_check?: {
    bring_documents: Array<{
      document_id: string;
      name: string;
      mandatory: boolean;
      alternatives: string[];
    }>;
    confirm_with_office: string[];
  };
  exclusions_hit: ExclusionHit[];
  advisories: Array<{ rule_id: string; note: string }>;
  reasons: { en: string[]; hi: string[]; mr: string[] };
  review_status?: "machine_drafted" | "reviewed";
  failed_on_geography_only?: boolean;
}
