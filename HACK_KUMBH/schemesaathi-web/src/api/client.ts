import {
  EvaluateResponse,
  MetaResponse,
  NextQuestionsResponse,
  ProfileSectionsResponse,
  HouseholdProfileResponse,
  PrefillResult,
  HelpCentre,
  FaqItem,
  DocumentPlanResponse,
  Application,
  Language,
  SimulatedSmsResponse,
  User,
  AuthResponse,
  DigiLockerData,
  UserProfileResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api/v1";
const CITIZEN_KEY = import.meta.env.VITE_API_KEY_CITIZEN || "citizen-secret-key";

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getAuthHeaders(customKey?: string): HeadersInit {
  const volunteerKey = sessionStorage.getItem("schemesaathi_volunteer_key");
  const adminKey = sessionStorage.getItem("schemesaathi_admin_key");
  const apiKey = customKey || adminKey || volunteerKey || CITIZEN_KEY;
  const householdSecret =
    localStorage.getItem("schemesaathi_access_secret") ||
    localStorage.getItem("schemesaathi_household_secret");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };

  if (householdSecret) {
    headers["x-household-secret"] = householdSecret;
  }

  const userJson = localStorage.getItem("schemesaathi_user");
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      if (u?.id) {
        headers["x-user-id"] = u.id;
      }
    } catch {}
  }

  if (volunteerKey) {
    headers["x-assisted-by"] = "volunteer:session";
  }

  return headers;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  customKey?: string
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getAuthHeaders(customKey),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errBody: { error?: { message?: string; code?: string; details?: unknown } } = {};
      try {
        errBody = await res.json();
      } catch {
        // Non-JSON response
      }

      const code = errBody.error?.code || (res.status === 422 ? "SENSITIVE_ID_NOT_ALLOWED" : `HTTP_${res.status}`);
      const message =
        errBody.error?.message ||
        (res.status === 422
          ? "Government IDs (Aadhaar, PAN, Bank details) are sensitive and not permitted in answers."
          : `Request failed with status ${res.status}`);

      throw new ApiError(message, code, res.status, errBody.error?.details);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "Network error, please check connection",
      "NETWORK_ERROR",
      0
    );
  }
}

export const api = {
  // Metadata & Health
  async getMeta(): Promise<MetaResponse> {
    return request<MetaResponse>("/meta");
  },

  // Stateless Evaluation
  async evaluate(payload: {
    household?: Record<string, unknown>;
    members: Array<Record<string, unknown>>;
    answers?: Record<string, unknown>;
    lang?: Language;
    include_all?: boolean;
    include_explore?: boolean;
  }): Promise<EvaluateResponse> {
    const res = await request<EvaluateResponse>("/eligibility/evaluate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // Offline caching of last result
    try {
      localStorage.setItem("schemesaathi_last_eval", JSON.stringify(res));
    } catch {
      // quota or private mode
    }
    return res;
  },

  // Adaptive Next Questions
  async getNextQuestions(payload: {
    subject?: Record<string, unknown>;
    household?: Record<string, unknown>;
    answers?: Record<string, unknown>;
    limit?: number;
    lang?: Language;
  }): Promise<NextQuestionsResponse> {
    const res = await request<NextQuestionsResponse>("/eligibility/next-questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    try {
      localStorage.setItem("schemesaathi_last_questions", JSON.stringify(res));
    } catch {}
    return res;
  },

  // Profile Sections (for section-by-section form)
  async getProfileSections(lang: Language = "en"): Promise<ProfileSectionsResponse> {
    return request<ProfileSectionsResponse>(`/profile/sections?lang=${lang}`);
  },

  // Household Profile with Completion Status
  async getHouseholdProfile(householdId: string, lang: Language = "en"): Promise<HouseholdProfileResponse> {
    return request<HouseholdProfileResponse>(`/households/${householdId}/profile?lang=${lang}`);
  },

  // Household Lifecycle
  async createHousehold(payload: {
    district_id?: string;
    taluka?: string;
    state?: string;
    consent_given?: boolean;
  }): Promise<{ household_id: string; consent_record_id: string }> {
    return request("/households", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async claimHousehold(payload: {
    household_id?: string;
    answers: Record<string, unknown>;
    consent?: {
      data_processing?: boolean;
      sms_reminders?: boolean;
      volunteer_assist?: boolean;
    };
    district_id?: string;
    taluka?: string;
    state?: string;
    lang?: Language;
  }): Promise<{
    household_id: string;
    member_id: string;
    auth_token: string;
    consent_id: string;
    declaration_id: number;
    phone: string;
    access_secret?: string;
  }> {
    const res = await request<{
      household_id: string;
      member_id: string;
      auth_token: string;
      consent_id: string;
      declaration_id: number;
      phone: string;
      access_secret?: string;
    }>("/households/claim", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.access_secret) {
      try {
        localStorage.setItem("schemesaathi_access_secret", res.access_secret);
        localStorage.setItem("schemesaathi_household_secret", res.access_secret);
      } catch {}
    }
    if (res.household_id) {
      try {
        localStorage.setItem("schemesaathi_household_id", res.household_id);
      } catch {}
    }
    return res;
  },

  async patchAnswers(
    householdId: string,
    payload: {
      member_id?: string;
      answers?: Record<string, unknown>;
      items?: Array<{
        attribute_key: string;
        value: unknown;
        member_id?: string;
        source?: string;
      }>;
      source?: string;
    }
  ): Promise<{
    success: boolean;
    updated_keys: string[];
    warnings: Array<{ code: string; attribute: string; message: string }>;
  }> {
    return request(`/households/${householdId}/answers`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async evaluateHousehold(
    householdId: string,
    options: { include_all?: boolean; include_explore?: boolean; lang?: Language } = {}
  ): Promise<EvaluateResponse> {
    const query = new URLSearchParams();
    if (options.include_all) query.set("include_all", "true");
    if (options.include_explore) query.set("include_explore", "true");
    if (options.lang) query.set("lang", options.lang);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    return request<EvaluateResponse>(`/households/${householdId}/eligibility${queryString}`, {
      method: "POST",
    });
  },

  async deleteHousehold(householdId: string): Promise<{ success: boolean; message: string }> {
    return request(`/households/${householdId}`, {
      method: "DELETE",
    });
  },

  async withdrawConsent(consentId: string): Promise<{ success: boolean; message: string }> {
    return request(`/consents/${consentId}/withdraw`, {
      method: "PATCH",
    });
  },

  // Document Checklist & Plan
  async getHouseholdDocumentChecklist(
    householdId: string,
    schemeId: string
  ): Promise<{
    scheme_id: string;
    scheme_name: string;
    checklist: Array<{
      document_id: string;
      document_name: string;
      mandatory: boolean;
      status: "have" | "missing" | "expired";
      alternatives: string[];
    }>;
  }> {
    return request(`/households/${householdId}/schemes/${schemeId}/checklist`);
  },

  async updateHouseholdDocument(
    householdId: string,
    docId: string,
    payload: {
      status: "have" | "missing" | "expired";
      member_id?: string;
      alt_used?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    return request(`/households/${householdId}/documents/${docId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async getDocumentPlan(householdId: string): Promise<DocumentPlanResponse> {
    return request<DocumentPlanResponse>(`/households/${householdId}/document-plan`);
  },

  // Applications Tracking
  async createApplication(payload: {
    household_id: string;
    scheme_id: string;
    status?: string;
    reference_number?: string;
  }): Promise<{ application_id: string; status: string }> {
    return request("/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getApplication(id: string): Promise<Application> {
    return request<Application>(`/applications/${id}`);
  },

  async updateApplication(
    id: string,
    payload: { status?: string; reference_number?: string }
  ): Promise<{ success: boolean; status: string }> {
    return request(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: payload.status || "draft", reference_number: payload.reference_number }),
    });
  },

  async updateApplicationStatus(
    id: string,
    payload: { status: string; reference_number?: string }
  ): Promise<{ success: boolean; status: string }> {
    return request(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async updateApplicationStep(
    stepId: string,
    payload: { is_completed?: boolean; completed?: boolean; reference_number?: string }
  ): Promise<{ success: boolean }> {
    return request(`/applications/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_completed: payload.is_completed ?? payload.completed ?? false,
        reference_number: payload.reference_number,
      }),
    });
  },

  // Help Centres & FAQs
  async getHelpCentres(params: { district?: string; taluka?: string } = {}): Promise<HelpCentre[]> {
    const query = new URLSearchParams();
    if (params.district) query.set("district", params.district);
    if (params.taluka) query.set("taluka", params.taluka);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<HelpCentre[]>(`/help-centres${qs}`);
  },

  async getFaqs(q?: string | { lang?: Language; q?: string }): Promise<FaqItem[]> {
    const queryString = typeof q === "string" ? q : q?.q || "";
    const qs = queryString ? `?q=${encodeURIComponent(queryString)}` : "";
    return request<FaqItem[]>(`/faqs${qs}`);
  },

  async getSchemeFaqs(schemeId: string): Promise<FaqItem[]> {
    return request<FaqItem[]>(`/schemes/${schemeId}/faqs`);
  },

  async getReminders(householdId: string): Promise<Array<{
    id: string;
    scheme_id?: string;
    reminder_type: string;
    remind_at: string;
    message: string;
    dismissed: boolean;
  }>> {
    return request(`/households/${householdId}/reminders`);
  },

  async getHouseholdReminders(householdId: string): Promise<Array<{
    id: string;
    scheme_id?: string;
    reminder_type: string;
    remind_at: string;
    message: string;
    dismissed: boolean;
  }>> {
    return this.getReminders(householdId);
  },

  async createReminder(
    householdId: string,
    payload: { reminder_type: string; remind_at: string; message: string }
  ): Promise<{ id: string; reminder_type: string; remind_at: string; message: string; dismissed: boolean }> {
    return request(`/households/${householdId}/reminders`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async dismissReminder(reminderId: string): Promise<{ success: boolean }> {
    return request(`/households/reminders/${reminderId}/dismiss`, {
      method: "PATCH",
    });
  },

  async evaluateStateless(payload: {
    answers: Record<string, unknown>;
    district_id?: string;
    include_explore?: boolean;
    lang?: Language;
  }): Promise<EvaluateResponse> {
    const ageVal = typeof payload.answers.age === "number" ? payload.answers.age : 30;
    const genderVal = typeof payload.answers.gender === "string" ? payload.answers.gender : "FEMALE";
    const maritalVal =
      typeof payload.answers.marital_status === "string"
        ? (payload.answers.marital_status as string)
        : payload.answers.is_widow === true || payload.answers.widow === true
        ? "WIDOW"
        : undefined;

    return this.evaluate({
      household: {
        district_id: payload.district_id || "DIST_MH_NGP",
        state: "Maharashtra",
        answers: payload.answers,
      },
      members: [
        {
          member_id: "mem_01",
          age: ageVal,
          gender: genderVal,
          marital_status: maritalVal,
          answers: payload.answers,
        },
      ],
      answers: payload.answers,
      include_explore: payload.include_explore,
      lang: payload.lang,
    });
  },

  // Simulated Prefill (DigiLocker / Aadhaar QR)
  async simulateDigiLocker(payload: { age?: number; gender?: string; district?: string } = {}): Promise<PrefillResult> {
    return request<PrefillResult>("/prefill/digilocker/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async simulateAadhaarQr(payload: { age?: number; gender?: string; district?: string } = {}): Promise<PrefillResult> {
    return request<PrefillResult>("/prefill/aadhaar-qr/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Chatbot Proposed Answers (Stub behind VITE_ENABLE_CHATBOT)
  async postProposedAnswers(
    householdId: string,
    answers: Record<string, unknown>
  ): Promise<{ success: boolean; proposed_keys: string[] }> {
    return request(`/households/${householdId}/answers/proposed`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },

  async confirmProposedAnswers(
    householdId: string,
    keys: string[],
    edits?: Record<string, unknown>
  ): Promise<{ success: boolean; confirmed_keys: string[] }> {
    return request(`/households/${householdId}/answers/confirm`, {
      method: "POST",
      body: JSON.stringify({ keys, edits }),
    });
  },

  // NGO / Admin Endpoints (Require Admin Key)
  async getDistrictMetrics(syntheticOnly?: boolean, adminKey?: string): Promise<{
    mode: string;
    label: string;
    is_blended: boolean;
    districts: Array<{ district_id: string; count: number; synthetic_count: number; total_count: number }>;
  }> {
    const qs = syntheticOnly ? "?synthetic_only=true" : "";
    return request(`/admin/district-metrics${qs}`, {}, adminKey);
  },

  async getDistrictCoverage(adminKey?: string): Promise<Array<{ district: string; active_schemes_count: number }>> {
    return request("/admin/district-coverage", {}, adminKey);
  },

  async getUnderServedAreas(adminKey?: string): Promise<Array<{ district: string; friction_score: number; proxy_label: string }>> {
    return request("/admin/under-served-areas", {}, adminKey);
  },

  async getSchemesUptake(adminKey?: string): Promise<Array<{ scheme_id: string; scheme_name: string; draft: number; submitted: number; approved: number; rejected: number }>> {
    return request("/admin/schemes-uptake", {}, adminKey);
  },

  async getRejectionReasons(adminKey?: string): Promise<Array<{ code: string; text: string; count: number; possible_rule_problem: boolean }>> {
    return request("/admin/rejection-reasons", {}, adminKey);
  },

  async getPendingReviews(adminKey?: string): Promise<{ pending_attributes_count: number; pending_schemes_count: number }> {
    return request("/admin/pending-reviews", {}, adminKey);
  },

  // SMS & Reminders API
  async sendTestSms(payload: {
    household_id?: string;
    to?: string;
    lang?: Language;
    message?: string;
  }): Promise<{ success: boolean; result: unknown }> {
    return request("/sms/send-test", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getSimulatedSms(): Promise<SimulatedSmsResponse> {
    return request<SimulatedSmsResponse>("/sms/simulated");
  },

  async clearSimulatedSms(): Promise<{ success: boolean; cleared_count: number }> {
    return request("/sms/simulated", {
      method: "DELETE",
    });
  },

  // User Accounts & Authentication
  async register(payload: {
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
    email?: string;
  }): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.token) {
      localStorage.setItem("schemesaathi_auth_token", res.token);
      localStorage.setItem("schemesaathi_user", JSON.stringify(res.user));
    }
    if (res.household?.household_id) {
      localStorage.setItem("schemesaathi_hh_id", res.household.household_id);
      localStorage.setItem("schemesaathi_household_id", res.household.household_id);
    }
    if (res.household?.access_secret) {
      localStorage.setItem("schemesaathi_access_secret", res.household.access_secret);
      localStorage.setItem("schemesaathi_household_secret", res.household.access_secret);
    }
    if (res.household?.member_id) {
      localStorage.setItem("schemesaathi_mem_id", res.household.member_id);
    }
    return res;
  },

  async login(payload: { username: string; password: string }): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.token) {
      localStorage.setItem("schemesaathi_auth_token", res.token);
      localStorage.setItem("schemesaathi_user", JSON.stringify(res.user));
    }
    if (res.household?.household_id) {
      localStorage.setItem("schemesaathi_hh_id", res.household.household_id);
      localStorage.setItem("schemesaathi_household_id", res.household.household_id);
    }
    if (res.household?.access_secret) {
      localStorage.setItem("schemesaathi_access_secret", res.household.access_secret);
      localStorage.setItem("schemesaathi_household_secret", res.household.access_secret);
    }
    if (res.household?.member_id) {
      localStorage.setItem("schemesaathi_mem_id", res.household.member_id);
    }
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>("/auth/me");
  },

  async fetchDigiLockerProfile(payload?: {
    user_id?: string;
    household_id?: string;
    member_id?: string;
  }): Promise<{ success: boolean; digilocker_verified: boolean; data: DigiLockerData }> {
    return request<{ success: boolean; digilocker_verified: boolean; data: DigiLockerData }>(
      "/auth/digilocker-fetch",
      {
        method: "POST",
        body: JSON.stringify(payload || {}),
      }
    );
  },

  async getUserProfile(options?: {
    user_id?: string;
    household_id?: string;
  }): Promise<UserProfileResponse> {
    const params = new URLSearchParams();
    if (options?.user_id) params.set("user_id", options.user_id);
    if (options?.household_id) params.set("household_id", options.household_id);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<UserProfileResponse>(`/user-profile${qs}`);
  },

  async updateUserProfile(payload: {
    user_id?: string;
    household_id?: string;
    member_id?: string;
    full_name?: string;
    phone?: string;
    masked_aadhaar?: string;
    answers: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    completion_percentage: number;
    missing_fields: string[];
    is_complete: boolean;
  }> {
    return request<{
      success: boolean;
      completion_percentage: number;
      missing_fields: string[];
      is_complete: boolean;
    }>("/user-profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};

export const apiClient = api;
export default api;

