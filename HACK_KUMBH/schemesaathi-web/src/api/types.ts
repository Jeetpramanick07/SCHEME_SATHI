export type Language = "en" | "hi" | "mr";

export type EvaluationTier = "can_apply" | "likely_confirm" | "not_eligible" | "explore";
export type EvaluationStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN" | "EXPLORE";

export interface LocalizedText {
  en: string;
  hi?: string;
  mr?: string;
}

export interface SchemeOverview {
  objective?: string;
  simple_explanation?: LocalizedText;
  beneficiary_categories?: string[];
  target_population?: string;
}

export interface SchemeBenefits {
  benefit_type?: string;
  amount?: number;
  currency?: string;
  frequency?: string;
  coverage_details?: string;
}

export interface SchemePreTripCheck {
  bring_documents: Array<{
    document_id: string;
    name: string;
    mandatory: boolean;
    alternatives: string[];
  }>;
  confirm_with_office: string[];
}

export interface MemberSchemeResult {
  scheme_id: string;
  official_name: string;
  status: EvaluationStatus;
  tier: EvaluationTier;
  can_apply: boolean;
  seasonal: boolean;
  score: number;
  variant?: string;
  matched_pathway?: string;
  mandatory_rules_evaluated_count?: number;
  is_curated?: boolean;
  is_verified?: boolean;
  source?: string;
  relevance_score?: number;
  what_to_confirm?: Array<{ attribute_key: string; label: string; why_it_matters: string }>;
  confidence_badge?: "high" | "medium" | "needs_confirmation";
  last_verified?: string | null;
  disclaimer_keys?: string[];
  pre_trip_check?: SchemePreTripCheck;
  reasons: { en: string[]; hi?: string[]; mr?: string[] };
  review_status?: "machine_drafted" | "reviewed";
  unknown_attributes: string[];
}

export interface EvaluationResultsMember {
  member_id: string;
  eligible: MemberSchemeResult[];
  likely: MemberSchemeResult[];
  unknown: MemberSchemeResult[];
  explore: MemberSchemeResult[];
  not_eligible: MemberSchemeResult[];
  tiers: {
    can_apply: MemberSchemeResult[];
    likely_confirm: MemberSchemeResult[];
    not_eligible: MemberSchemeResult[];
    explore: MemberSchemeResult[];
  };
  not_eligible_by_reason: Record<string, string[]>;
  all_schemes_count: number;
}

export interface EvaluateResponse {
  evaluated_at: string;
  language: Language;
  results: EvaluationResultsMember[];
}

export interface NextQuestionItem {
  attribute_key: string;
  question_text: LocalizedText;
  help_text?: LocalizedText;
  value_type: "boolean" | "number" | "enum" | "string" | "list" | "date";
  enum_values?: string[];
  unit?: string;
  scope: string;
  resolved_scheme_count: number;
  rank_score: number;
}

export interface NextQuestionsResponse {
  total_remaining_schemes: number;
  language: Language;
  questions: NextQuestionItem[];
}

export interface ProfileSectionField {
  attribute_key: string;
  order: number;
  optional: boolean;
  scope: string;
  value_type: string;
  enum_values?: string[];
  unit?: string;
  question_text: LocalizedText;
  help_text?: LocalizedText;
  used_by_scheme_count: number;
}

export interface ProfileSection {
  id: string;
  order: number;
  scope: "household" | "member";
  title: LocalizedText;
  description: LocalizedText;
  skippable: boolean;
  fields: ProfileSectionField[];
}

export interface ProfileSectionsResponse {
  sections: ProfileSection[];
  total_sections: number;
  total_fields: number;
}

export interface HouseholdProfileSectionStatus {
  section_id: string;
  title: LocalizedText;
  scope: string;
  skippable: boolean;
  total_fields: number;
  answered_fields_count: number;
  completion_pct: number;
  unanswered_fields: ProfileSectionField[];
  answered_fields: Array<{
    attribute_key: string;
    value: unknown;
    source: string;
    status: string;
    updated_at: string;
    label: string;
  }>;
}

export interface HouseholdProfileResponse {
  household_id: string;
  overall_completion_pct: number;
  sections: HouseholdProfileSectionStatus[];
}

export interface MetaResponse {
  dataset_version: string;
  synthetic_flags: {
    has_synthetic_schemes: boolean;
    synthetic_schemes_count: number;
    has_synthetic_data?: boolean;
    synthetic_households_count?: number;
    synthetic_applications_count?: number;
  };
  counts: {
    total_schemes: number;
    curated_schemes: number;
    imported_schemes: number;
    verified_schemes: number;
    active_schemes: number;
  };
  db: string;
  cors_origins: boolean | string[];
  timestamp: string;
}

export interface SimulatedSmsItem {
  id: string;
  household_id?: string | null;
  phone: string;
  message: string;
  status: string;
  provider: string;
  created_at: string;
}

export interface SimulatedSmsResponse {
  provider: string;
  count: number;
  messages: SimulatedSmsItem[];
}

export interface PrefillResult {
  attributes: {
    age?: number;
    gender?: "MALE" | "FEMALE" | "TRANSGENDER";
    district?: string;
  };
  source: "digilocker" | "aadhaar_qr";
  simulated: boolean;
}

export interface HelpCentre {
  help_centre_id: string;
  centre_name: string;
  centre_type: string;
  state: string;
  district: string;
  taluka?: string | null;
  complete_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  working_hours?: string | null;
  available_services?: string[];
}

export interface FaqItem {
  id: number;
  scheme_id: string;
  scheme_name?: string | null;
  faq_number?: number | null;
  question: string;
  answer: string;
}

export interface DocumentPlanStep {
  step: number;
  document_id: string;
  name: string;
  prerequisites: string[];
  unlocks_schemes_count: number;
  unlocked_schemes: string[];
}

export interface DocumentPlanResponse {
  household_id: string;
  total_documents_needed: number;
  chain_plan: DocumentPlanStep[];
}

export interface ApplicationStep {
  step_number: number;
  title: string;
  description: string;
  required_documents?: string[];
  official_link?: string;
  is_completed?: boolean;
}

export interface Application {
  application_id: string;
  household_id: string;
  scheme_id: string;
  scheme_name: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  applied_at?: string;
  reference_number?: string;
  steps: ApplicationStep[];
  outcome?: string;
  rejection_reason_code?: string;
  rejection_note?: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  household_id: string;
  member_id: string;
  role: string;
  profile_completed: boolean;
  digilocker_linked: boolean;
  masked_aadhaar?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  household: {
    household_id: string;
    member_id?: string;
    access_secret: string;
  };
}

export interface DigiLockerData {
  digilocker_verified: boolean;
  full_name: string;
  age: number;
  gender: string;
  marital_status: string;
  is_widow?: boolean;
  caste_category: string;
  district: string;
  district_id: string;
  taluka: string;
  state: string;
  masked_aadhaar: string;
  ration_card_type?: string;
  belongs_to_bpl_household?: boolean;
  annual_family_income?: number;
  occupation?: string;
  years_in_maharashtra_gte?: number;
  has_aadhaar?: boolean;
  has_bank_account?: boolean;
  has_aadhaar_linked_bank?: boolean;
  has_income_certificate?: boolean;
  has_caste_certificate?: boolean;
  has_domicile_certificate?: boolean;
}

export interface UserProfileResponse {
  user: User | null;
  answers: Record<string, unknown>;
  completion_percentage: number;
  missing_fields: string[];
  is_complete: boolean;
}
