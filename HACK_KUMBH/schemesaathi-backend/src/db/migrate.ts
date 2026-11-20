import { initDb, closeDb } from "./index.js";
import { sql } from "drizzle-orm";

export const MIGRATION_DDL = `
-- Reference tables
CREATE TABLE IF NOT EXISTS departments (
  department_id VARCHAR(64) PRIMARY KEY,
  department_name VARCHAR(255) NOT NULL,
  ministry VARCHAR(255),
  government_level VARCHAR(32) NOT NULL,
  state VARCHAR(64) NOT NULL,
  official_website TEXT,
  contact_details TEXT
);

CREATE TABLE IF NOT EXISTS beneficiary_categories (
  category_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_hi VARCHAR(255),
  name_mr VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS documents (
  document_id VARCHAR(64) PRIMARY KEY,
  official_document_name VARCHAR(255) NOT NULL,
  simple_explanation_en TEXT,
  simple_explanation_hi TEXT,
  simple_explanation_mr TEXT,
  issuing_authority TEXT,
  application_portal TEXT,
  validity_period VARCHAR(128),
  renewal_requirements BOOLEAN DEFAULT FALSE,
  accepted_digital_formats JSONB,
  alternative_documents JSONB,
  applicable_schemes JSONB
);

CREATE TABLE IF NOT EXISTS document_prerequisites (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL,
  requires_document_id VARCHAR(64) NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS help_centres (
  help_centre_id VARCHAR(64) PRIMARY KEY,
  centre_name VARCHAR(255) NOT NULL,
  centre_type VARCHAR(64) NOT NULL,
  state VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  taluka VARCHAR(64),
  village_ward VARCHAR(128),
  complete_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  available_services JSONB,
  supported_schemes JSONB,
  phone VARCHAR(64),
  email VARCHAR(128),
  working_hours VARCHAR(128),
  source_url TEXT,
  last_verified VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS districts (
  district_id VARCHAR(64) PRIMARY KEY,
  district_name VARCHAR(128) NOT NULL,
  state VARCHAR(64) NOT NULL,
  division VARCHAR(64),
  is_vidarbha BOOLEAN DEFAULT FALSE,
  portal_url TEXT
);

CREATE TABLE IF NOT EXISTS official_portals (
  portal_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  level VARCHAR(32) NOT NULL,
  supports_tracking BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS application_tracking_methods (
  method_code VARCHAR(64) PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_registry (
  source_id VARCHAR(64) PRIMARY KEY,
  source_name VARCHAR(255) NOT NULL,
  government_department VARCHAR(255),
  source_type VARCHAR(64) NOT NULL,
  url TEXT,
  date_accessed VARCHAR(32),
  schemes_supported JSONB,
  verification_status VARCHAR(32) DEFAULT 'UNVERIFIED'
);

CREATE TABLE IF NOT EXISTS geo_scope_tokens (
  token VARCHAR(64) PRIMARY KEY,
  resolved_district_ids JSONB NOT NULL,
  states JSONB NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS attributes (
  key VARCHAR(128) PRIMARY KEY,
  scope VARCHAR(32) NOT NULL,
  value_type VARCHAR(32) NOT NULL,
  enum_values JSONB,
  unit VARCHAR(32),
  aliases JSONB,
  question_text JSONB NOT NULL,
  help_text JSONB,
  derivation TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'curated'
);

-- Core scheme tables
CREATE TABLE IF NOT EXISTS schemes (
  scheme_id VARCHAR(128) PRIMARY KEY,
  parent_scheme_id VARCHAR(128),
  official_name VARCHAR(255) NOT NULL,
  translated_names JSONB NOT NULL,
  level VARCHAR(32) NOT NULL,
  scheme_type VARCHAR(128) NOT NULL,
  implementing_state VARCHAR(128),
  department_id VARCHAR(255),
  overview JSONB NOT NULL,
  benefits JSONB NOT NULL,
  raw JSONB NOT NULL,
  compiled_rules JSONB NOT NULL,
  min_age INTEGER,
  max_age INTEGER,
  min_income INTEGER,
  max_income INTEGER,
  allowed_genders JSONB,
  states JSONB,
  district_ids JSONB,
  benefit_type VARCHAR(64),
  beneficiary_categories JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  accepting_applications VARCHAR(32) NOT NULL DEFAULT 'YES',
  last_verified VARCHAR(32),
  confidence_level VARCHAR(32),
  data_completeness VARCHAR(32),
  translation_status JSONB,
  source VARCHAR(32) NOT NULL DEFAULT 'curated',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_test BOOLEAN NOT NULL DEFAULT FALSE,
  content_hash VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheme_versions (
  id SERIAL PRIMARY KEY,
  scheme_id VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  raw JSONB NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  run_id VARCHAR(64) PRIMARY KEY,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  dry_run BOOLEAN DEFAULT FALSE,
  total_schemes INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  reports JSONB
);

-- Operational tables
CREATE TABLE IF NOT EXISTS households (
  household_id VARCHAR(64) PRIMARY KEY,
  consent_given BOOLEAN DEFAULT TRUE,
  district_id VARCHAR(64),
  taluka VARCHAR(64),
  state VARCHAR(64) DEFAULT 'Maharashtra',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS household_members (
  member_id VARCHAR(64) PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  relation_to_head VARCHAR(32) DEFAULT 'SELF',
  age INTEGER,
  gender VARCHAR(32),
  occupation VARCHAR(128),
  caste_category VARCHAR(64),
  marital_status VARCHAR(64),
  answers JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS household_documents (
  id VARCHAR(64) PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64),
  document_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'have',
  expires_on VARCHAR(32),
  alt_used VARCHAR(64),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS applications (
  application_id VARCHAR(64) PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  scheme_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  reference_no VARCHAR(128),
  tracking_url TEXT,
  current_step_number INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS application_steps (
  id VARCHAR(64) PRIMARY KEY,
  application_id VARCHAR(64) NOT NULL,
  step_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS application_audit_events (
  id SERIAL PRIMARY KEY,
  application_id VARCHAR(64) NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheme_faqs (
  id SERIAL PRIMARY KEY,
  scheme_id VARCHAR(64) NOT NULL,
  scheme_name VARCHAR(255),
  faq_number INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vidarbha_scheme_districts (
  id SERIAL PRIMARY KEY,
  district_id VARCHAR(64) NOT NULL,
  district VARCHAR(128) NOT NULL,
  scheme_id VARCHAR(64) NOT NULL,
  scheme_name VARCHAR(255) NOT NULL,
  coverage VARCHAR(128),
  portal TEXT,
  application_mode VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_sections (
  id VARCHAR(64) PRIMARY KEY,
  "order" INTEGER NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'household',
  title JSONB NOT NULL,
  description JSONB,
  skippable BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS profile_section_fields (
  id SERIAL PRIMARY KEY,
  section_id VARCHAR(64) NOT NULL,
  attribute_key VARCHAR(128) NOT NULL,
  "order" INTEGER NOT NULL,
  required_for_count INTEGER DEFAULT 0,
  optional BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS member_answers (
  id SERIAL PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64),
  attribute_key VARCHAR(128) NOT NULL,
  value JSONB,
  source VARCHAR(32) NOT NULL DEFAULT 'self_declared',
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  updated_by_role VARCHAR(32) DEFAULT 'citizen',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consent_records (
  id SERIAL PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  text_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  lang VARCHAR(8) NOT NULL DEFAULT 'en',
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS declarations (
  id SERIAL PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  text_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  lang VARCHAR(8) NOT NULL DEFAULT 'en',
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rejection_reasons (
  code VARCHAR(64) PRIMARY KEY,
  text JSONB NOT NULL,
  mapped_attribute VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS anonymized_deletion_logs (
  id SERIAL PRIMARY KEY,
  household_deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  district_id VARCHAR(64),
  member_count INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reminders (
  id VARCHAR(64) PRIMARY KEY,
  household_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64),
  type VARCHAR(64) NOT NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  due_date VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_hh ON reminders(household_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schemes_level ON schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_status ON schemes(status);
CREATE INDEX IF NOT EXISTS idx_schemes_dept ON schemes(department_id);
CREATE INDEX IF NOT EXISTS idx_schemes_state ON schemes(implementing_state);
CREATE INDEX IF NOT EXISTS idx_schemes_age ON schemes(min_age, max_age);
CREATE INDEX IF NOT EXISTS idx_schemes_accepting ON schemes(accepting_applications);
CREATE INDEX IF NOT EXISTS idx_schemes_is_test ON schemes(is_test);
CREATE INDEX IF NOT EXISTS idx_applications_hh ON applications(household_id);
CREATE INDEX IF NOT EXISTS idx_app_steps_app ON application_steps(application_id);
CREATE INDEX IF NOT EXISTS idx_faqs_scheme_id ON scheme_faqs(scheme_id);
CREATE INDEX IF NOT EXISTS idx_faqs_question ON scheme_faqs USING gin(to_tsvector('simple', question));
CREATE INDEX IF NOT EXISTS idx_vsd_district ON vidarbha_scheme_districts(district_id);
CREATE INDEX IF NOT EXISTS idx_vsd_scheme ON vidarbha_scheme_districts(scheme_id);

-- Alter table to ensure new columns exist on existing tables
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'imported';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS area_type VARCHAR(32) DEFAULT 'ALL';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS myscheme_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_schemes_source ON schemes(source);
CREATE INDEX IF NOT EXISTS idx_schemes_verified ON schemes(verified);

-- Data backfill: Ensure 24 curated gold-standard schemes have source=curated and verified=true
UPDATE schemes SET source = 'curated', verified = TRUE WHERE scheme_id IN (
  'CENT-MOAFW-PMKISAN-001', 'CENT-MOHFW-PMJAY-002', 'CENT-MSME-PMVISHWAKARMA-003',
  'CENT-MOHUA-PMSVANIDHI-004', 'CENT-MOWCD-PMMVY-005', 'CENT-MORD-NSAP-006',
  'CENT-MOLE-PMSYM-007', 'CENT-MOHUA-PMAYU2-008', 'CENT-MNRE-PMSURYAGHAR-009',
  'MH-WCD-LADKIBAHIN-010', 'MH-WCD-LEKLADKI-011', 'MH-AGR-NAMOSHETKARI-012',
  'MH-AGR-GOPINATHMUNDE-013', 'MH-SJSA-SANJAYGANDHI-014', 'MH-SJSA-SHRAVANBAL-015',
  'MH-LAB-MAHABOCW-016', 'MH-PHD-MJPJAY-017', 'MH-DHE-EBC-SHAHU-018',
  'DIST-NGP-DMF-WELFARE-019', 'LOCAL-GAD-PMAYG-ENHANCED-020', 'MH-SJSA-RAMAIAWAS-021',
  'MH-TDD-SHABARIAWAS-022', 'MH-AGR-POCRA-023', 'MH-SKILL-LADKABHAU-024'
);
-- Ensure all imported schemes have source=imported and verified=false
UPDATE schemes SET source = 'imported', verified = FALSE WHERE scheme_id NOT IN (
  'CENT-MOAFW-PMKISAN-001', 'CENT-MOHFW-PMJAY-002', 'CENT-MSME-PMVISHWAKARMA-003',
  'CENT-MOHUA-PMSVANIDHI-004', 'CENT-MOWCD-PMMVY-005', 'CENT-MORD-NSAP-006',
  'CENT-MOLE-PMSYM-007', 'CENT-MOHUA-PMAYU2-008', 'CENT-MNRE-PMSURYAGHAR-009',
  'MH-WCD-LADKIBAHIN-010', 'MH-WCD-LEKLADKI-011', 'MH-AGR-NAMOSHETKARI-012',
  'MH-AGR-GOPINATHMUNDE-013', 'MH-SJSA-SANJAYGANDHI-014', 'MH-SJSA-SHRAVANBAL-015',
  'MH-LAB-MAHABOCW-016', 'MH-PHD-MJPJAY-017', 'MH-DHE-EBC-SHAHU-018',
  'DIST-NGP-DMF-WELFARE-019', 'LOCAL-GAD-PMAYG-ENHANCED-020', 'MH-SJSA-RAMAIAWAS-021',
  'MH-TDD-SHABARIAWAS-022', 'MH-AGR-POCRA-023', 'MH-SKILL-LADKABHAU-024'
);
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'machine_drafted';
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS derived_from_approved_scheme VARCHAR(64);
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS help_text_source VARCHAR(64) DEFAULT 'dataset';

ALTER TABLE households ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(32) DEFAULT 'citizen';
ALTER TABLE households ADD COLUMN IF NOT EXISTS access_secret_hash VARCHAR(128);
ALTER TABLE households ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32);
ALTER TABLE households ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS outcome VARCHAR(32) DEFAULT 'pending';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_reason_code VARCHAR(64);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS outcome_recorded_by_role VARCHAR(32);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS simulated_sms_messages (
  id VARCHAR(64) PRIMARY KEY,
  household_id VARCHAR(64),
  phone VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'simulated_delivered',
  provider VARCHAR(32) DEFAULT 'simulated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_simulated_sms_hh ON simulated_sms_messages(household_id);

CREATE INDEX IF NOT EXISTS idx_member_answers_hh ON member_answers(household_id);
CREATE INDEX IF NOT EXISTS idx_member_answers_status ON member_answers(status);
CREATE INDEX IF NOT EXISTS idx_consent_records_hh ON consent_records(household_id);
CREATE INDEX IF NOT EXISTS idx_declarations_hh ON declarations(household_id);
CREATE INDEX IF NOT EXISTS idx_profile_sec_fields_sec ON profile_section_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_profile_sec_fields_attr ON profile_section_fields(attribute_key);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(32),
  email VARCHAR(128),
  household_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'citizen',
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  digilocker_linked BOOLEAN NOT NULL DEFAULT FALSE,
  masked_aadhaar VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id);

-- Postgres extensions & search indexes (executed safely)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_schemes_fts ON schemes USING gin(to_tsvector('simple', official_name));
CREATE INDEX IF NOT EXISTS idx_schemes_trgm ON schemes USING gin(official_name gin_trgm_ops);
`;

export async function runMigrations(): Promise<void> {
  const database = await initDb();
  // Split statements and execute sequentially
  const statements = MIGRATION_DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await database.execute(sql.raw(statement));
    } catch {
      // Ignore errors for optional extensions or duplicate indexes in minimal engines
    }
  }
}

// If executed directly from CLI
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(async () => {
      console.log("Migrations applied successfully.");
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration failed:", err);
      await closeDb();
      process.exit(1);
    });
}
