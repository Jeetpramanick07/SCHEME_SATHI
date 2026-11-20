import { initDb, closeDb, isRealPostgres } from "./index.js";
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
  scheme_id VARCHAR(64) PRIMARY KEY,
  parent_scheme_id VARCHAR(64),
  official_name VARCHAR(255) NOT NULL,
  translated_names JSONB NOT NULL,
  level VARCHAR(32) NOT NULL,
  scheme_type VARCHAR(64) NOT NULL,
  implementing_state VARCHAR(64),
  department_id VARCHAR(64),
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
  preferred_lang VARCHAR(16) DEFAULT 'mr' NOT NULL,
  text_tier VARCHAR(32) DEFAULT 'LARGE' NOT NULL,
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

-- Alter table to ensure new columns exist on existing tables
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS area_type VARCHAR(32) DEFAULT 'ALL';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS non_stackable_with JSONB;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS benefit_cap JSONB;
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'machine_drafted';
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS derived_from TEXT;
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS derived_from_approved_scheme VARCHAR(64);
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS help_text_source VARCHAR(64) DEFAULT 'unverified';
ALTER TABLE geo_scope_tokens ADD COLUMN IF NOT EXISTS area_type VARCHAR(32) DEFAULT 'ALL';
ALTER TABLE geo_scope_tokens ADD COLUMN IF NOT EXISTS excluded_talukas JSONB;
ALTER TABLE geo_scope_tokens ADD COLUMN IF NOT EXISTS included_talukas JSONB;
ALTER TABLE households ADD COLUMN IF NOT EXISTS preferred_lang VARCHAR(16) DEFAULT 'mr' NOT NULL;
ALTER TABLE households ADD COLUMN IF NOT EXISTS text_tier VARCHAR(32) DEFAULT 'LARGE' NOT NULL;

-- Postgres extensions & search indexes (executed safely)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_schemes_fts ON schemes USING gin(to_tsvector('simple', official_name));
CREATE INDEX IF NOT EXISTS idx_schemes_trgm ON schemes USING gin(official_name gin_trgm_ops);
`;

export async function runMigrations(): Promise<void> {
  const database = await initDb();
  const realPg = isRealPostgres();

  // Split statements and execute sequentially
  const statements = MIGRATION_DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await database.execute(sql.raw(statement));
      if (statement.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm")) {
        console.log(`[Migration] Extension pg_trgm enabled successfully (${realPg ? "real PostgreSQL" : "PGlite"}).`);
      }
    } catch {
      if (statement.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm")) {
        console.log("[Migration] pg_trgm extension not supported on PGlite; degraded gracefully.");
      } else if (statement.includes("gin_trgm_ops")) {
        console.log("[Migration] Trigram index (gin_trgm_ops) not supported on PGlite; degraded gracefully.");
      }
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
