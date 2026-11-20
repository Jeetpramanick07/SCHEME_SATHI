import { z } from "zod";

export const MultilingualTextSchema = z
  .object({
    en: z.string().min(1),
    hi: z.string().nullable().optional(),
    mr: z.string().nullable().optional(),
  })
  .passthrough();

export const RuleInputSchema = z
  .object({
    rule_id: z.string(),
    attribute: z.string(),
    operator: z.string(),
    value: z.unknown(),
    unit: z.string().nullable().optional(),
    mandatory: z.boolean().optional(),
    logical_group: z.enum(["AND", "OR"]).optional(),
    parent_rule_id: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    source_id: z.string().nullable().optional(),
  })
  .passthrough();

export const DocumentRequirementSchema = z
  .object({
    document_id: z.string(),
    mandatory: z.boolean().default(true),
    applicable_condition: z.string().nullable().optional(),
    alternative_documents: z.array(z.string()).optional(),
    validity: z.string().nullable().optional(),
    renewal_required: z.boolean().optional(),
  })
  .passthrough();

export const ApplicationStepSchema = z
  .object({
    step_number: z.number(),
    title: z.string(),
    description: z.string().nullable().optional(),
    required_documents: z.array(z.string()).optional(),
    official_link: z.string().nullable().optional(),
  })
  .passthrough();

export const SchemeSchema = z
  .object({
    scheme_id: z.string().min(1),
    parent_scheme_id: z.string().nullable().optional(),
    official_name: z.string().min(1),
    translated_names: MultilingualTextSchema,
    scheme_classification: z
      .object({
        level: z.string(),
        scheme_type: z.string(),
        implementing_state: z.string().nullable().optional(),
        implementing_districts: z.array(z.string()).optional(),
        department_id: z.string().nullable().optional(),
      })
      .passthrough(),
    overview: z
      .object({
        objective: z.string().nullable().optional(),
        simple_explanation: MultilingualTextSchema.optional(),
        beneficiary_categories: z.array(z.string()).optional(),
        target_population: z.union([z.string(), z.array(z.string())]).nullable().optional(),
      })
      .passthrough(),
    benefits: z
      .object({
        benefit_type: z.string().nullable().optional(),
        amount: z.union([z.number(), z.string()]).nullable().optional(),
        currency: z.string().nullable().optional(),
        frequency: z.string().nullable().optional(),
        coverage_details: z.string().nullable().optional(),
        conditions: z.union([z.string(), z.array(z.string())]).nullable().optional(),
      })
      .passthrough(),
    eligibility: z
      .object({
        rules: z.array(RuleInputSchema).default([]),
        minimum_age: z.number().nullable().optional(),
        maximum_age: z.number().nullable().optional(),
        minimum_income: z.number().nullable().optional(),
        maximum_income: z.number().nullable().optional(),
        eligible_occupations: z.array(z.string()).optional(),
        eligible_communities: z.array(z.string()).optional(),
        gender_restrictions: z.array(z.string()).optional(),
        geographic_restrictions: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        exclusion_rules: z.array(z.string()).optional(),
        other_conditions: z.array(z.string()).optional(),
        missing_information: z.array(z.string()).optional(),
      })
      .passthrough(),
    documents_required: z.array(DocumentRequirementSchema).optional(),
    application: z
      .object({
        application_mode: z.string().nullable().optional(),
        application_portal: z.string().nullable().optional(),
        steps: z.array(ApplicationStepSchema).optional(),
        application_deadline: z.string().nullable().optional(),
        processing_time: z.string().nullable().optional(),
        application_fee: z.union([z.string(), z.number()]).nullable().optional(),
      })
      .passthrough()
      .optional(),
    tracking: z
      .object({
        tracking_available: z.boolean().optional(),
        tracking_type: z.string().nullable().optional(),
        tracking_url: z.string().nullable().optional(),
        reference_number_required: z.boolean().optional(),
        api_available: z.boolean().optional(),
        sms_available: z.boolean().optional(),
        manual_update_supported: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    limitations: z.record(z.unknown()).optional(),
    assistance: z
      .object({
        helpline: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        grievance_portal: z.string().nullable().optional(),
        help_centre_ids: z.array(z.string()).optional(),
        responsible_authority: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    operational_status: z
      .object({
        status: z.string().default("ACTIVE"),
        accepting_applications: z.string().default("YES"),
        last_verified: z.string().nullable().optional(),
        verification_notes: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    sources: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
    confidence_level: z.string().nullable().optional(),
    data_completeness: z.string().nullable().optional(),
  })
  .passthrough();

export const BundleSchema = z
  .object({
    metadata: z.record(z.unknown()).optional(),
    departments: z.array(z.record(z.unknown())).optional(),
    beneficiary_categories: z.array(z.record(z.unknown())).optional(),
    schemes: z.array(SchemeSchema).default([]),
    documents: z.array(z.record(z.unknown())).optional(),
    help_centres: z.array(z.record(z.unknown())).optional(),
    districts: z.array(z.record(z.unknown())).optional(),
    official_portals: z.array(z.record(z.unknown())).optional(),
    application_tracking_methods: z.array(z.record(z.unknown())).optional(),
    source_registry: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();

export const DocumentPrerequisiteItemSchema = z.object({
  document_id: z.string().min(1),
  requires_document_ids: z.array(z.string()),
  note: z.string().optional(),
});

export const DocumentPrerequisitesSchema = z.array(DocumentPrerequisiteItemSchema);

export function validatePrerequisitesDag(
  items: Array<{ document_id: string; requires_document_ids: string[] }>
): { valid: boolean; error?: string; cycle?: string[] } {
  const adj = new Map<string, string[]>();

  for (const item of items) {
    adj.set(item.document_id, item.requires_document_ids);
  }

  const visited = new Map<string, "visiting" | "visited">();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.set(node, "visiting");
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor);
      if (state === "visiting") {
        path.push(neighbor);
        return false;
      }
      if (!state) {
        if (!dfs(neighbor)) return false;
      }
    }

    visited.set(node, "visited");
    path.pop();
    return true;
  }

  for (const docId of adj.keys()) {
    if (!visited.has(docId)) {
      if (!dfs(docId)) {
        return {
          valid: false,
          error: `Cycle detected in document prerequisites: ${path.join(" -> ")}`,
          cycle: [...path],
        };
      }
    }
  }

  return { valid: true };
}
