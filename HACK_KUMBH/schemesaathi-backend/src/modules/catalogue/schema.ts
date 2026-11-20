import { z } from "zod";

export const SchemeQuerySchema = z.object({
  q: z.string().optional(),
  level: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  taluka: z.string().optional(),
  category: z.string().optional(),
  benefit_type: z.string().optional(),
  beneficiary_category: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  accepting_applications: z.string().optional(),
  tags: z.string().optional(),
  sort: z.enum(["name_asc", "name_desc", "date_desc", "id_asc"]).optional().default("name_asc"),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  view: z.enum(["card", "detail"]).optional().default("card"),
  fields: z.string().optional(),
  lang: z.enum(["en", "hi", "mr"]).optional().default("en"),
  include_test: z.coerce.boolean().optional().default(false),
  source: z.enum(["cache", "db"]).optional().default("cache"),
});

export type SchemeQueryParams = z.input<typeof SchemeQuerySchema>;

export const SchemeCardResponseSchema = z.object({
  scheme_id: z.string(),
  official_name: z.string(),
  display_name: z.string(),
  level: z.string(),
  department_id: z.string().nullable().optional(),
  benefit_type: z.string().nullable().optional(),
  simple_explanation: z.string().nullable().optional(),
  status: z.string(),
  accepting_applications: z.string(),
  min_age: z.number().nullable().optional(),
  max_age: z.number().nullable().optional(),
  lang_served: z.enum(["en", "hi", "mr"]),
  lang_fallback: z.boolean(),
});

export const SchemeListResponseSchema = z.object({
  items: z.array(z.record(z.unknown())),
  next_cursor: z.string().nullable(),
  total_count: z.number(),
  lang_served: z.enum(["en", "hi", "mr"]),
});

export const FacetsResponseSchema = z.object({
  dataset_version: z.string(),
  levels: z.record(z.number()),
  departments: z.record(z.number()),
  benefit_types: z.record(z.number()),
  beneficiary_categories: z.record(z.number()),
  statuses: z.record(z.number()),
  accepting_applications: z.record(z.number()),
});

export const HelpCentreQuerySchema = z.object({
  district: z.string().optional(),
  taluka: z.string().optional(),
  service: z.string().optional(),
  scheme_id: z.string().optional(),
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const FaqQuerySchema = z.object({
  q: z.string().optional(),
  scheme_id: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
