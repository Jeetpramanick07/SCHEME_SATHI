import { test, expect } from "@playwright/test";

const API_BASE_URL = process.env.VITE_API_BASE || process.env.API_BASE_URL || "http://localhost:3000/api/v1";
const ADMIN_KEY = process.env.API_KEY_ADMIN || "admin-secret-key";
const CITIZEN_KEY = process.env.API_KEY_CITIZEN || "citizen-secret-key";

test.describe("SchemeSaathi End-to-End Smoke Test", () => {
  test("Nagpur 62yo Widow Persona: UI-only driving from language to questionnaire taps to results", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // =========================================================================
    // STEP 1: Visit Home Screen
    // =========================================================================
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/SchemeSaathi/i);

    // =========================================================================
    // STEP 2: Select Marathi Language via UI tap
    // =========================================================================
    const marathiBtn = page.getByRole("button", { name: "मराठी" }).first();
    await expect(marathiBtn).toBeVisible();
    await marathiBtn.click();

    // =========================================================================
    // STEP 3: Set Text Scale to A++ via UI tap
    // =========================================================================
    const textScaleBtn = page.getByRole("button", { name: "A++" });
    await expect(textScaleBtn).toBeVisible();
    await textScaleBtn.click();

    // Verify document root font size scaled to 23px
    const rootFontSize = await page.evaluate(() => document.documentElement.style.fontSize);
    expect(rootFontSize).toBe("23px");

    // =========================================================================
    // STEP 4: Start Manual Questionnaire via UI tap (NO API seeding!)
    // =========================================================================
    const manualStartBtn = page
      .getByRole("button", { name: /स्वतः माहिती भरा|Manual|Fill Details/i })
      .or(page.getByText(/तुम्ही स्वतः माहिती भरा|Fill Details Yourself/i))
      .first();
    await expect(manualStartBtn).toBeVisible();
    await manualStartBtn.click();

    // Wait for questionnaire page
    await page.waitForURL("**/questionnaire");

    // =========================================================================
    // STEP 5: Switch to Section Mode and Fill Widow Persona Fields via UI taps
    // Persona: 62yo female widow in Nagpur, annual income 20000, BPL, 15 yrs in MH
    // =========================================================================
    const sectionModeBtn = page.locator('[data-testid="mode-section-btn"]').or(page.getByRole("button", { name: /विभागवार|Section/i }));
    await expect(sectionModeBtn).toBeVisible({ timeout: 10000 });
    await sectionModeBtn.click();

    // Section 1: वैयक्तिक माहिती (Personal Information)
    const ageInput = page.locator('[data-testid="input-age"]');
    await expect(ageInput).toBeVisible({ timeout: 10000 });
    await ageInput.fill("62");

    const genderSelect = page.locator('[data-testid="select-gender"]');
    await genderSelect.selectOption("FEMALE");

    const maritalSelect = page.locator('[data-testid="select-marital_status"]');
    await maritalSelect.selectOption("WIDOW");

    // Section 2: कुटुंब आणि घरगुती तपशील (Family Details)
    const familyTab = page.getByRole("button", { name: /कुटुंब|Family/i }).first();
    await familyTab.click();
    const isWidowBtn = page.locator('[data-testid="btn-yes-is_widow"]');
    await expect(isWidowBtn).toBeVisible({ timeout: 5000 });
    await isWidowBtn.click();

    // Section 3: पत्ता आणि भौगोलिक क्षेत्र (Address & Geographic Area)
    const addressTab = page.getByRole("button", { name: /पत्ता|Address/i }).first();
    await addressTab.click();
    const districtInput = page.locator('[data-testid="input-district"]');
    await expect(districtInput).toBeVisible({ timeout: 5000 });
    await districtInput.fill("Nagpur");

    const yearsInMhInput = page.locator('[data-testid="input-years_in_maharashtra_gte"]');
    await expect(yearsInMhInput).toBeVisible({ timeout: 5000 });
    await yearsInMhInput.fill("15");

    // Section 4: उत्पन्न आणि रेशन कार्ड (Income & Cards)
    const incomeTab = page.getByRole("button", { name: /उत्पन्न|Income/i }).first();
    await incomeTab.click();
    const incomeInput = page.locator('[data-testid="input-annual_family_income"]');
    await expect(incomeInput).toBeVisible({ timeout: 5000 });
    await incomeInput.fill("20000");

    const bplBtn = page.locator('[data-testid="btn-yes-belongs_to_bpl_household"]');
    await expect(bplBtn).toBeVisible({ timeout: 5000 });
    await bplBtn.click();

    // =========================================================================
    // STEP 6: Navigate to Results via UI tap ("योजना पहा" / see-schemes-btn)
    // =========================================================================
    const seeSchemesBtn = page.locator('[data-testid="see-schemes-btn"]');
    await expect(seeSchemesBtn).toBeVisible();
    await seeSchemesBtn.click();

    await page.waitForURL("**/results");
    await page.waitForSelector("h2", { timeout: 15000 });

    // Verify statutory disclaimer banner
    const disclaimer = page.getByText(/प्राथमिक तपासणी|महत्त्वाची सूचना|screening/i);
    await expect(disclaimer.first()).toBeVisible();

    // =========================================================================
    // STEP 7: Assert Tier 1: "You can apply" ("तुम्ही अर्ज करू शकता")
    // NSAP and Sanjay Gandhi Niradhar must be present under You Can Apply
    // =========================================================================
    const canApplySection = page.locator("section").filter({ hasText: /तुम्ही अर्ज करू शकता|You can apply/i });
    await expect(canApplySection).toBeVisible();

    const nsapScheme = canApplySection.getByText(/National Social Assistance Programme|राष्ट्रीय सामाजिक सहाय्य कार्यक्रम|NSAP/i);
    await expect(nsapScheme.first()).toBeVisible();

    const sanjayGandhiScheme = canApplySection.getByText(/Sanjay Gandhi Niradhar|संजय गांधी निराधार अनुदान योजना|Sanjay Gandhi/i);
    await expect(sanjayGandhiScheme.first()).toBeVisible();

    // Verify "Start application" button exists on can_apply cards
    const startAppNsap = page.locator('[data-testid="start-app-CENT-MORD-NSAP-006"]');
    await expect(startAppNsap).toBeVisible();

    // =========================================================================
    // STEP 8: Assert Tier 2: "Likely, confirm" ("संभाव्य, खात्री करा")
    // PM-JAY (CENT-MOHFW-PMJAY-002 or MH-PHD-MJPJAY-017) must be present
    // =========================================================================
    const likelySection = page.locator("section").filter({ hasText: /संभाव्य, खात्री करा|Likely, confirm/i });
    await expect(likelySection).toBeVisible();

    const pmjayScheme = likelySection.getByText(/आयुष्मान भारत|महात्मा ज्योतिराव फुले|PM-JAY|PMJAY|MJPJAY/i);
    await expect(pmjayScheme.first()).toBeVisible();

    // Check which specific PM-JAY scheme IDs appear
    const hasCentralPmjay = await page.locator('[data-scheme-id="CENT-MOHFW-PMJAY-002"]').isVisible().catch(() => false);
    const hasStatePmjay = await page.locator('[data-scheme-id="MH-PHD-MJPJAY-017"]').isVisible().catch(() => false);
    console.log(`[PM-JAY Scheme IDs in Smoke Test]: CENT-MOHFW-PMJAY-002=${hasCentralPmjay}, MH-PHD-MJPJAY-017=${hasStatePmjay}`);

    // Verify What-to-confirm action button is visible on likely schemes
    const confirmBtn = likelySection.getByText(/खात्री करा|Confirm/i);
    await expect(confirmBtn.first()).toBeVisible();

    // =========================================================================
    // STEP 9: Assert Tier 3: "Not eligible" ("पात्र नाही") (Collapsed by default)
    // Shravan Bal must NOT be visible until accordion is tapped
    // =========================================================================
    const notEligibleToggleBtn = page.locator('[data-testid="toggle-not-eligible-btn"]').or(page.getByRole("button", { name: /पात्र नाही|Not eligible/i }));
    await expect(notEligibleToggleBtn).toBeVisible();

    // Shravan Bal is collapsed and hidden initially
    const shravanBalScheme = page.getByText(/श्रावणबाळ|Shravanbal|Shravan Bal/i);
    await expect(shravanBalScheme).toBeHidden();

    // Tap to expand Not Eligible section
    await notEligibleToggleBtn.click();
    await expect(shravanBalScheme.first()).toBeVisible();

    // =========================================================================
    // STEP 10: Assert Tier 4: Explore (Hidden until tapped)
    // =========================================================================
    const exploreContainer = page.locator('[data-testid="explore-container"]');
    // Explore schemes content must be hidden initially
    await expect(exploreContainer).toBeHidden();

    const showExploreBtn = page.locator('[data-testid="toggle-explore-btn"]').or(page.getByRole("button", { name: /योजना पहा|Show explore|Explore/i })).first();
    await expect(showExploreBtn).toBeVisible();
    await showExploreBtn.click();
    await expect(exploreContainer).toBeVisible();

    // =========================================================================
    // STEP 11: Assert Mobile 360px + A++ Viewport (No Horizontal Scroll & No Clipping)
    // =========================================================================
    await page.setViewportSize({ width: 360, height: 740 });

    const scrollCheck = await page.evaluate(() => {
      const docEl = document.documentElement;
      return {
        scrollWidth: docEl.scrollWidth,
        clientWidth: docEl.clientWidth,
        hasHorizontalScroll: docEl.scrollWidth > docEl.clientWidth,
      };
    });

    console.log(`[Viewport Check 360px + A++]: scrollWidth=${scrollCheck.scrollWidth}, clientWidth=${scrollCheck.clientWidth}`);
    expect(scrollCheck.hasHorizontalScroll).toBe(false);

    // Assert text is not clipped by overflowing boundaries
    const isTextClipped = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
      for (const h of headings) {
        const style = window.getComputedStyle(h);
        if (style.overflow === "hidden" && h.scrollWidth > h.clientWidth + 2) {
          return true;
        }
      }
      return false;
    });
    expect(isTextClipped).toBe(false);

    // =========================================================================
    // STEP 12: Verify My Applications Route (/applications) and Stuck Nudge
    // =========================================================================
    await page.goto("/applications", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10000 });

    const appsTitle = page.getByText(/माझे अर्ज|My Applications/i);
    await expect(appsTitle.first()).toBeVisible();

    // Verify stuck nudge is rendered for application with documents pending >= 7 days
    const stuckNudge = page.locator('[data-testid="stuck-nudge"]');
    await expect(stuckNudge.first()).toBeVisible();

    // =========================================================================
    // STEP 13: Verify Diagnostics Page (/diagnostics)
    // =========================================================================
    await page.goto("/diagnostics", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10000 });

    const diagTitle = page.getByText(/डिव्हाइस आणि ऑडिओ तपासणी|Device Diagnostics/i);
    await expect(diagTitle.first()).toBeVisible();
    const speechRecText = page.getByText(/SpeechRecognition/i);
    await expect(speechRecText.first()).toBeVisible();
  });

  test("One-question-per-screen flow -> Save > Consent > Claim -> Reload and read with stored secret", async ({ page }) => {
    // 1. Visit questionnaire (One-question-per-screen mode is default)
    await page.goto("/questionnaire", { waitUntil: "domcontentloaded" });

    // 2. Drive one-question-per-screen flow
    // First question: Age
    const ageInput = page.locator('[data-testid="adaptive-number-input"]').or(page.locator('input[type="number"]')).first();
    await expect(ageInput).toBeVisible({ timeout: 10000 });
    await ageInput.fill("62");

    const nextBtn = page.locator('[data-testid="adaptive-next-btn"]').first();
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Second question: Option tap (e.g. Gender, Marital Status or boolean)
    const optionBtn = page.locator('[data-testid^="adaptive-opt-"]').or(page.locator('[data-testid="adaptive-btn-yes"]')).first();
    if (await optionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await optionBtn.click();
    }

    // 3. Save > Consent > Claim path
    await page.goto("/claim", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="claim-phone-input"]', { timeout: 10000 });

    // Fill 10-digit mobile number
    await page.locator('[data-testid="claim-phone-input"]').fill("9876543210");

    // Check declaration agreement
    await page.locator('[data-testid="declaration-agree-checkbox"]').check();

    // Click submit
    const submitBtn = page.locator('[data-testid="claim-submit-btn"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Assert claim success and token display
    const tokenDisplay = page.locator('[data-testid="claim-token-display"]');
    await expect(tokenDisplay).toBeVisible({ timeout: 10000 });
    const claimToken = await tokenDisplay.textContent();
    expect(claimToken).toBeTruthy();

    // 4. Verify stored access secret in localStorage
    const storedSecret = await page.evaluate(() => localStorage.getItem("schemesaathi_household_secret"));
    const storedHhId = await page.evaluate(() => localStorage.getItem("schemesaathi_household_id"));
    expect(storedSecret).toBeTruthy();
    expect(storedSecret?.startsWith("sec_")).toBe(true);
    expect(storedHhId).toBeTruthy();

    // 5. Reload page and assert household profile is read using stored secret
    await page.reload({ waitUntil: "domcontentloaded" });

    // Verify localStorage retains the secret and client can successfully read profile
    const profileData = await page.evaluate(async ({ hhId, apiBase, citizenKey }) => {
      const secret = localStorage.getItem("schemesaathi_household_secret");
      const res = await fetch(`${apiBase}/households/${hhId}/profile?lang=en`, {
        headers: {
          "x-api-key": citizenKey,
          "x-household-secret": secret || "",
        },
      });
      return { status: res.status, data: await res.json() };
    }, { hhId: storedHhId, apiBase: API_BASE_URL, citizenKey: CITIZEN_KEY });

    expect(profileData.status).toBe(200);
    expect(profileData.data.household_id).toBe(storedHhId);
  });

  // =========================================================================
  // TEST 3: NGO Portal: Admin Key -> /ngo shows banner and non-zero district numbers
  // =========================================================================
  test("NGO Portal: Admin key unlocks /ngo, displays Synthetic demo data banner, and non-zero district numbers", async ({
    page,
  }) => {
    // 1. Visit NGO login page
    await page.goto("/ngo/login", { waitUntil: "domcontentloaded" });

    // 2. Submit configured admin secret key
    const keyInput = page.locator('input[type="password"]').or(page.locator('input[type="text"]')).first();
    await expect(keyInput).toBeVisible({ timeout: 10000 });
    await keyInput.fill(ADMIN_KEY);

    const submitBtn = page.getByRole("button", { name: /प्रवेश करा|Login|Sign in/i }).first();
    await submitBtn.click();

    // 3. Assert redirected to /ngo dashboard
    await page.waitForURL("**/ngo", { timeout: 15000 });

    // 4. Assert synthetic demo data banner is visible
    const synthBanner = page.locator('[data-testid="synthetic-demo-banner"]');
    await expect(synthBanner).toBeVisible({ timeout: 10000 });
    await expect(synthBanner).toContainText(/Synthetic demo data/i);

    // 5. Assert district metrics cards exist with non-zero district numbers
    const nagpurCard = page.locator('[data-testid="district-card-DIST_MH_NGP"]');
    await expect(nagpurCard).toBeVisible();
    const nagpurCount = page.locator('[data-testid="district-count-DIST_MH_NGP"]');
    const nagpurVal = parseInt((await nagpurCount.textContent()) || "0", 10);
    expect(nagpurVal).toBeGreaterThan(0);

    const amravatiCard = page.locator('[data-testid="district-card-DIST_MH_AMR"]');
    await expect(amravatiCard).toBeVisible();
    const amravatiCount = page.locator('[data-testid="district-count-DIST_MH_AMR"]');
    const amravatiVal = parseInt((await amravatiCount.textContent()) || "0", 10);
    expect(amravatiVal).toBeGreaterThan(0);

    const gadchiroliCard = page.locator('[data-testid="district-card-DIST_MH_GAD"]');
    await expect(gadchiroliCard).toBeVisible();
    const gadchiroliCount = page.locator('[data-testid="district-count-DIST_MH_GAD"]');
    const gadchiroliVal = parseInt((await gadchiroliCount.textContent()) || "0", 10);
    expect(gadchiroliVal).toBeGreaterThan(0);

    // 6. Assert blended label by default, then toggle synthetic-only
    const blendedLabel = page.locator('[data-testid="blended-metric-label"]');
    await expect(blendedLabel).toBeVisible();

    const toggleBtn = page.locator('[data-testid="synthetic-only-toggle"]');
    await toggleBtn.click();

    const synthLabel = page.locator('[data-testid="synthetic-only-metric-label"]');
    await expect(synthLabel).toBeVisible();
    await expect(synthLabel).toContainText("Synthetic Only");
  });

  // =========================================================================
  // TEST 4: Simulated SMS: Send test reminder -> /inbox displays SIMULATED badge
  // =========================================================================
  test("Simulated SMS: Send test reminder -> /inbox displays the prominent SIMULATED badge and cards", async ({
    page,
  }) => {
    const claimRes = await page.request.post(`${API_BASE_URL}/households/claim`, {
      headers: { "x-api-key": CITIZEN_KEY },
      data: {
        answers: { phone_number: "9876543210" },
        consent: { data_processing: true, sms_reminders: true },
      },
    });
    const claimJson = await claimRes.json();

    await page.addInitScript((data: { household_id: string; access_secret: string }) => {
      localStorage.setItem("schemesaathi_hh_id", data.household_id);
      localStorage.setItem("schemesaathi_access_secret", data.access_secret);
    }, claimJson);

    // 1. Visit Settings page
    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    // 2. Click "Send test reminder" button
    const sendTestBtn = page.locator('[data-testid="send-test-sms-btn"]');
    await expect(sendTestBtn).toBeVisible({ timeout: 10000 });
    await sendTestBtn.click();

    // Wait for the success alert to appear in Settings
    const successAlert = page.getByText(/Test reminder dispatched successfully/i).first();
    await expect(successAlert).toBeVisible({ timeout: 10000 });

    // 3. Navigate to /inbox
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });

    // 4. Assert prominent SIMULATED, not sent badge is visible
    const simBadge = page.locator('[data-testid="simulated-not-sent-badge"]');
    await expect(simBadge).toBeVisible({ timeout: 10000 });
    await expect(simBadge).toContainText("SIMULATED, not sent");

    // 5. Assert SMS card is present with SIMULATED badge and never "sent"
    const smsCards = page.locator('[data-testid="simulated-sms-card"]');
    await expect(smsCards.first()).toBeVisible({ timeout: 10000 });

    const cardContent = await smsCards.first().textContent();
    expect(cardContent).toContain("SIMULATED");
    // Strictly verify truthful wording: never promissory "you will receive"
    expect(cardContent?.toLowerCase()).not.toContain("you will receive");
  });

  // =========================================================================
  // TEST 5: Citizen Account & Profile Dashboard: Login, DigiLocker & Schemes
  // =========================================================================
  test("Citizen Account & Profile Dashboard: Login with demo credentials, access profile, DigiLocker fetch, and view suitable schemes", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Visit Home Screen
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // 2. Click the Profile / Login button in header
    const profileIcon = page.locator('[data-testid="profile-icon"]');
    await expect(profileIcon).toBeVisible({ timeout: 10000 });
    await profileIcon.click();

    // 3. In the Login modal, click 1-Click Demo citizen
    const demoQuickBtn = page.locator('[data-testid="demo-login-btn"]');
    await expect(demoQuickBtn).toBeVisible({ timeout: 5000 });
    await demoQuickBtn.click();

    // Submit login
    const loginSubmitBtn = page.locator('[data-testid="login-submit-btn"]');
    await expect(loginSubmitBtn).toBeVisible({ timeout: 5000 });
    await loginSubmitBtn.click();

    // 4. Navigate to /profile dashboard
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    // 5. Assert all required profile sections are rendered
    await expect(page.getByText(/१\. ओळखपत्र व आधार कार्ड|Identity & Aadhaar/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/२\. वैयक्तिक माहिती|Personal Details/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/३\. पत्ता व भौगोलिक क्षेत्र|Address & Geography/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/४\. आर्थिक व शेती तपशील|Economic & Land Details/i)).toBeVisible({ timeout: 10000 });

    // 6. Test DigiLocker fetch button
    const digiFetchBtn = page.locator('[data-testid="profile-digilocker-fetch-btn"]');
    await expect(digiFetchBtn).toBeVisible({ timeout: 5000 });
    await digiFetchBtn.click();

    // Assert DigiLocker verified badge appears or success feedback
    await expect(page.getByText(/DigiLocker Verified|अधिकृत माहिती यशस्वीरित्या/i).first()).toBeVisible({ timeout: 10000 });

    // 7. Click "See Suitable Schemes" / "माझ्यासाठी योग्य योजना पहा"
    const seeSchemesBtn = page.locator('[data-testid="profile-see-schemes-btn"]').first();
    await expect(seeSchemesBtn).toBeVisible({ timeout: 5000 });
    await seeSchemesBtn.click();

    // 8. Assert navigation to results and suitable schemes are listed
    await page.waitForURL("**/results", { timeout: 10000 });
    await expect(page.getByText(/तुम्ही अर्ज करू शकता|You can apply/i).first()).toBeVisible({ timeout: 15000 });
  });
});
