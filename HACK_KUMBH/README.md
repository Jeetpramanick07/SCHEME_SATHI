# SchemeSaathi (योजनासाथी)

> **Multilingual Welfare-Scheme Assistant & Screening Engine for Vidarbha / Maharashtra**  
> *Built for daily-wage workers, women, farmers, and seniors in Nagpur and across Vidarbha.*

SchemeSaathi assists citizens and grassroots volunteers to discover, evaluate, and navigate government welfare schemes. It screens eligibility transparently based on user-provided profile attributes while strictly adhering to statutory screening guidelines: **it screens, government offices verify.**

---

## 1. Quick Start & Setup

### Prerequisites
- **Node.js** >= 20.x
- **pnpm** >= 9.x
- **PostgreSQL** >= 15 (Local PostgreSQL, Neon, or Supabase)

### Backend Setup (`schemesaathi-backend/`)
```bash
cd schemesaathi-backend

# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env   # Or review .env

# 3. Run database migrations & base seed
pnpm migrate
pnpm seed

# 4. Seed 300 synthetic Vidarbha demo households across 8 districts
pnpm seed:demo-ngo

# 5. Start backend development server
pnpm dev
# Backend runs at http://127.0.0.1:3000 (Swagger docs at /docs)
```

### Frontend Setup (`schemesaathi-web/`)
```bash
cd schemesaathi-web

# 1. Install dependencies
pnpm install

# 2. Start Vite development server
pnpm dev
# Web app runs at http://localhost:5173
```

---

## 2. Environment Variables

### Backend Configuration (`schemesaathi-backend/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for Fastify REST API |
| `HOST` | `0.0.0.0` | Bind host address |
| `DATABASE_URL` | `postgresql://postgres:postgrespassword@localhost:5432/schemesaathi` | PostgreSQL connection string (Neon / Supabase / Local Postgres) |
| `DB_SSL_REJECT_UNAUTHORIZED`| `true` | Enforce SSL certificate verification for cloud databases |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3000` | Allowed origins for web client |
| `API_KEY_CITIZEN` | `citizen-secret-key` | Default citizen API access key |
| `API_KEY_VOLUNTEER` | `volunteer-secret-key` | Grassroots volunteer key (entered at runtime) |
| `API_KEY_ADMIN` | `admin-secret-key` | NGO & administrator key (entered at runtime) |
| `SMS_PROVIDER` | `simulated` | `simulated` \| `msg91` \| `twilio` |
| `VOICE_SERVICE_URL` | `http://localhost:8000` | Optional external Piper TTS / Whisper STT microservice |

### Frontend Configuration (`schemesaathi-web/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE` | `http://localhost:3000/api/v1` | Backend REST API endpoint |
| `VITE_API_KEY_CITIZEN`| `citizen-secret-key` | Citizen anonymous screening key |
| `VITE_ENABLE_VOICE_INPUT`| `true` | Enables voice read & microphone speech recognition |
| `VITE_ENABLE_CHATBOT` | `false` | Enables conversational AI input layer |

---

## 3. Measured Results & Verification

### Test Suite Execution
- **Backend Test Suite (`vitest`)**:
  - **15 test files, 82 tests passed (100% pass)** against real PostgreSQL.
  - Verifies: Safe recursive AST expression evaluation, unbaked operators, geographic token resolution, ID Guard privacy (rejecting Aadhaar/PAN), DELETE CASCADE across 11 tables, role authorization (403 for non-admin on `/admin/*`), Beep Audio Guard (404 rejection of test tones), simulated SMS fallback & synthetic safety guard, and synthetic demo seeding.
- **Frontend Unit Tests (`vitest`)**:
  - **5 test files, 16 tests passed (100% pass)**.
  - Verifies: Accessibility bar, i18n switching, offline IndexedDB storage, sensitive ID detection, NGO banner & toggle, simulated inbox UI, and Settings SMS safety refusal without an active household.
- **End-to-End Tests (`playwright`)**:
  - **8 tests passed across Mobile Chrome (360px) and Desktop Chrome (17.5s)**.
  - UI-only persona traversal (Marathi -> A++ font scale with no horizontal clipping -> 62yo Widow -> NSAP & Sanjay Gandhi under "You Can Apply", PM-JAY under "Likely, Confirm", Shravan Bal under "Not Eligible").
  - Access secret generation & profile read with SHA-256 hashed secret.
  - NGO View: Admin key unlocks `/ngo`, shows synthetic banner, non-zero district counts, and synthetic-only toggle.
  - Simulated SMS: Send test reminder -> `/inbox` displays `SIMULATED, not sent` badge with truthful phrasing.

### Benchmark & Capacity Numbers
- **Active Scheme Catalogue**: **738 schemes** (24 curated gold-standard schemes, 714 imported schemes).
- **Synthetic NGO Scale**: **300 synthetic households** seeded across all 8 Vidarbha districts with realistic uptake skew:
  - Nagpur: 80 | Amravati: 45 | Chandrapur: 40 | Wardha: 35 | Yavatmal: 35 | Bhandara: 25 | Gondia: 25 | Gadchiroli: 15.
  - Outcomes: 132 Approved, 87 Rejected (categorized by realistic codes: `INCOME_EXCEEDED`, `AGE_NOT_MATCHED`, `CATEGORY_MISMATCH`, etc.), 81 Pending (27 stuck > 7 days).
- **Eligibility Engine Latency**: Under 25ms to evaluate 738 schemes across 60 profile attributes.

---

## 4. Architecture & Key Features

1. **Pure Data-Driven Rules (Zero `eval`)**:
   Eligibility criteria are compiled into structured Abstract Syntax Trees (AST) evaluated via a deterministic recursive-descent interpreter. No dynamic code execution or `eval()` is ever permitted.
2. **Strict Privacy by Design (Right to Be Forgotten)**:
   - Free-text answers are screened by an ID Guard that rejects 12-digit Aadhaar and PAN strings with 422 `SENSITIVE_ID_NOT_ALLOWED`.
   - `DELETE /api/v1/households/:id` triggers a verified cascade across all 11 tables, purging phone numbers, answers, applications, steps, reminders, and simulated SMS records.
   - Access secrets are SHA-256 hashed; administrators cannot view citizen credentials.
3. **Truthful Government Assistant Guardrails**:
   - The UI and SMS layers strictly prohibit promissory wording (e.g., "you will receive", "तुम्हाला मिळेल").
   - Transparent tiering: `can_apply` (You Can Apply), `likely_confirm` (Likely, Confirm), `explore` (Unverified, Inquire at Office), and `not_eligible` (Not Eligible).
4. **Accessibility First (Core, Not an Afterthought)**:
   - First-screen language selection (मराठी, हिन्दी, English).
   - Text scale toggles (`A`, `A+`, `A++` up to 23px) rigorously tested to ensure zero horizontal scrolling on 360px viewport devices (`scrollWidth <= clientWidth`).
   - Dual audio modes: precomputed offline audio with Beep Audio Guard + browser `speechSynthesis` fallback.

---

## 5. Explicit Limitations & Boundaries

1. **Screening Only (The Office Verifies)**:
   SchemeSaathi evaluates eligibility based on citizen self-declared inputs. It is an advisory screening aid, not an official sanctioning body. Final sanction, document verification, and disbursement are statutory prerogatives of local Tehsildar, Nayab Tehsildar, or district welfare offices.
2. **No Government Status Feed**:
   Due to state government API policies, SchemeSaathi does not interface directly with internal government disbursement feeds (e.g., MahaDBT, Aaple Sarkar, PFMS). Application statuses in the demo are citizen- or volunteer-updated.
3. **SMS Simulated (No DLT Registration)**:
   To ensure citizen privacy and avoid regulatory DLT header blocking or spam during demonstrations, the default SMS provider is `simulated`. Messages are stored locally in an in-app inbox and labeled `SIMULATED, not sent`. Synthetic test households are strictly prevented from ever contacting external telecom carriers.
4. **NGO Data Synthetic & Under-Served Metric is a Proxy**:
   The 300 demo households across Vidarbha are synthetic mock records created by `pnpm seed:demo-ngo`. The under-served area scores on the dashboard represent an analytical proxy based on document friction and poverty rates, not a live census feed.
5. **Hindi/Marathi Texts Machine-Drafted and Under Review**:
   Marathi and Hindi text strings were drafted via automated translation and verified for anti-promissory compliance. Localized regional dialects (e.g., Varhadi in Vidarbha) require native field review before official production release.
6. **AI4Bharat Voice Module Built but Real Audio Not Yet Generated**:
   The Indic-Conformer STT and Piper TTS integration architecture is fully built. However, the precomputed audio files currently in cache contain synthetic 440 Hz test tones. Our **Beep Audio Guard** treats all mock/tone files in the manifest as absent (HTTP 404), ensuring the UI cleanly falls back to the device's native browser speech synthesis.
7. **Map Hidden Until Coordinates Exist**:
   To prevent misinformation, the application renders interactive maps only when authentic latitude/longitude coordinates exist. When coordinates are missing, a clean taluka directory list is displayed instead of fake pins.
8. **Local PostgreSQL Only**:
   All database migrations, tests, benchmarks, and demo workflows have been executed and verified against local PostgreSQL 16 on `localhost:5432/schemesaathi`. Cloud PostgreSQL connectivity (Neon/Supabase) is architecturally supported via `DATABASE_URL` but was not used for this evaluation run.
