# SchemeSaathi Core Backend Plan

## 1. Architectural File Tree
```
schemesaathi-backend/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── docker-compose.yml
├── .env.example
├── .npmrc
├── vitest.config.ts
├── data/
│   ├── government_welfare_schemes.json
│   ├── document_prerequisites.json
│   └── schemes/
├── src/
│   ├── server.ts                       # Fastify bootstrap, swagger, plugins, error handlers
│   ├── config.ts                       # Env config, STALE_DAYS, ports, keys
│   ├── db/
│   │   ├── index.ts                    # Postgres (pg.Pool) + PGlite fallback Drizzle client
│   │   ├── schema.ts                   # All relational tables, types & relations
│   │   └── migrate.ts                  # DDL execution & table initializations
│   ├── engine/
│   │   ├── types.ts                    # AST nodes, Rule, EvaluationResult types
│   │   ├── expression-parser.ts        # Recursive-descent expression parser & tokenizer (NO eval)
│   │   ├── normalizer.ts               # Alias normalizer (baked operators, e.g., income_lte)
│   │   ├── rule-compiler.ts            # Compiles scheme rules & extracts hard pre-filters
│   │   ├── evaluator.ts                # Pure evaluation function (stateless, 3-valued logic)
│   │   └── next-questions.ts           # Information-gain questionnaire ranking
│   ├── ingest/
│   │   ├── types.ts                    # Validation types, IngestReport, Severity
│   │   ├── validator.ts                # Zod schemas for scheme bundle & single scheme
│   │   ├── geography.ts                # Geo token resolver (ALL_INDIA, VIDARBHA_ALL_11, etc.)
│   │   ├── translation-check.ts        # Detects placeholders, templates & identical to English
│   │   ├── pipeline.ts                 # Full ingestion pipeline orchestrator
│   │   └── cli.ts                      # CLI entrypoint: pnpm ingest <file|dir> [--dry-run]
│   ├── modules/
│   │   ├── catalogue/
│   │   │   ├── schema.ts               # Request/response Zod schemas for catalogue
│   │   │   ├── service.ts              # Full-text search, facets, cursor pagination, detail
│   │   │   └── routes.ts               # Fastify routes: /schemes, /facets, /documents, etc.
│   │   ├── eligibility/
│   │   │   ├── schema.ts               # Evaluation & next-questions schemas
│   │   │   ├── service.ts              # Stateless & persisted eligibility evaluation
│   │   │   └── routes.ts               # Routes: /eligibility/evaluate, /next-questions
│   │   ├── households/
│   │   │   ├── schema.ts               # Households & members CRUD schemas
│   │   │   ├── service.ts              # Document gaps, checklists, document plans
│   │   │   └── routes.ts               # Routes: /households, /checklist, /document-plan
│   │   ├── applications/
│   │   │   ├── schema.ts               # Application & step schemas
│   │   │   ├── service.ts              # Step tracking, status transitions & audit log
│   │   │   └── routes.ts               # Routes: /applications, status patch, tracking
│   │   ├── reminders/
│   │   │   ├── schema.ts               # Reminder types
│   │   │   └── service.ts              # Generated reminders (deadlines, missing docs)
│   │   └── admin/
│   │       ├── schema.ts               # Ingestion run schemas
│   │       ├── service.ts              # Ingestion execution & run retrieval
│   │       └── routes.ts               # Routes: /admin/ingest, /admin/ingest-runs/:id
│   ├── services/
│   │   ├── auth.ts                     # X-API-Key plugin (citizen_or_volunteer vs admin)
│   │   ├── cache.ts                    # In-memory compiled rules cache & version invalidation
│   │   └── ports.ts                    # Out-of-scope ports (NotificationSender, SpeechProvider, etc.)
│   ├── seed/
│   │   ├── base-attributes.ts          # Core attribute registry seeds & localized messages
│   │   └── seed.ts                     # Master seed script: attributes, bundles, prerequisites
│   └── bench/
│       └── bench.ts                    # 5,000 synthetic schemes generator & benchmark runner
└── test/
    ├── expression-parser.test.ts       # Expression parser AST & injection tests
    ├── normalizer.test.ts              # Alias & baked operator normalizer tests
    ├── evaluator.test.ts               # 3-valued evaluation, OR pathways, exclusions, subschemes
    ├── prerequisites.test.ts           # Document DAG & cycle detection tests
    ├── ingest.test.ts                  # Ingestion idempotency, report generation, error isolation
    └── e2e.test.ts                     # Full flow: ingest -> evaluate -> questions -> household -> app
```

## 2. Relational Data Model (Drizzle ORM)
- `schemes`: Core table storing `raw` lossless JSON, `compiled_rules` AST, hard pre-filters (`min_age`, `max_age`, `min_income`, `max_income`, `allowed_genders`, `states`, `district_ids`), metadata (`content_hash`, `version`, `status`, `accepting_applications`, `translation_status`).
- `scheme_versions`: Historical audit versions keyed by `(scheme_id, version)` with `raw` snapshot and `content_hash`.
- `attributes`: Dynamic attribute registry (`key`, `scope`, `value_type`, `unit`, `aliases`, `question_text`, `help_text`, `derivation`, `status: curated | auto_registered`).
- `departments`, `beneficiary_categories`, `documents`, `help_centres`, `districts`, `official_portals`, `application_tracking_methods`, `source_registry`: Master reference entities populated directly from dataset bundles.
- `geo_scope_tokens`: Geographic resolution mapping tokens like `ALL_INDIA`, `VIDARBHA_ALL_11` into explicit district and state arrays.
- `document_prerequisites`: DAG edges `(document_id, requires_document_id)` ensuring cycle-free issuing requirements.
- `households` & `household_members`: Consent-flagged minimal PII household entities with flexible `answers` JSONB for all registered member attributes.
- `household_documents`: Member document statuses (`have | missing | expired`, `expires_on`, `alt_used`).
- `applications`, `application_steps`, `application_audit_events`: Multi-step scheme application progress tracking with immutable audit trail.
- `ingest_runs`: Logs of background/CLI/admin ingestion executions, acceptance counts, and validation warnings/errors.

## 3. API Endpoint Specification (under `/api/v1`)
- **System**:
  - `GET /health`: Uptime, DB connectivity, dataset version, active scheme count.
- **Catalogue**:
  - `GET /schemes`: Full-text search (`q`), multi-criteria filters (`level`, `state`, `district`, `category`, `department`, `status`, `accepting_applications`), sorting, cursor pagination, projection (`fields`), `view=card|detail`, localization (`lang=en|hi|mr`).
  - `GET /schemes/facets`: Aggregated count facets across levels, states, categories, departments.
  - `GET /schemes/:id`: Deep detail with resolved documents, steps, tracking info, help centres, sources, quality flags, `lang_served`, `lang_fallback`.
  - `GET /documents`, `GET /documents/:id`: Document catalog.
  - `GET /help-centres`: Help centres with filters by district, taluka, scheme, and geospatial proximity.
  - `GET /districts`, `GET /departments`, `GET /beneficiary-categories`: Master lookup endpoints.
- **Eligibility**:
  - `POST /eligibility/evaluate`: Stateless 3-valued evaluation for household and members returning ranked schemes and localized Marathi/Hindi/English reasons.
  - `POST /eligibility/next-questions`: Information-gain questionnaire ranking attributes that resolve the most UNKNOWN schemes.
  - `POST /households/:id/eligibility`: Persisted household eligibility evaluation.
- **Households & Applications**:
  - `POST /households`, `GET /households/:id`, `PATCH /households/:id`: Household management.
  - `POST /households/:id/members`, `PATCH /households/:id/members/:memberId`: Member management.
  - `GET /households/:id/schemes/:schemeId/checklist`: Scheme document gap analysis.
  - `GET /households/:id/document-plan`: Deduplicated topological document acquisition sequence.
  - `POST /applications`, `GET /applications/:id`, `PATCH /applications/:id/status`: Scheme applications & audit events.
  - `GET /households/:id/reminders`: Generated action reminders (deadlines, expiring docs).
- **Admin**:
  - `POST /admin/ingest`: Trigger ingestion of JSON bundle or directory (supports `dry_run`).
  - `GET /admin/ingest-runs/:id`: View execution status and validation report.

## 4. Ingestion Flow & Rule Compilation Pipeline
1. **Source Ingestion**: Ingests full bundles, schemes-only bundles, or individual scheme files.
2. **Schema & Structural Validation**: Zod schema verifies required properties, preserving unknown fields for forward compatibility.
3. **Reference & Anomaly Audit**: Detects dangling parents (e.g. `LOCAL-GAD-PMAYG-ENHANCED-020` -> `MH-SJSA-RAMAIAWAS-014`), missing departments, stale verification (> STALE_DAYS), partial completeness.
4. **Geo Token Resolution**: Maps tokens like `ALL_INDIA`, `VIDARBHA_ALL_11` into concrete district IDs via `districts`.
5. **Translation Quality Check**: Flags bracket placeholders `[...]`, empty translations, or text copied from English.
6. **Attribute Normalization & Safe Expression Parsing**:
   - Parses baked operators (`monthly_income_lte_15000` -> `monthly_income <= 15000`).
   - Tokenizes and parses expression strings via recursive descent parser into a clean AST (NO eval).
   - Auto-registers unknown attributes in `attributes` table with question text derived from rule explanations.
7. **Rule Compilation & Hard Filter Extraction**: Compiles rules into typed AST and extracts hard pre-filters (`min_age`, `max_age`, `genders`, `states`, `district_ids`).
8. **Idempotent Upsert & Cache Invalidation**: Checks sha256 `content_hash`; unchanged schemes are skipped; new/updated schemes update the database and save prior snapshots to `scheme_versions`; invalidates memory cache.
