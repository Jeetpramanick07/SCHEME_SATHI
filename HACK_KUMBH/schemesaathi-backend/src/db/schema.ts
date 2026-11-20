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
  derived_from_approved_scheme: varchar("derived_from_approved_scheme", { length: 64 }),
  review_status: varchar("review_status", { length: 32 }).notNull().default("machine_drafted"), // machine_drafted | reviewed
  help_text_source: varchar("help_text_source", { length: 64 }).default("dataset"), // dataset | unverified
  status: varchar("status", { length: 32 }).notNull().default("curated"), // curated | auto_registered
});

export const schemes = pgTable("schemes", {
  scheme_id: varchar("scheme_id", { length: 128 }).primaryKey(),
  parent_scheme_id: varchar("parent_scheme_id", { length: 128 }),
  official_name: varchar("official_name", { length: 255 }).notNull(),
  translated_names: jsonb("translated_names").$type<{ en: string; hi?: string; mr?: string }>().notNull(),
  level: varchar("level", { length: 32 }).notNull(),
  scheme_type: varchar("scheme_type", { length: 128 }).notNull(),
  implementing_state: varchar("implementing_state", { length: 128 }),
  department_id: varchar("department_id", { length: 255 }),
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
  benefit_type: varchar("benefit_type", { length: 128 }),
  beneficiary_categories: jsonb("beneficiary_categories").$type<string[]>(),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  accepting_applications: varchar("accepting_applications", { length: 32 }).notNull().default("YES"),
  last_verified: varchar("last_verified", { length: 32 }),
  confidence_level: varchar("confidence_level", { length: 32 }),
  data_completeness: varchar("data_completeness", { length: 32 }),
  translation_status: jsonb("translation_status").$type<Record<string, { en: string; hi: string; mr: string }>>(),
  myscheme_id: varchar("myscheme_id", { length: 128 }),
  source: varchar("source", { length: 32 }).notNull().default("curated"), // curated | imported | synthetic
  verified: boolean("verified").notNull().default(false),
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
  created_by_role: varchar("created_by_role", { length: 32 }).default("citizen"),
  access_secret_hash: varchar("access_secret_hash", { length: 128 }),
  contact_phone: varchar("contact_phone", { length: 32 }),
  is_synthetic: boolean("is_synthetic").default(false).notNull(),
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
  outcome: varchar("outcome", { length: 32 }).default("pending"), // approved | rejected | pending | withdrawn
  rejection_reason_code: varchar("rejection_reason_code", { length: 64 }),
  rejection_note: text("rejection_note"),
  outcome_recorded_by_role: varchar("outcome_recorded_by_role", { length: 32 }),
  outcome_at: timestamp("outcome_at"),
  reference_no: varchar("reference_no", { length: 128 }),
  tracking_url: text("tracking_url"),
  current_step_number: integer("current_step_number").default(1),
  is_synthetic: boolean("is_synthetic").default(false).notNull(),
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

export const schemeFaqs = pgTable("scheme_faqs", {
  id: serial("id").primaryKey(),
  scheme_id: varchar("scheme_id", { length: 128 }).notNull(),
  scheme_name: varchar("scheme_name", { length: 255 }),
  faq_number: integer("faq_number"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const vidarbhaSchemeDistricts = pgTable("vidarbha_scheme_districts", {
  id: serial("id").primaryKey(),
  district_id: varchar("district_id", { length: 64 }).notNull(),
  district: varchar("district", { length: 128 }).notNull(),
  scheme_id: varchar("scheme_id", { length: 128 }).notNull(),
  scheme_name: varchar("scheme_name", { length: 255 }).notNull(),
  coverage: varchar("coverage", { length: 128 }),
  portal: text("portal"),
  application_mode: varchar("application_mode", { length: 64 }),
  created_at: timestamp("created_at").defaultNow(),
});

export const profileSections = pgTable("profile_sections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  order: integer("order").notNull(),
  scope: varchar("scope", { length: 32 }).notNull().default("household"), // household | member
  title: jsonb("title").$type<{ en: string; hi?: string; mr?: string }>().notNull(),
  description: jsonb("description").$type<{ en?: string; hi?: string; mr?: string }>(),
  skippable: boolean("skippable").default(true),
});

export const profileSectionFields = pgTable("profile_section_fields", {
  id: serial("id").primaryKey(),
  section_id: varchar("section_id", { length: 64 }).notNull(),
  attribute_key: varchar("attribute_key", { length: 128 }).notNull(),
  order: integer("order").notNull(),
  required_for_count: integer("required_for_count").default(0),
  optional: boolean("optional").default(true),
});

export const memberAnswers = pgTable("member_answers", {
  id: serial("id").primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 64 }),
  attribute_key: varchar("attribute_key", { length: 128 }).notNull(),
  value: jsonb("value"),
  source: varchar("source", { length: 32 }).notNull().default("self_declared"), // self_declared | chatbot_confirmed | digilocker | aadhaar_qr | volunteer_confirmed | document_verified
  status: varchar("status", { length: 32 }).notNull().default("confirmed"), // confirmed | proposed
  updated_by_role: varchar("updated_by_role", { length: 32 }).default("citizen"),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(), // data_processing | sms_reminders | volunteer_assist
  text_version: varchar("text_version", { length: 32 }).notNull().default("v1.0"),
  lang: varchar("lang", { length: 8 }).notNull().default("en"),
  granted_at: timestamp("granted_at").defaultNow(),
  withdrawn_at: timestamp("withdrawn_at"),
});

export const declarations = pgTable("declarations", {
  id: serial("id").primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  text_version: varchar("text_version", { length: 32 }).notNull().default("v1.0"),
  lang: varchar("lang", { length: 8 }).notNull().default("en"),
  accepted_at: timestamp("accepted_at").defaultNow(),
});

export const rejectionReasons = pgTable("rejection_reasons", {
  code: varchar("code", { length: 64 }).primaryKey(),
  text: jsonb("text").$type<{ en: string; hi?: string; mr?: string }>().notNull(),
  mapped_attribute: varchar("mapped_attribute", { length: 128 }),
});

export const anonymizedDeletionLogs = pgTable("anonymized_deletion_logs", {
  id: serial("id").primaryKey(),
  household_deleted_at: timestamp("household_deleted_at").defaultNow(),
  district_id: varchar("district_id", { length: 64 }),
  member_count: integer("member_count").default(1),
});

export const reminders = pgTable("reminders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 64 }),
  type: varchar("type", { length: 64 }).notNull(),
  priority: varchar("priority", { length: 32 }).notNull().default("MEDIUM"),
  channel: varchar("channel", { length: 32 }).notNull().default("in_app"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  due_date: varchar("due_date", { length: 32 }),
  created_at: timestamp("created_at").defaultNow(),
});

export const simulatedSmsMessages = pgTable("simulated_sms_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  household_id: varchar("household_id", { length: 64 }),
  phone: varchar("phone", { length: 32 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 32 }).default("simulated_delivered"),
  provider: varchar("provider", { length: 32 }).default("simulated"),
  created_at: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 128 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 128 }),
  household_id: varchar("household_id", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 64 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("citizen"),
  profile_completed: boolean("profile_completed").notNull().default(false),
  digilocker_linked: boolean("digilocker_linked").notNull().default(false),
  masked_aadhaar: varchar("masked_aadhaar", { length: 32 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
