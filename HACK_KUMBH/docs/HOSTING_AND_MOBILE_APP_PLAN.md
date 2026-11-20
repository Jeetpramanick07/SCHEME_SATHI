# SchemeSaathi: Hosting Architecture & Mobile App Strategy Plan

This document outlines the complete roadmap and step-by-step instructions for:
1. **Hosting & Deploying SchemeSaathi** (Frontend, Fastify API Backend, PostgreSQL Database, and TTS/STT Voice Microservice).
2. **Transforming SchemeSaathi into an Android & iOS Mobile Application** (Capacitor Native Shell + Progressive Web App).

---

## Part 1: Hosting & Cloud Deployment Architecture

SchemeSaathi consists of three decoupled components:
- **`schemesaathi-web`**: Single-Page Application (React 18 + Vite + Tailwind CSS).
- **`schemesaathi-backend`**: High-performance REST API (Node.js + Fastify + TypeScript).
- **Database**: PostgreSQL 15+ (with 738 curated schemes, rules, and synthetic test datasets).
- **`tts_stt`**: Multilingual voice service (FastAPI + Coqui/Edge-TTS + Whisper).

```
                      ┌──────────────────────────────────────────────┐
                      │              Citizens & Field NGOs           │
                      └──────────────────────┬───────────────────────┘
                                             │
                       HTTPS / WSS           │    Mobile App (Capacitor)
                      ┌──────────────────────▼───────────────────────┐
                      │      Frontend: Vercel / Cloudflare Pages     │
                      │           (schemesaathi.vercel.app)          │
                      └──────────────────────┬───────────────────────┘
                                             │ REST API (JSON)
                                             │ x-api-key / x-access-secret
                      ┌──────────────────────▼───────────────────────┐
                      │    Backend API: Render / Railway / Fly.io    │
                      │          (api.schemesaathi.com:3000)         │
                      └──────────────┬────────────────────────┬──────┘
                                     │                        │
               PostgreSQL Connection │                        │ HTTP / RPC
                                     ▼                        ▼
      ┌──────────────────────────────────────────┐  ┌─────────────────────────────────┐
      │ Cloud PostgreSQL: Supabase / Neon / AWS  │  │ Voice Microservice: HF / Docker │
      │   (738 Schemes, Ingestion, Analytics)    │  │ (Hindi, Marathi, English Audio) │
      └──────────────────────────────────────────┘  └─────────────────────────────────┘
```

---

### Recommended Hosting Stacks

| Tier | Frontend | Backend API | Database | Voice Service | Est. Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Free Hackathon / Demo Stack** *(Recommended Now)* | **Vercel** or **Netlify** (Free) | **Render** or **Railway** (Free $5 Credit) | **Supabase** or **Neon.tech** (Free Tier 500MB) | Client Web Speech + Edge-TTS fallback | **\$0 / month** |
| **B. Low-Cost Production ($10–$25/mo)** | **Cloudflare Pages** (Free) | **Railway** or **DigitalOcean App Platform** ($5–$12) | **Supabase Pro** or **Render Managed Postgres** ($7–$15) | Render Docker container ($7/mo) | **~$15–$25 / month** |
| **C. Enterprise / GovCloud (NIC / MeitY compliant)** | **AWS CloudFront + S3** | **AWS ECS Fargate** or **GCP Cloud Run** | **AWS RDS PostgreSQL** (Multi-AZ) | **GCP / AWS TTS & STT** (Bhashini API) | Production Usage-based |

---

### Step-by-Step Deployment Guide (Stack A: 100% Free / Immediate)

#### Step 1: Provision the Managed PostgreSQL Database (Supabase / Neon)
1. Sign up at [supabase.com](https://supabase.com) (or [neon.tech](https://neon.tech)).
2. Create a new project: `schemesaathi-db`.
3. In Database Settings, copy the URI connection string:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```
4. Run migrations and seed data from your machine to cloud:
   ```powershell
   cd HACK_KUMBH/schemesaathi-backend
   # Set the temporary cloud database url
   $env:DATABASE_URL="your-supabase-connection-string"
   $env:DB_SSL_REJECT_UNAUTHORIZED="false"
   pnpm run migrate
   pnpm run seed
   pnpm run seed:demo-ngo
   ```

#### Step 2: Deploy the Backend API (`schemesaathi-backend`) on Render or Railway
1. **Render.com** setup:
   - Create a **New Web Service** connected to your GitHub repo `Jeetpramanick07/SCHEME_SATHI`.
   - **Root Directory**: `HACK_KUMBH/schemesaathi-backend`
   - **Environment**: `Node`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `node dist/server.js` (or `npx tsx src/server.ts`)
2. **Environment Variables on Render**:
   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `HOST` | `0.0.0.0` |
   | `DATABASE_URL` | *Supabase PostgreSQL URL from Step 1* |
   | `DB_SSL_REJECT_UNAUTHORIZED` | `false` |
   | `CORS_ORIGIN` | `*` (or your Vercel frontend URL) |
   | `API_KEY_CITIZEN` | `citizen-production-secret-2026` |
   | `API_KEY_VOLUNTEER` | `volunteer-production-secret-2026` |
   | `API_KEY_ADMIN` | `admin-production-secret-2026` |
3. Note down the public backend URL: `https://schemesaathi-api.onrender.com`.

#### Step 3: Deploy the Frontend (`schemesaathi-web`) on Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select repository `Jeetpramanick07/SCHEME_SATHI`.
3. Set **Root Directory** to `HACK_KUMBH/schemesaathi-web`.
4. Framework preset: **Vite**.
5. **Environment Variables**:
   ```env
   VITE_API_BASE=https://schemesaathi-api.onrender.com/api/v1
   VITE_API_KEY_CITIZEN=citizen-production-secret-2026
   ```
6. Click **Deploy**. Vercel will build and assign an instant HTTPS URL: `https://schemesaathi.vercel.app`.

---

## Part 2: Mobile App Development Strategy

### Why Capacitor is the Optimal Mobile Path for SchemeSaathi
SchemeSaathi's web application was designed mobile-first:
- Bottom navigation bar (Home, Schemes, Documents, Track, Profile).
- Offline banner & IndexedDB local caching for low-connectivity rural zones.
- Responsive Tan/Peach/White/Green styling (`#C4714A`, `#FAF7F2`, `#4F7B55`).
- Multi-lingual toggles (Marathi, Hindi, English).

Using **Capacitor 6** gives us:
1. **100% Code Reuse**: Zero rewrite of business logic, question banks, or rules.
2. **Direct Native Android `.apk` / `.aab`**: Can be installed directly via WhatsApp/side-load or published on Google Play Store.
3. **Hardware Access**:
   - Native Device Text-to-Speech (Google TTS / Samsung TTS in Marathi & Hindi with zero latency).
   - Native Microphone (speech-to-text directly from keyboard or speech recognizer).
   - Camera: document photo capture for offline document plan storage.
   - Push Notifications: simulated application status updates delivered as system alerts.

---

### Step-by-Step Mobile App Build (Generating Android APK)

#### Phase 1: Install Capacitor into `schemesaathi-web`
Run inside `HACK_KUMBH/schemesaathi-web`:
```powershell
cd HACK_KUMBH/schemesaathi-web

# 1. Install Capacitor core and CLI
pnpm add @capacitor/core
pnpm add -D @capacitor/cli

# 2. Initialize Capacitor
npx cap init "SchemeSaathi" "in.gov.schemesaathi" --web-dir dist

# 3. Add Android platform
pnpm add @capacitor/android
npx cap add android
```

#### Phase 2: Add Native Plugins for Accessibility & Offline
```powershell
# Native Text-To-Speech (Hardware Hindi & Marathi voices)
pnpm add @capacitor-community/text-to-speech

# Native Speech Recognition (Hardware Mic STT)
pnpm add @capacitor-community/speech-recognition

# Device Camera for Document Scanning
pnpm add @capacitor/camera

# Push Notifications for Application Tracking
pnpm add @capacitor/push-notifications

# Network Status for Village Offline Mode
pnpm add @capacitor/network
```

#### Phase 3: Build Web Assets & Sync to Android
```powershell
# 1. Build the production React bundle
pnpm run build

# 2. Copy the dist bundle into native Android project
npx cap copy android
npx cap update android
```

#### Phase 4: Open in Android Studio & Export APK
```powershell
npx cap open android
```
Inside **Android Studio**:
1. Wait for Gradle sync to complete.
2. Go to **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
3. Android Studio outputs: `app/build/outputs/apk/debug/app-debug.apk`.
4. Transfer `app-debug.apk` to any Android phone or test in the Android Emulator!

---

### Progressive Web App (PWA) Implementation (Zero-Install Mobile Alternative)

For citizens who do not want to download a 40MB APK from the Play Store, SchemeSaathi can also be installed as a **Progressive Web App (PWA)** directly from Chrome / Safari with a 1-tap **"Install App"** prompt:

1. Add `vite-plugin-pwa`:
   ```powershell
   pnpm add -D vite-plugin-pwa
   ```
2. Configure `manifest.json` in `vite.config.ts`:
   - `name`: "SchemeSaathi - Sarkari Sahayak"
   - `short_name`: "SchemeSaathi"
   - `theme_color`: "#C4714A"
   - `background_color`: "#FAF7F2"
   - `display`: "standalone"
   - `icons`: [512x512 logo, 192x192 logo]
3. Automatic Service Worker caches 738 scheme guidelines and citizen documents for 100% offline access when travelling in rural areas.

---

## Part 3: Recommended Action Items & Timeline

```
Day 1: Cloud Provisioning
  ├── Step 1: Create Supabase DB and execute migrations & seed
  ├── Step 2: Deploy Fastify backend on Render/Railway
  └── Step 3: Deploy Frontend on Vercel with HTTPS

Day 2: Mobile App Packaging
  ├── Step 1: Initialize Capacitor in schemesaathi-web
  ├── Step 2: Configure Android project & splash screen/icons
  └── Step 3: Generate Android .apk for testing on real devices

Day 3: Demo & Submission
  ├── Live Web URL: https://schemesaathi.vercel.app
  ├── Android APK download link in README / Release tab
  └── Video demonstration showing both Web and Android APK flows
```
