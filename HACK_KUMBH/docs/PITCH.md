# SchemeSaathi (योजनासाथी) — Pitch & Evaluation Deck

> **Welfare Screening & Access Assistant for Nagpur and Vidarbha**  
> *Built for daily-wage workers, women, farmers, and seniors in Maharashtra.*

---

## 1. The Problem

Over **700+ Central and Maharashtra State welfare schemes** exist, with billions of rupees allocated annually. Yet, in rural and peri-urban Vidarbha (Nagpur, Wardha, Gadchiroli, Chandrapur, Amravati, Yavatmal, Bhandara, Gondia):
- **High Exclusion Errors**: Low-literacy citizens (daily-wage earners, widows, senior farmers) miss out because criteria are buried in complex government resolutions (GRs) and English/bureaucratic jargon.
- **Predatory Middlemen**: Unofficial agents ("dalals") charge ₹500–₹2,000 to apply for schemes that are legally free.
- **Document Deficits & Dead-Ends**: Families travel hours to taluka offices only to be turned away because of missing prerequisite certificates (e.g., needing an Income Certificate before applying for a Caste/Housing grant).
- **Digital Divide**: Government portals are rarely optimized for low-end mobile devices (360px viewport), poor 2G/3G connectivity, or local Marathi dialects.

---

## 2. The Solution: SchemeSaathi

SchemeSaathi is an **accessibility-first, multilingual, offline-capable welfare screening assistant** designed for direct citizen use or assisted operation by grassroots NGO volunteers.

### Core Philosophy: Truthful Screening
- **Screening Only**: We clearly tell the citizen: *"Based on what you told us, you can apply. The government office verifies and makes the final decision."*
- **No False Promises**: The system strictly forbids promissory phrasing like *"You will receive ₹1,500"* or *"तुम्हाला मिळेल"*.
- **Three-Tier Eligibility**:
  1. **You Can Apply (`can_apply`)**: Only curated or verified schemes where evaluated mandatory rules match answered profile attributes.
  2. **Likely, Confirm (`likely_confirm`)**: Curated schemes with 1–3 missing details that can be answered to confirm eligibility.
  3. **Not Eligible (`unlikely`)**: Collapsed by default with plain-language explanations of why the criteria were not met.
  - *Explore Bucket (`explore`)*: Unverified imported schemes are kept in a separate capped section labeled *"Rules not verified — check with local office"*.

---

## 3. Three-Minute Live Demo Script

| Timing | Focus Area | What the Audience Sees | What You Say |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | **Accessibility & Language** | Mobile 360px view. Tap **"मराठी"**, tap text scale **"A++"** (23px). Tap **"ऐका" (Listen)** button. | *"We start where the citizen starts: a budget Android device. With one tap, the interface switches to Marathi and scales up to high-legibility A++ without any horizontal scroll. Every screen features audio readouts."* |
| **0:45 – 1:45** | **The Citizen Journey** | Persona: 62yo widow, Nagpur, income ₹20,000/yr, BPL, 15 yrs in Maharashtra. Tap **"योजना पहा" (See Schemes)**. | *"Here is Suman-tai, a 62-year-old widow from Nagpur. In two minutes, SchemeSaathi evaluates 700+ schemes. Under 'You can apply', she immediately qualifies for the National Social Assistance Programme (NSAP) and Sanjay Gandhi Niradhar Anudan. PM-JAY appears under 'Likely' pending ration card verification, while Shravan Bal is correctly marked Not Eligible because its minimum age is 65."* |
| **1:45 – 2:15** | **Actionable Roadmap** | Tap **Pre-Trip Checklist** and **Document Chain**. | *"Instead of multiple wasted trips, Suman-tai gets a pre-trip checklist. Our topological solver computes the exact sequence: she needs her Tahasildar Income Certificate first, before applying for her pension."* |
| **2:15 – 3:00** | **Privacy, Consent & NGO Portal** | Tap **"माहिती जतन करा" (Save Profile)**, view simulated SMS in `/inbox`. Log in as Admin on `/ngo`. | *"Privacy is paramount: no 12-digit Aadhaar numbers are stored, and access is protected by a cryptographic secret. SMS reminders are simulated locally to prevent carrier spam. Finally, on our NGO dashboard, field coordinators can view uptake metrics and identify under-served talukas across Vidarbha."* |

---

## 4. Technical Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SchemeSaathi Web (PWA)                          │
│   React 18 + TS Strict | Tailwind CSS | TanStack Query | Offline Queue │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST API (X-API-Key / X-Household-Secret)
┌────────────────────────────────────▼───────────────────────────────────┐
│                     SchemeSaathi Backend (Fastify)                     │
│  ┌──────────────────────┬──────────────────────┬────────────────────┐  │
│  │   AST Rule Engine    │   Prerequisite DAG   │   Quality Gate     │  │
│  │   & Normalizer       │   Topological Solver │   Curated / Explore│  │
│  └──────────────────────┴──────────────────────┴────────────────────┘  │
│  ┌──────────────────────┬──────────────────────┬────────────────────┐  │
│  │   SMS Safety Layer   │   Beep Audio Guard   │   Role-Based Auth  │  │
│  │   Synthetic Guard    │   440Hz Tone Reject  │   Admin/Vol/Citizen│  │
│  └──────────────────────┴──────────────────────┴────────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Drizzle ORM
┌────────────────────────────────────▼───────────────────────────────────┐
│                    PostgreSQL 16 Relational Database                   │
│   Schemes (738) | Attributes | Households | Consents | Audit Trail     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Honest Limitations (What We Do Not Claim)

1. **Screening, Not Sanctioning**: SchemeSaathi is an advisory screening tool. Government officials (Tahasildar, BDO, CSC operators) verify original documents and make final award decisions.
2. **No Real-Time Government Status Feed**: Due to government API restrictions, application statuses are citizen- or volunteer-reported, not synced from government departmental backends.
3. **Simulated SMS Messaging**: SMS notifications use an internal simulated gateway and inbox (`/inbox`). No telecommunications carrier charges or DLT registration dependencies exist.
4. **Synthetic NGO Demo Data**: The 300 demo households across Vidarbha are synthetic mock records created by `pnpm seed:demo-ngo`. The under-served metric is a proxy heuristic based on document friction and poverty rates.
5. **Indic Language Review**: Hindi and Marathi question strings and scheme summaries are machine-drafted and require native linguistic field review prior to mass rollout.
6. **Voice Synthesis**: Our AI4Bharat Indic-Conformer pipeline architecture is defined; cached audio files containing 440 Hz tones are safely treated as absent by our Beep Audio Guard, falling back to client speech synthesis.
7. **Map View**: The interactive district map requires latitude/longitude coordinates; where coordinates are absent, a taluka text directory is displayed instead of fake map pins.
8. **Deployment Scope**: Fully tested and benchmarked against local real PostgreSQL on port 5432.

---

## 6. Ten Judge Questions & Truthful Answers

### Q1: Is this an official government application?
> **Answer**: No. SchemeSaathi is an open-source civic tech platform developed to assist citizens and grassroots NGOs in navigating complex welfare schemes. Government offices maintain exclusive authority to verify documents and sanction benefits.

### Q2: What prevents your system from promising benefits you cannot deliver?
> **Answer**: Our backend and frontend enforce strict linguistic guards against promissory language (e.g., regex checks forbidding *"you will receive"*, *"guaranteed benefit"*, or *"तुम्हाला मिळेल"*). We only classify schemes as *"You can apply"* when curated rules evaluate to true against answered criteria.

### Q3: How do you prevent a regular citizen user from escalating privileges to volunteer or admin?
> **Answer**: Authorization is strictly derived from the server-configured API key (`x-api-key`). Client-asserted headers like `X-User-Role` are completely ignored for authorization. An authenticated citizen key requesting `/admin/*` endpoints is denied with an HTTP 403 Forbidden.

### Q4: How do you handle sensitive personal data like Aadhaar numbers?
> **Answer**: We strictly enforce a Zero-Sensitive-ID storage policy. A regex validation filter detects and rejects 12-digit Aadhaar numbers in free-text fields (while safely allowing numeric incomes and 10-digit mobile numbers). Furthermore, household deletion performs an instantaneous cascade erase across all 6 referencing database tables.

### Q5: Why are SMS messages simulated instead of being sent to real mobile numbers?
> **Answer**: Indian telecom regulations require enterprise DLT header and template registration for transactional SMS. To ensure total user privacy and avoid unsolicited carrier messaging during evaluations, we built a simulated SMS provider and inbox. Synthetic demo households are cryptographically barred from external carrier gateways.

### Q6: What is the "Beep Audio Guard" and why is it necessary?
> **Answer**: During early testing, mock speech precomputation generated 440 Hz sine-wave test tones. Rather than playing jarring tones to rural citizens, our Beep Audio Guard inspects the manifest, flags mock/tone files as absent (HTTP 404), and gracefully instructs the UI to use the device's native speech synthesis in Marathi or Hindi.

### Q7: How does SchemeSaathi handle unverified or scraped schemes from external datasets?
> **Answer**: We separate data by ingestion source (`curated` vs `imported`). Curated schemes (24 schemes) have human-reviewed rule expressions. Imported schemes are tagged `verified = false` by default, quarantined to a secondary "Explore" bucket, and never labeled as *"You can apply"* until verified by an administrator.

### Q8: How does the application perform in rural areas with spotty network coverage?
> **Answer**: SchemeSaathi is a certified Progressive Web App (PWA) with service workers. It caches the question bank and documents locally. Answers submitted during offline periods are queued in IndexedDB and automatically synchronized once internet connectivity resumes.

### Q9: Where did the data for the NGO dashboard originate?
> **Answer**: The 300 households and applications across the 8 Vidarbha districts are synthetic demo records created by `pnpm seed:demo-ngo`. The dashboard displays a prominent "Synthetic demo data" banner and provides a toggle allowing administrators to separate real citizen records from synthetic benchmarks.

### Q10: How can a non-literate citizen use the platform without assistance?
> **Answer**: The citizen can use single-question mode with large visual icons, A++ high-legibility typography (23px root), and integrated audio read-aloud buttons on every prompt. Alternatively, a trained village volunteer (Gram Sevak or ASHA worker) can operate the questionnaire on the family's behalf in authenticated assisted mode.
