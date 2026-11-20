# SchemeSaathi — Comprehensive Test Execution Report

**Date of Execution**: November 20, 2026  
**Environment**: Windows 11 | Node.js v24.13.0 | pnpm v10.4.1  
**Database**: Real PostgreSQL 16 on `localhost:5432/schemesaathi` (No PGlite mock in test/demo runs)

---

## 1. Summary of Test Suites

| Suite Category | Framework | Test Files | Total Tests | Passed | Failed | Database Environment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Test Suite** | Vitest 3.2.7 | 15 | 82 | 82 | 0 | **Real PostgreSQL** (10 suites) & In-Memory Unit (5 suites) |
| **Frontend Unit Suite** | Vitest 2.1.9 | 5 | 16 | 16 | 0 | **Mocked API / jsdom** |
| **End-to-End Suite** | Playwright 1.49.1 | 1 | 8 | 8 | 0 | **Live Backend + Real PostgreSQL** |
| **Total** | | **21** | **106** | **106** | **0** | |

---

## 2. Backend Test Suite Breakdown (`schemesaathi-backend`)

Command executed: `pnpm test -- --reporter=verbose`  
Target: `postgresql://postgres:postgrespassword@localhost:5432/schemesaathi`

### A. Database-Backed Test Suites (Real PostgreSQL)
1. **`test/ngo-seed.test.ts`** (3 tests) — **Real PostgreSQL**
   - `seeds clearly marked synthetic households, members, applications, and outcomes across Vidarbha` (PASS)
   - `proves seed:demo-ngo is idempotent and supports --reset` (PASS)
   - `verifies GET /api/v1/meta reports synthetic flags for dashboard banner` (PASS)

2. **`test/sms.test.ts`** (7 tests) — **Real PostgreSQL**
   - `defaults to SIMULATED provider and degrades cleanly with simulated_fallback for unconfigured external providers` (PASS)
   - `strictly respects consent: rejects SMS when consent is missing or withdrawn` (PASS)
   - `requires a valid 10-digit phone number and rejects missing or malformed numbers` (PASS)
   - `strictly enforces truthful wording: rejects 'you will receive' or promissory wording with 422` (PASS)
   - `stores simulated messages in database, enforces role authorization for GET/DELETE, and citizen privacy with X-Household-Secret` (PASS)
   - `SMS Safety: synthetic households (is_synthetic=true) are forced to SIMULATED provider even when external provider is active` (PASS)
   - `POST /sms/send-test refuses with 400 when no household or phone is provided` (PASS)

3. **`test/faqs-and-admin.test.ts`** (10 tests) — **Real PostgreSQL**
   - `GET /api/v1/faqs searches across 8,800+ FAQs` (PASS)
   - `GET /api/v1/schemes/:id/faqs returns FAQs cross-linked via myscheme_id` (PASS)
   - `GET /api/v1/admin/district-coverage returns 11 Vidarbha districts coverage summary` (PASS)
   - `GET /api/v1/admin/under-served-areas ranks districts by offline friction and intervention` (PASS)
   - `GET /api/v1/admin/schemes-uptake returns application statistics` (PASS)
   - `returns 403 FORBIDDEN when citizen key accesses /admin/district-coverage` (PASS)
   - `returns 403 FORBIDDEN when volunteer key accesses /admin/district-coverage` (PASS)
   - `returns 401 UNAUTHORIZED when no API key is provided for /admin/district-coverage` (PASS)
   - `returns 401 UNAUTHORIZED when invalid API key is provided for /admin/district-coverage` (PASS)
   - `returns 200 OK when admin key is provided for /admin/district-coverage` (PASS)

4. **`test/hardening.test.ts`** (8 tests) — **Real PostgreSQL**
   - `enforces API key derived roles, rejects role spoofing via headers` (PASS)
   - `loads consistency rules from external JSON and validates types` (PASS)
   - `proves DELETE /households/:id cascades across all 6 dependent tables` (PASS)
   - `guards against sensitive IDs without rejecting large integers or valid phones` (PASS)
   - `verifies dataset counts by source (curated vs imported)` (PASS)
   - `enforces Quality Gate: only curated or verified schemes appear in can_apply` (PASS)
   - `excludes bench data (is_test=true) from all catalogue queries` (PASS)
   - `normalises answer keys with warnings on legacy operator aliases` (PASS)

5. **`test/e2e.test.ts`** (1 test) — **Real PostgreSQL**
   - `API End-to-End Workflow: completes full end-to-end user journey` (PASS)

6. **`test/profile-and-lifecycle.test.ts`** (5 tests) — **Real PostgreSQL**
   - `executes the complete citizen profile journey with answers provenance and right to be forgotten` (PASS)
   - `maintains immutable audit trail for volunteer-assisted submissions` (PASS)
   - `enforces consent purpose specificity before processing sensitive attributes` (PASS)
   - `proves complete row count erasure after household deletion` (PASS)
   - `returns 3-tier eligibility hierarchy with quality-gated can_apply` (PASS)

7. **`test/source-and-meta.test.ts`** (7 tests) — **Real PostgreSQL**
   - `GET /api/v1/meta returns dataset version, source counts, and synthetic flags` (PASS)
   - `GET /schemes differentiates curated vs imported via source column` (PASS)
   - `marks imported schemes unverified by default` (PASS)
   - `ranks explore schemes by demographic relevance` (PASS)
   - `verifies CORS headers based on configured origins` (PASS)
   - `rejects is_test synthetic schemes from production eligibility` (PASS)
   - `validates API key authentication against configured roles` (PASS)

8. **`test/access-secret.test.ts`** (2 tests) — **Real PostgreSQL**
   - `POST /households/claim generates and stores SHA-256 access secret hash` (PASS)
   - `allows household profile retrieval using X-Household-Secret header` (PASS)

9. **`test/ingest.test.ts`** (2 tests) — **Real PostgreSQL**
   - `loads sample file, reports dangling parent warning, and verifies idempotency` (PASS)
   - `rejects an invalid scheme with a report while allowing valid schemes to load` (PASS)

10. **`test/voice.test.ts`** (8 tests) — **Real PostgreSQL + Filesystem**
    - `detects mock_mode and degrades cleanly when voice service is offline` (PASS)
    - `supports root alias /voice/health` (PASS)
    - `returns 503 VOICE_SERVICE_UNAVAILABLE when voice synthesis service is unreachable` (PASS)
    - `rejects empty text with 400 TEXT_REQUIRED` (PASS)
    - `returns 404 AUDIO_NOT_FOUND when precomputed audio is absent` (PASS)
    - `Beep Audio Guard: treats cached scheme audio flagged mock/tone as ABSENT (404) so UI falls back to speech synthesis` (PASS)
    - `delivers static precomputed audio with cache headers when entry is not flagged mock/tone` (PASS)
    - `proves audio is never stored or logged to disk, and rejects audio > 30s` (PASS)

### B. In-Memory / Pure Logic Test Suites
11. **`test/geography.test.ts`** (5 tests) — **Pure Unit** (Geo taxonomy, Vidarbha 11 districts)
12. **`test/evaluator.test.ts`** (5 tests) — **Pure Unit** (Rule evaluation matrix)
13. **`test/expression-parser.test.ts`** (9 tests) — **Pure Unit** (AST and boolean logic compiler)
14. **`test/normalizer.test.ts`** (6 tests) — **Pure Unit** (Attribute alias & type coercer)
15. **`test/prerequisites.test.ts`** (4 tests) — **Pure Unit** (Document prerequisite DAG topological sort)

---

## 3. Frontend Unit Test Suite Breakdown (`schemesaathi-web`)

Command executed: `pnpm test`  
Environment: `jsdom` with Vitest 2.1.9

1. **`src/test/sensitive-id.test.ts`** (4 tests) — **Mocked / Unit**
   - `detects and blocks 12-digit Aadhaar pattern in free-text fields` (PASS)
   - `allows 10-digit phone numbers and does not false-positive as Aadhaar` (PASS)
   - `allows numeric income values up to 12 digits without false positive` (PASS)
   - `redacts sensitive identifiers in log serialization` (PASS)

2. **`src/test/offline-storage.test.ts`** (2 tests) — **Unit / Mocked Storage**
   - `enqueues answers when offline and syncs on connection restore` (PASS)
   - `persists draft questionnaire progress across browser restarts` (PASS)

3. **`src/test/i18n.test.ts`** (3 tests) — **Pure Unit**
   - `validates English dictionary key coverage` (PASS)
   - `validates Hindi translation dictionary key coverage` (PASS)
   - `validates Marathi translation dictionary key coverage` (PASS)

4. **`src/test/components.test.tsx`** (3 tests) — **Mocked React DOM**
   - `renders AccessibilityBar with font size and language toggles` (PASS)
   - `switches font scale from A to A+ and A++ updating document root` (PASS)
   - `renders AudioReadButton with fallback to browser speech synthesis` (PASS)

5. **`src/test/ngo-sms.test.tsx`** (4 tests) — **Mocked React DOM & API Client**
   - `renders SimulatedInboxView with prominent SIMULATED, not sent badge and send test widget` (PASS)
   - `renders SettingsView with Send test reminder button and link to simulated inbox` (PASS)
   - `refuses to send test SMS in SettingsView when there is no real household in the session (no silent fallback)` (PASS)
   - `shows the Synthetic demo data banner, district numbers, and synthetic-only toggle on NgoDashboard` (PASS)

---

## 4. End-to-End Suite Breakdown (`playwright test`)

Command executed: `pnpm test:e2e`  
Live Backend Server: `http://localhost:3000/api/v1` (Connected to Real PostgreSQL)  
Frontend Web Server: `http://localhost:5173`

1. `[Mobile Chrome 360px] Nagpur 62yo Widow Persona: UI-only driving from language to questionnaire taps to results` — **PASS (3.8s)**
   - Language selector tap: Marathi
   - Font scale tap: A++ (root font size 23px verified)
   - Persona input via UI taps: Age 62, Female, Widow, Nagpur, 15 yrs in Maharashtra, INR 20,000 income, BPL
   - Verification of Results:
     - Tier 1 "तुम्ही अर्ज करू शकता" (You can apply): `CENT-MORD-NSAP-006` and `MH-SJSA-SANJAYGANDHI-014` visible
     - Tier 2 "संभाव्य, खात्री करा" (Likely, confirm): PM-JAY (`CENT-MOHFW-PMJAY-002` and `MH-PHD-MJPJAY-017`) visible
     - Collapsed Tier 3 "पात्र नाही" (Not eligible): `MH-SJSA-SHRAVANBAL-015` collapsed under not eligible
     - Explore section: hidden until explicitly toggled
   - Accessibility assertion: At 360px viewport + A++ font scaling, `scrollWidth <= clientWidth` (360px <= 360px, NO horizontal scroll) and no clipped text.

2. `[Mobile Chrome 360px] One-question-per-screen flow -> Save > Consent > Claim -> Reload and read with stored secret` — **PASS (1.2s)**
   - Answers single questions adaptively
   - Claims profile with phone & explicit consents
   - Reloads page and retrieves saved answers via stored `X-Household-Secret`

3. `[Mobile Chrome 360px] NGO Portal: Admin key unlocks /ngo, displays Synthetic demo data banner, and non-zero district numbers` — **PASS (808ms)**
   - Admin secret unlocks NGO portal
   - Verifies "Synthetic demo data" prominent banner
   - Confirms non-zero district counts across 8 Vidarbha districts

4. `[Mobile Chrome 360px] Simulated SMS: Send test reminder -> /inbox displays the prominent SIMULATED badge and cards` — **PASS (725ms)**
   - Verifies session household SMS consent
   - Triggers test reminder in Settings
   - Confirms simulated inbox card with "SIMULATED, not sent" label and zero promissory wording

5. `[Desktop Chrome 1280px] Nagpur 62yo Widow Persona: UI-only driving from language to questionnaire taps to results` — **PASS (2.9s)**
   - Desktop parity verification of the core Marathi widow flow

6. `[Desktop Chrome 1280px] One-question-per-screen flow -> Save > Consent > Claim -> Reload and read with stored secret` — **PASS (1.3s)**
   - Desktop parity verification of save, claim, and secret retrieval

7. `[Desktop Chrome 1280px] NGO Portal: Admin key unlocks /ngo, displays Synthetic demo data banner, and non-zero district numbers` — **PASS (886ms)**
   - Desktop parity verification of NGO portal & blended metric toggle

8. `[Desktop Chrome 1280px] Simulated SMS: Send test reminder -> /inbox displays the prominent SIMULATED badge and cards` — **PASS (862ms)**
   - Desktop parity verification of simulated SMS inbox
