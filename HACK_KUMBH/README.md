# SchemeSaathi (स्कीम साथी) — Hack Kumbh

> **Multilingual Government Welfare Scheme Discovery, Dynamic Eligibility Engine & Indic Voice Assistant**  
> *Targeted for Maharashtra (Vidarbha / Nagpur focus) & Central Indian Welfare Programs*

---

## Overview

**SchemeSaathi** is an intelligent, low-literacy-first welfare scheme assistant designed to bridge the gap between complex government welfare schemes and citizens who need them most. Built for **Hack Kumbh**, it provides:

- **Safe, Dynamic Eligibility Evaluation**: A zero-`eval` recursive-descent expression parser supporting complex Boolean pathways, exclusions, and sub-scheme variants.
- **Dynamic Next-Questions Ranking**: Entropy and information-gain questionnaire ranking that minimizes questions needed to establish eligibility.
- **₹0-Billing Indic Voice AI**: Locally hosted AI4Bharat open models (`IndicConformer` 600M for Speech-to-Text and `Indic-Parler-TTS` for natural Hindi & Marathi voice synthesis).
- **Rural & Low-Literacy Accessibility**: Spoken-word summaries, plain-language bureaucracy simplification, high-contrast typography tiers (up to 30px), and offline-precomputed scheme audio.

---

## Monorepo Architecture

```
HACK_KUMBH/
├── DATASET/                             # Scheme knowledge base & structured rules
│   ├── central_schemes_dataset.xlsx     # Central government schemes master dataset
│   ├── central_schemes_master.csv       # Cleaned CSV of central schemes
│   ├── central_scheme_faqs.csv          # Citizen FAQs for central schemes
│   ├── maharashtra_vidarbha_schemes_... # Maharashtra / Vidarbha regional schemes
│   ├── eligibility_rules_structured_... # Parsable eligibility criteria & predicates
│   ├── vidarbha_scheme_district_mapp... # 11 Vidarbha district mappings
│   └── README.md                        # Dataset documentation & schemas
│
├── schemesaathi-backend/                # Core Eligibility Engine & API
│   ├── src/                             # TypeScript source code
│   │   ├── server.ts                    # Fastify API entrypoint & Swagger documentation
│   │   ├── config.ts                    # Configuration loader & validation
│   │   ├── db/                          # Drizzle ORM schema, migrations, connection pool
│   │   ├── engine/                      # Expression parser, 3-valued evaluator, question ranking
│   │   ├── ingest/                      # Scheme validation, geo-resolver, ingestion CLI
│   │   ├── modules/                     # Catalogue, eligibility, households, applications
│   │   └── services/                    # Auth, caching, and notification ports
│   ├── scripts/                         # Database cleaning, verification, and demo proofs
│   ├── test/                            # End-to-end and unit test suite (Vitest)
│   ├── data/                            # Drop-in scheme JSON files & prerequisite DAGs
│   ├── .env.example                     # Sample environment variable template
│   ├── docker-compose.yml               # PostgreSQL container orchestration
│   ├── package.json                     # Node.js dependencies and scripts
│   └── README.md                        # Backend documentation & deep architectural dive
│
├── tts_stt/                             # Indic Voice & Accessibility Stack
│   ├── service/                         # FastAPI inference microservice (Python)
│   │   ├── server.py                    # AI4Bharat STT & TTS endpoints + health checks
│   │   ├── requirements.txt             # PyTorch, torchaudio, parler-tts dependencies
│   │   ├── Dockerfile                   # Audio-ready container definition (ffmpeg, libsndfile)
│   │   └── docker-compose.yml           # Microservice container setup
│   ├── client/                          # Typed TypeScript client wrapper
│   │   ├── indicVoiceClient.ts          # Client implementation with fetch & FormData
│   │   └── index.ts                     # Module export
│   ├── accessibility/                   # Low-literacy typography & spoken script simplifier
│   ├── audio_cache/                     # Precomputed scheme audio (.wav files ignored by git)
│   │   ├── audio_manifest.json          # Checksums, durations, and language metadata
│   │   └── .gitkeep                     # Preserves directory in git
│   ├── .env.example                     # Voice service configuration template
│   └── README.md                        # Model licenses, setup steps, and Colab GPU instructions
│
├── government_welfare_schemes.json      # Master scheme dataset (24 verified schemes)
├── .gitignore                           # Git ignore rules for dependencies, env, & caches
└── .gitattributes                       # Line ending and binary file definitions
```

---

## Key Modules & Technologies

| Layer | Technologies | Role |
|---|---|---|
| **Eligibility Engine** | Node.js, TypeScript, Fastify, Zod | Pure 3-valued logic (`ELIGIBLE`, `LIKELY`, `NOT_ELIGIBLE`, `UNKNOWN`), zero-`eval` safe AST parser |
| **Database & Search** | PostgreSQL, PGlite (Wasm), Drizzle ORM | Trigram fuzzy search (`pg_trgm`), full-text search (`to_tsvector`), embedded fallback |
| **Voice Inference** | Python 3.10+, FastAPI, PyTorch, AI4Bharat | `indic-conformer-600m-multilingual` (STT), `indic-parler-tts` (TTS in Hindi/Marathi) |
| **Accessibility** | TypeScript, CSS/HTML tokens | Large-text presets (22px / 30px), administrative jargon simplification |
| **Dataset** | Excel, CSV, JSON | 24 core schemes across agriculture, health, housing, pension, and education |

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20 or higher
- **pnpm**: v9 or higher (`npm install -g pnpm`)
- **Python**: 3.10+ (for voice microservice)
- **FFmpeg**: Required for 16 kHz audio conversion

---

### 1. Setting Up the Backend

```bash
cd schemesaathi-backend

# 1. Copy environment template
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Run database migrations
pnpm migrate

# 4. Seed the database with official schemes and question bank
pnpm seed

# 5. Start the development server
pnpm dev
```
*API Swagger Documentation will be accessible at: `http://localhost:3000/docs`*

---

### 2. Setting Up the Voice Microservice (`tts_stt`)

```bash
cd tts_stt/service

# 1. Set up virtual environment
# Windows:
setup.bat
# Linux / macOS:
bash setup.sh

# 2. Start the FastAPI inference service
uvicorn server:app --host 0.0.0.0 --port 8000
```

> **Note on Voice Mocking**: For local development without a dedicated GPU, set `MOCK_VOICE=true` in your environment to test the full frontend/backend flow using generated sine-wave audio placeholders without downloading the multi-gigabyte AI4Bharat neural weights.

---

### 3. Running Tests

```bash
# Backend unit and integration tests
cd schemesaathi-backend
pnpm test

# Voice microservice unit tests
cd tts_stt/service
pytest test_server.py
```

---

## Environment & Secrets Policy

- **Never commit `.env` files**: All secrets, database connection strings, and API keys must remain local.
- **Commit `.env.example`**: Keep example files updated with placeholder values whenever new configuration keys are added.
- **Audio Cache**: WAV audio files in `tts_stt/audio_cache/` are gitignored to prevent repository bloat. Use `tts_stt/audio_manifest.json` for cataloging generated audio.

---

## License & Contributing

Built for Hack Kumbh 2026. Distributed under the MIT License.
