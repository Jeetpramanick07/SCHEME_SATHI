# SchemeSaathi Backend (Core Welfare Scheme Engine)

Multilingual, scalable government welfare-scheme assistant core backend for India (Nagpur/Vidarbha, Maharashtra). Built for hackathon MVP and designed to scale to 5,000+ schemes across central, state, and district levels without code changes.

---

## 1. Prime Directive: Data as the Contract
- **Zero Hardcoding**: Scheme IDs, attribute names, criteria, eligibility rules, and categories are NEVER hardcoded in code. Parent scheme benefit dependencies (such as PM-KISAN qualification for Namo Shetkari) are entirely data-driven via `derived_from_approved_scheme` on the attribute registry.
- **Dynamic Ingestion**: Adding or modifying schemes is purely a data operation: drop JSON into `data/schemes/` or run `pnpm ingest <file|dir>`.
- **Attribute Auto-Registration**: Any novel attribute in incoming schemes is automatically normalized (unbaking embedded operators like `monthly_income_lte_15000` -> `monthly_income <= 15000`) or registered into the `attributes` table with question text auto-generated from rule explanations.
- **Safe Evaluation (Zero `eval`)**: A handwritten tokenizer and recursive descent expression parser evaluates boolean expressions, OR pathways, exclusions, and subscheme variants securely without `eval()` or `Function()`.

---

## 2. Architecture & File Structure

```
schemesaathi-backend/
├── data/
│   ├── government_welfare_schemes.json   # Source of truth master dataset (24 real schemes)
│   ├── document_prerequisites.json       # Prerequisite DAG (unverified sample)
│   └── schemes/                          # Drop-in folder for new scheme JSONs
├── src/
│   ├── server.ts                         # Fastify bootstrap, Swagger OpenAPI, logging
│   ├── config.ts                         # Environment configuration (DB_SSL_REJECT_UNAUTHORIZED, etc.)
│   ├── db/
│   │   ├── index.ts                      # Postgres (pg.Pool) + embedded PGlite fallback
│   │   ├── schema.ts                     # Drizzle ORM relational schema & types
│   │   └── migrate.ts                    # DDL execution, pg_trgm & to_tsvector GIN indexing
│   ├── engine/
│   │   ├── expression-parser.ts          # Safe recursive descent parser (NO eval/Function)
│   │   ├── normalizer.ts                 # Baked operator normalizer (e.g., _lte, _gte, _in)
│   │   ├── rule-compiler.ts              # Scheme eligibility compiler & hard filter extractor
│   │   ├── evaluator.ts                  # Pure 3-valued logic (ELIGIBLE | NOT_ELIGIBLE | UNKNOWN)
│   │   ├── next-questions.ts             # Information-gain questionnaire ranking
│   │   └── types.ts                      # AST nodes and evaluation types
│   ├── ingest/
│   │   ├── types.ts                      # Ingestion report and validation types
│   │   ├── validator.ts                  # Zod validation & DAG cycle detection
│   │   ├── geography.ts                  # Geo token resolver (ALL_INDIA, VIDARBHA_ALL_11, etc.)
│   │   ├── translation-check.ts          # Placeholder & duplicate English detection
│   │   ├── pipeline.ts                   # Ingestion pipeline orchestrator (idempotent upsert)
│   │   └── cli.ts                        # CLI entrypoint: pnpm ingest <file|dir> [--dry-run]
│   ├── modules/
│   │   ├── catalogue/                    # Schemes catalogue, Postgres FTS, search, facets
│   │   ├── eligibility/                  # Stateless evaluation & next-questions endpoints
│   │   ├── households/                   # Household/member CRUD, checklists, document-plan
│   │   ├── applications/                 # Scheme applications, steps, audit log, tracking
│   │   ├── reminders/                    # Generated reminders service
│   │   └── admin/                        # Ingestion management, pending-reviews endpoint
│   ├── services/
│   │   ├── auth.ts                       # X-API-Key plugin (citizen_or_volunteer vs admin)
│   │   ├── cache.ts                      # In-memory compiled rules and catalogue cache
│   │   └── ports.ts                      # Decoupled ports (NotificationSender, SpeechProvider)
│   ├── seed/
│   │   ├── question-bank.ts              # Curated question bank with clean natural language
│   │   ├── base-attributes.ts            # Base schema attributes
│   │   └── seed.ts                       # Seed runner: attributes, sample dataset, prereqs
│   └── bench/
│       └── bench.ts                      # Benchmarks: in-memory cache vs Postgres DB search
└── test/
    ├── expression-parser.test.ts         # Expression parser AST & injection tests
    ├── normalizer.test.ts                # Baked operator normalizer tests
    ├── evaluator.test.ts                 # 3-valued evaluation, OR pathways, exclusions, subschemes
    ├── geography.test.ts                 # Urban/Rural and NMC token resolution tests
    ├── prerequisites.test.ts             # Document DAG cycle detection tests
    ├── ingest.test.ts                    # Ingest idempotency, dangling parent warning, error isolation
    └── e2e.test.ts                       # Full end-to-end API lifecycle test
```

---

## 3. Real PostgreSQL vs Embedded PGlite

The system seamlessly supports both real PostgreSQL (e.g. Neon, Supabase, AWS RDS, Docker) and embedded PGlite:

1. **Real PostgreSQL (Production & Scaled Deployments)**:
   - Configured via `DATABASE_URL` in `.env` (e.g. `postgresql://user:pass@ep-xxx.neon.tech/schemesaathi?sslmode=require`).
   - Configurable SSL verification via `DB_SSL_REJECT_UNAUTHORIZED` (defaults to `true`).
   - Native multi-process connection pooling (`pg.Pool`), transaction safety, and concurrent writers.
   - Full support for PostgreSQL extensions: `pg_trgm` (trigram fuzzy matching) and `to_tsvector` GIN indexes for sub-millisecond database-backed full-text search.
2. **Catalogue Search: Cache vs Database**:
   - `GET /api/v1/schemes?q=pension&source=cache`: Fast in-memory cache lookup (< 2ms).
   - `GET /api/v1/schemes?q=pension&source=db`: Database-driven Postgres full-text (`to_tsvector('simple', official_name) @@ plainto_tsquery('simple', :q)`) and trigram search.
3. **Embedded PGlite (Local Zero-Config Developer Fallback)**:
   - If PostgreSQL is not reachable, the engine uses embedded `@electric-sql/pglite`.
   - *Note on PGlite*: PGlite executes PostgreSQL directly in WebAssembly. In persistent file mode (`.db_data/`), it is single-process only (holds a filesystem lock on `postmaster.pid`). Multi-process scaling requires Real PostgreSQL.

---

## 4. Next-Questions Information-Gain Ranking Formula

The questionnaire dynamically selects the most decisive questions using entropy / information gain:

$$\text{impact\_score} = (\text{resolved\_scheme\_count} \times 5 + \text{schemes\_affected}) \times W_H$$

Where:
- **$\text{resolved\_scheme\_count}$ ($R$)**: Count of still-possible (`UNKNOWN`) schemes where this attribute is the **sole remaining unknown** ($|unknowns| = 1$). Answering this question immediately resolves the scheme to `ELIGIBLE` or `NOT_ELIGIBLE`.
- **$\text{schemes\_affected}$ ($S$)**: Total count of still-possible (`UNKNOWN`) schemes that list this attribute as missing. Schemes already evaluated as `NOT_ELIGIBLE` are ignored.
- **$W_H$ (Household Weight Multiplier)**: High-leverage household-wide attributes that clarify eligibility across multiple schemes and family members receive a **$2.5\times$** weight multiplier:
  - Marital status (`marital_status`, `is_widow`)
  - Poverty & Ration cards (`in_bpl_list`, `ration_card_type`, `holds_orange_ration_card`, `holds_yellow_orange_aay_or_white_ration_card`, `holds_nfsa_ration_card`)
  - Disability status (`disability_percentage`, `has_disability`, `pwd_category`)
  - Area type (`area_type`: `URBAN` / `RURAL` / `URBAN_SLUM`)
  - Any attribute with `scope === "household"`
  - All other individual attributes receive $W_H = 1.0$.

---

## 5. Response Shape & Geography Pre-Filtering

- **Pure Geography Filtering**: Schemes that fail **solely** on geographic jurisdiction (such as Gadchiroli Overlay `LOCAL-GAD-PMAYG-ENHANCED-020` for a Nagpur resident) are hidden from default results to avoid cluttering citizen feeds.
- **`include_all=true` Flag**: When set, returns all schemes regardless of geographic exclusion, enabling exhaustive auditing and admin visibility.
- **Partitioned Results**:
  - `eligible`: Schemes satisfying all statutory rules and pathways.
  - `likely`: Schemes in `UNKNOWN` status with $\le 2$ missing attributes (actionable with quick follow-up).
  - `unknown`: Schemes requiring deeper documentation or unverified data.
  - `not_eligible`: Schemes with unmet statutory criteria or exclusion triggers.
  - `not_eligible_by_reason`: Grouped by primary localized reason for clear citizen explanation.

---

## 6. Review Flags & Admin Pending Reviews

- Display strings in Hindi, Marathi, and English are clean natural language sentences suitable for low-literacy citizens.
- Review status is tracked strictly as metadata:
  - `review_status: 'machine_drafted' | 'reviewed'`
  - `help_text_source: 'dataset' | 'unverified'`
- **Admin Endpoint**: `GET /api/v1/admin/pending-reviews` lists all attributes and scheme translation placeholders that still require human review.

---

## 7. How to Run

```bash
# 1. Install dependencies
pnpm install

# 2. Run migrations
pnpm migrate

# 3. Seed database (curated question bank, 24 official schemes, prerequisites)
pnpm seed

# 4. Start development server (OpenAPI Swagger at http://localhost:3000/docs)
pnpm dev

# 5. Run Vitest test suite
pnpm test

# 6. Run lint check
pnpm lint

# 7. Run scale benchmark (Cache vs Database search, 6-member household, next-questions)
pnpm bench

# 8. Run Audit Demo Proof (62yo widow persona, 24-scheme table, drop-in scheme)
npx tsx scripts/demo-proof.ts
```
