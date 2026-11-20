import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, doublePrecision, serial } from "drizzle-orm/pg-core";

export const departments = pgTable("departments", {
  department_id: varchar("department_id", { length: 64 }).primaryKey(),
  department_name: varchar("department_name", { length: 255 }).notNull(),
  ministry: varchar("ministry", { length: 255 }),
  government_level: varchar("government_level", { length: 32 }).notNull(),
  state: varchar("state", { length: 64 }).notNull(),
  official_website: text("official_website"),
  contact_details: text("contact_details"),
});

export const beneficiaryCategories = pgTable("beneficiary_categories", {
  category_id: varchar("category_id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  name_hi: varchar("name_hi", { length: 255 }),
  name_mr: varchar("name_mr", { length: 255 }),
});

export const documents = pgTable("documents", {
  document_id: varchar("document_id", { length: 64 }).primaryKey(),
  official_document_name: varchar("official_document_name", { length: 255 }).notNull(),
  simple_explanation_en: text("simple_explanation_en"),
  simple_explanation_hi: text("simple_explanation_hi"),
  simple_explanation_mr: text("simple_explanation_mr"),
  issuing_authority: text("issuing_authority"),
  application_portal: text("application_portal"),
  validity_period: varchar("validity_period", { length: 128 }),
  renewal_requirements: boolean("renewal_requirements").default(false),
  accepted_digital_formats: jsonb("accepted_digital_formats").$type<string[]>(),
  alternative_documents: jsonb("alternative_documents").$type<string[]>(),
  applicable_schemes: jsonb("applicable_schemes").$type<string[]>(),
});

export const documentPrerequisites = pgTable("document_prerequisites", {
  id: serial("id").primaryKey(),
  document_id: varchar("document_id", { length: 64 }).notNull(),
  requires_document_id: varchar("requires_document_id", { length: 64 }).notNull(),
  note: text("note"),
});

export const helpCentres = pgTable("help_centres", {
  help_centre_id: varchar("help_centre_id", { length: 64 }).primaryKey(),
  centre_name: varchar("centre_name", { length: 255 }).notNull(),
  centre_type: varchar("centre_type", { length: 64 }).notNull(),
  state: varchar("state", { length: 64 }).notNull(),
  district: varchar("district", { length: 64 }).notNull(),
  taluka: varchar("taluka", { length: 64 }),
  village_ward: varchar("village_ward", { length: 128 }),
  complete_address: text("complete_address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  available_services: jsonb("available_services").$type<string[]>(),
  supported_schemes: jsonb("supported_schemes").$type<string[]>(),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 128 }),
  working_hours: varchar("working_hours", { length: 128 }),
  source_url: text("source_url"),
  last_verified: varchar("last_verified", { length: 32 }),
});

export const districts = pgTable("districts", {
  district_id: varchar("district_id", { length: 64 }).primaryKey(),
  district_name: varchar("district_name", { length: 128 }).notNull(),
  state: varchar("state", { length: 64 }).notNull(),
  division: varchar("division", { length: 64 }),
  is_vidarbha: boolean("is_vidarbha").default(false),
  portal_url: text("portal_url"),
});

export const officialPortals = pgTable("official_portals", {
  portal_id: varchar("portal_id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  level: varchar("level", { length: 32 }).notNull(),
  supports_tracking: boolean("supports_tracking").default(false),
});

export const applicationTrackingMethods = pgTable("application_tracking_methods", {
  method_code: varchar("method_code", { length: 64 }).primaryKey(),
  description: text("description").notNull(),
});

export const sourceRegistry = pgTable("source_registry", {
  source_id: varchar("source_id", { length: 64 }).primaryKey(),
  source_name: varchar("source_name", { length: 255 }).notNull(),
  government_department: varchar("government_department", { length: 255 }),
  source_type: varchar("source_type", { length: 64 }).notNull(),
  url: text("url"),
  date_accessed: varchar("date_accessed", { length: 32 }),
  schemes_supported: jsonb("schemes_supported").$type<string[]>(),
  verification_status: varchar("verification_status", { length: 32 }).default("UNVERIFIED"),
});

export const geoScopeTokens = pgTable("geo_scope_tokens", {
  token: varchar("token", { length: 64 }).primaryKey(),
  resolved_district_ids: jsonb("resolved_district_ids").$type<string[]>().notNull(),
  states: jsonb("states").$type<string[]>().notNull(),
  area_type: varchar("area_type", { length: 32 }).default("ALL"),
  excluded_talukas: jsonb("excluded_talukas").$type<string[]>(),
  included_talukas: jsonb("included_talukas").$type<string[]>(),
  description: text("description"),
});

export const attributes = pgTable("attributes", {
  key: varchar("key", { length: 128 }).primaryKey(),
  scope: varchar("scope", { length: 32 }).notNull(), // member | household | derived
  value_type: varchar("value_type", { length: 32 }).notNull(), // boolean | number | enum | string | list | date
  enum_values: jsonb("enum_values").$type<string[]>(),
  unit: varchar("unit", { length: 32 }),
  aliases: jsonb("aliases").$type<string[]>(),
  question_text: jsonb("question_text").$type<{ en: string; hi?: string; mr?: string }>().notNull(),
  help_text: jsonb("help_text").$type<{ en?: string; hi?: string; mr?: string }>(),
  derivation: text("derivation"),
  derived_from: text("derived_from"),
  derived_from_approved_scheme: varchar("derived_from_approved_scheme", { length: 64 }),
  review_status: varchar("review_status", { length: 32 }).notNull().default("machine_drafted"), // machine_drafted | reviewed
  help_text_source: varchar("help_text_source", { length: 64 }).default("unverified"), // dataset | unverified
  status: varchar("status", { length: 32 }).notNull().default("curated"), // curated | auto_registered
});

export const schemes = pgTable("schemes", {
  scheme_id: varchar("scheme_id", { length: 64 }).primaryKey(),
  parent_scheme_id: varchar("parent_scheme_id", { length: 64 }),
  official_name: varchar("official_name", { length: 255 }).notNull(),
  translated_names: jsonb("translated_names").$type<{ en: string; hi?: string; mr?: string }>().notNull(),
  level: varchar("level", { length: 32 }).notNull(),
  scheme_type: varchar("scheme_type", { length: 64 }).notNull(),
  implementing_state: varchar("implementing_state", { length: 64 }),
  department_id: varchar("department_id", { length: 64 }),
  overview: jsonb("overview").notNull(),
  benefits: jsonb("benefits").notNull(),
  raw: jsonb("raw").notNull(),
  compiled_rules: jsonb("compiled_rules").notNull(),
  min_age: integer("min_age"),
  max_age: integer("max_age"),
  min_income: integer("min_income"),
  max_income: integer("max_income"),
  allowed_genders: jsonb("allowed_genders").$type<string[]>(),
  states: jsonb("states").$type<string[]>(),
  district_ids: jsonb("district_ids").$type<string[]>(),
  area_type: varchar("area_type", { length: 32 }).default("ALL"), // URBAN | RURAL | ALL
  benefit_type: varchar("benefit_type", { length: 64 }),
  beneficiary_categories: jsonb("beneficiary_categories").$type<string[]>(),
  non_stackable_with: jsonb("non_stackable_with").$type<string[]>(),
  benefit_cap: jsonb("benefit_cap").$type<{ max_amount?: number; period?: string; currency?: string }>(),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  accepting_applications: varchar("accepting_applications", { length: 32 }).notNull().default("YES"),
  last_verified: varchar("last_verified", { length: 32 }),
  confidence_level: varchar("confidence_level", { length: 32 }),
  data_completeness: varchar("data_completeness", { length: 32 }),
  translation_status: jsonb("translation_status").$type<Record<string, { en: string; hi: string; mr: string }>>(),
  is_test: boolean("is_test").notNull().default(false),
  content_hash: varchar("content_hash", { length: 64 }).notNull(),
  version: integer("version").notNull().default(1),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const schemeVersions = pgTable("scheme_versions", {
  id: serial("id").primaryKey(),
  scheme_id: varchar("scheme_id", { length: 64 }).notNull(),
  version: integer("version").notNull(),
  content_hash: varchar("content_hash", { length: 64 }).notNull(),
  raw: jsonb("raw").notNull(),
  ingested_at: timestamp("ingested_at").defaultNow(),
});

export const ingestRuns = pgTable("ingest_runs", {
  run_id: varchar("run_id", { length: 64 }).primaryKey(),
  started_at: timestamp("started_at").defaultNow(),
  finished_at: timestamp("finished_at"),
  status: varchar("status", { length: 32 }).notNull().default("IN_PROGRESS"), // SUCCESS | FAILED | PARTIAL
  dry_run: boolean("dry_run").default(false),
  total_schemes: integer("total_schemes").default(0),
  accepted_count: integer("accepted_count").default(0),
  rejected_count: integer("rejected_count").default(0),
  skipped_count: integer("skipped_count").default(0),
  reports: jsonb("reports"),
});

export const households = pgTable("households", {
  household_id: varchar("household_id", { length: 64 }).primaryKey(),
  consent_given: boolean("consent_given").default(true),
  district_id: varchar("district_id", { length: 64 }),
  taluka: varchar("taluka", { length: 64 }),
  state: varchar("state", { length: 64 }).default("Maharashtra"),
  preferred_lang: varchar("preferred_lang", { length: 16 }).default("mr").notNull(),
  text_tier: varchar("text_tier", { length: 32 }).default("LARGE").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const householdMembers = pgTable("household_members", {
  member_id: varchar("member_id", { length: 64 }).primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  relation_to_head: varchar("relation_to_head", { length: 32 }).default("SELF"),
  age: integer("age"),
  gender: varchar("gender", { length: 32 }),
  occupation: varchar("occupation", { length: 128 }),
  caste_category: varchar("caste_category", { length: 64 }),
  marital_status: varchar("marital_status", { length: 64 }),
  answers: jsonb("answers").$type<Record<string, unknown>>().default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const householdDocuments = pgTable("household_documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 64 }),
  document_id: varchar("document_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("have"), // have | missing | expired
  expires_on: varchar("expires_on", { length: 32 }),
  alt_used: varchar("alt_used", { length: 64 }),
  notes: text("notes"),
});

export const applications = pgTable("applications", {
  application_id: varchar("application_id", { length: 64 }).primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 64 }).notNull(),
  scheme_id: varchar("scheme_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("DRAFT"), // DRAFT | SUBMITTED | IN_REVIEW | APPROVED | REJECTED
  reference_no: varchar("reference_no", { length: 128 }),
  tracking_url: text("tracking_url"),
  current_step_number: integer("current_step_number").default(1),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const applicationSteps = pgTable("application_steps", {
  id: varchar("id", { length: 64 }).primaryKey(),
  application_id: varchar("application_id", { length: 64 }).notNull(),
  step_number: integer("step_number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"), // PENDING | IN_PROGRESS | COMPLETED
  completed_at: timestamp("completed_at"),
});

export const applicationAuditEvents = pgTable("application_audit_events", {
  id: serial("id").primaryKey(),
  application_id: varchar("application_id", { length: 64 }).notNull(),
  previous_status: varchar("previous_status", { length: 32 }),
  new_status: varchar("new_status", { length: 32 }).notNull(),
  note: text("note"),
  created_at: timestamp("created_at").defaultNow(),
});
