# SchemeSaathi: 3-Minute Live Marathi Demo Script

> **Persona**: Shrimati Sunita Kamble, a 62-year-old widow residing in Nagpur district, Vidarbha, Maharashtra.  
> **Demographics**: BPL ration card holder, annual family wage of ₹20,000, 15 years domicile in Maharashtra.  
> **Demonstration Goal**: Showcase end-to-end citizen screening, accessibility, transparent tiered eligibility, privacy-preserving consent, document checklists, simulated SMS reminders, and the NGO district dashboard.

---

## Quick Reference & Preparation

- **Backend URL**: `http://127.0.0.1:3000` (Fastify + Real PostgreSQL)
- **Frontend URL**: `http://localhost:5173` (Vite + React + Tailwind)
- **Admin Key**: `admin-secret-key`
- **Volunteer Key**: `volunteer-secret-key`
- **Citizen Key**: `citizen-secret-key` (default in app)

---

## 3-Minute Scripted Walkthrough

### ⏱️ 0:00 – 0:30 | Step 1 & 2: First Impression & Accessibility (मराठी + A++)

1. **Open the Web App**: Navigate to `http://localhost:5173`.
2. **Select Language (मराठी)**:
   - **Tap**: Top navigation language pill **`मराठी`**.
   - **Expected UI**: The entire user interface instantly translates to natural Marathi (नागपूर आणि विदर्भातील नागरिकांसाठी शासकीय कल्याणकारी योजना सहाय्यक).
   - **Audio Check**: Tap the blue **`ऐका` (Listen)** button next to the heading to hear audio synthesis or precomputed Marathi overview.
   - *Fallback*: If browser TTS is unavailable or silenced, visual text remains 100% accessible and high contrast.
3. **Accessibility Text Scaling (A++)**:
   - **Tap**: Top accessibility bar button **`A++`**.
   - **Expected UI**: The root text scale expands to 23px font size.
   - **Verification**: Notice that layout wraps cleanly with zero horizontal scrollbar (`scrollWidth <= clientWidth` even on 360px mobile viewports).

---

### ⏱️ 0:30 – 1:15 | Step 3: Enter Widow Persona (62, Nagpur)

1. **Start Screening**:
   - **Tap**: **`तुम्ही स्वतः माहिती भरा`** (Fill Details Yourself).
   - **Tap**: Mode toggle **`विभागवार`** (Section Mode).
2. **Section 1: वैयक्तिक माहिती (Personal Details)**:
   - वय (Age): Enter `62`
   - लिंग (Gender): Select **`स्त्री` (Female)**
   - वैवाहिक स्थिती (Marital Status): Select **`विधवा` (Widow)**
3. **Section 2: कुटुंब आणि घरगुती तपशील (Family Details)**:
   - विधवा आहात का? (Is Widow?): Tap **`होय` (Yes)**
4. **Section 3: पत्ता आणि भौगोलिक क्षेत्र (Address & Area)**:
   - जिल्हा (District): Select / Type **`Nagpur`**
   - महाराष्ट्रातील वास्तव्याची वर्षे (Years in MH): Enter `15`
5. **Section 4: उत्पन्न आणि रेशन कार्ड (Income & Ration Card)**:
   - वार्षिक कुटुंब उत्पन्न (Annual Family Income): Enter `20000`
   - दारिद्र्यरेषेखालील कुटुंब (BPL): Tap **`होय` (Yes)**
6. **Evaluate**:
   - **Tap**: Purple button **`योजना पहा` (See Schemes)**.
   - *Fallback*: If time is constrained, tap the one-click **`डिजिलॉकर डेमो भरा` (Simulate DigiLocker)** prefill button on the home screen to populate all fields in 1 second.

---

### ⏱️ 1:15 – 1:50 | Step 4: Transparent Tiered Results & Advisory

1. **Statutory Advisory Banner**:
   - Notice the amber advisory at top:  
     *“तुम्ही दिलेल्या माहितीच्या आधारे ही प्राथमिक तपासणी आहे. प्रत्यक्ष लाभासाठी संबंधित सरकारी कार्यालय सर्व कागदपत्रांची पडताळणी करेल.”*  
     *(Truthful government screening principle: never guarantees benefits; offices verify).*
2. **Tier 1: `तुम्ही अर्ज करू शकता` (You Can Apply)**:
   - **National Social Assistance Programme (NSAP)** – इंदिरा गांधी राष्ट्रीय विधवा पेन्शन योजना (Eligible: Age 62 >= 40, Widow, BPL).
   - **Sanjay Gandhi Niradhar Anudan Yojana** – संजय गांधी निराधार अनुदान योजना (Eligible: Age 62, MH domicile 15 yrs, Income ₹20k <= ₹21k).
3. **Tier 2: `संभाव्य, खात्री करा` (Likely, Confirm)**:
   - **PM-JAY / Mahatma Jyotirao Phule Jan Arogya Yojana** (Ayushman Bharat).
   - Displays clear `"खात्री करा"` badge pointing out that BPL card / SECC enumeration must be validated at the district empanelled hospital.
4. **Tier 3: `पात्र नाही` (Not Eligible - Collapsed by default)**:
   - Collapsed accordion keeps rejection noise out of user view.
   - Tapping reveals **Shravan Bal Seva** with transparent explanations (income/category criteria differences).
5. **Explore Bucket**:
   - Unverified imported schemes are kept in a separate, capped Explore list hidden behind a toggle.

---

### ⏱️ 1:50 – 2:20 | Step 5 & 6: Consent, Claim & Document Stepper

1. **Start Application & Document Checklist**:
   - **Tap**: **`Start application`** on NSAP.
   - **Expected UI**: Navigates to `/applications` and displays the interactive Stepper:
     - **टप्पा १**: कागदपत्र संकलन (Document Gathering)
     - **टप्पा २**: सेतू केंद्र / तहसील कार्यालय अर्ज सादर करणे (Tehsil Submission)
     - **टप्पा ३**: नायब तहसीलदार पडताळणी (Verification)
     - **टप्पा ४**: मंजुरी व पेन्शन वितरण (Approval & Disbursement)
2. **Claim Household & Privacy-First Token**:
   - Navigate to `/claim`.
   - Enter contact phone: `9876543210`.
   - Check the statutory consent checkbox (Consent to process data without PII retention).
   - **Tap**: **`टोकन तयार करा` (Claim Secret Token)**.
   - **Expected UI**: Displays household ID (`hh_...`) and access token (`sec_...`).
   - *Security Note*: Access secret is saved in local browser storage. The backend stores only a one-way SHA-256 hash. Even server administrators cannot decipher citizen identity.

---

### ⏱️ 2:20 – 2:40 | Step 7: Simulated SMS Reminder & Inbox

1. **Send Test Reminder**:
   - Navigate to **`⚙️ Settings`** or footer link.
   - **Tap**: **`Send test reminder`** (`[data-testid="send-test-sms-btn"]`).
   - **Expected UI**: Green confirmation banner confirms reminder was dispatched to the SIMULATED inbox.
2. **Inspect Simulated Inbox**:
   - **Tap**: **`Open Inbox`** (or go to `/inbox`).
   - **Prominent Banner**: **`SIMULATED, not sent`** badge in bold amber.
   - **Simulated SMS Card**:
     - Phone: `+91 9876543210`
     - Status: `SIMULATED DELIVERY` (or `SIMULATED FALLBACK` if carrier unconfigured).
     - Text: Localized neutral reminder (*"SchemeSaathi Reminder: Your document renewal is pending. Please visit the local authority office."*).
     - *Anti-Promissory Rule*: Strictly verified that no SMS ever claims "तुम्हाला मिळेल" or promises guaranteed financial disbursement.

---

### ⏱️ 2:40 – 3:00 | Step 8: NGO & Volunteer Dashboard (/ngo)

1. **Access NGO View**:
   - Navigate to `http://localhost:5173/ngo/login`.
   - Input Admin API Key: `admin-secret-key` and submit.
2. **Examine Synthetic Data Banner**:
   - Amber alert banner explicitly proclaims:  
     **`Synthetic demo data` – Demo Vidarbha Households & Outcomes Active**.
   - Proves no synthetic test data can ever be confused with real field beneficiary records.
3. **Vidarbha District Distribution (8 Districts Tracked)**:
   - **Nagpur**: 80 households
   - **Amravati**: 45 households
   - **Chandrapur**: 40 households
   - **Wardha**: 35 households
   - **Yavatmal**: 35 households
   - **Bhandara**: 25 households
   - **Gondia**: 25 households
   - **Gadchiroli**: 15 households (reflecting remote tribal outreach skew)
4. **Synthetic Only Toggle**:
   - Default metric label: **`Blended (Real + Synthetic)`**.
   - **Tap**: **`Synthetic only`** toggle switch.
   - **Expected UI**: Badge immediately updates to **`Synthetic Only`**, filtering analytics strictly to the 300 benchmarked households.
5. **Download CSV**:
   - **Tap**: **`Export Analytics CSV`** to trigger local download of aggregated Vidarbha metrics.

---

## Contingency & Fallback Matrix

| Step | Potential Failure Mode | Built-in Fallback Mechanism |
| :--- | :--- | :--- |
| **Voice / TTS** | Colab T4 / Piper voice service unreachable | Gracefully degrades to browser Web SpeechSynthesis API; if no Marathi voice is installed, clean UI text notice is displayed without crashing. |
| **Microphone STT** | Background noise or browser speech API denial | Quick-option buttons and number steppers provide 100% manual completion. |
| **Network Latency** | Offline or unstable rural mobile connectivity | PWA Service Worker caches questionnaires and scheme catalogue in IndexedDB. |
| **External SMS Gateways** | MSG91 / Twilio credentials unconfigured | Automatically falls back to `simulated_fallback` status and renders in `/inbox` with zero carrier cost. |
| **PII Guard** | Citizen accidentally enters 12-digit Aadhaar in text box | Local regex and backend ID Guard immediately reject submission with 422 `SENSITIVE_ID_NOT_ALLOWED`. |
| **Beep Audio Guard** | Cached audio is a 440 Hz test tone | Manifest flags mock/tone files as absent (404), triggering native browser speech synthesis fallback. |

---

## Explicit Operational Limitations
1. **Screening only**: The system screens self-declared data; the government office conducts statutory verification.
2. **No government status feed**: Application status tracking is citizen/volunteer maintained; no live departmental API link exists.
3. **SMS simulated**: All SMS reminders are routed through an in-app simulated inbox to ensure zero carrier costs and total privacy (no DLT registration).
4. **NGO data synthetic**: The 300 Vidarbha households are synthetic demo data, and under-served area scores represent an analytical proxy.
5. **Hindi/Marathi texts machine-drafted**: Standardized Devanagari texts are under continuous native linguistic review.
6. **Voice module precomputed tone guard**: Indic-Conformer architecture is established, but cached sine tones are treated as absent, falling back to client speech synthesis.
7. **Map hidden without coordinates**: The district map renders only when authentic coordinates exist; otherwise a taluka directory is shown.
8. **Local PostgreSQL only**: Tested and proven against local PostgreSQL on port 5432.
