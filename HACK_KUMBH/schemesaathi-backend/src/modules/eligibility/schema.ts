import { z } from "zod";

export const MemberInputSchema = z.object({
  member_id: z.string().optional(),
  relation_to_head: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  caste_category: z.string().optional(),
  social_category: z.string().optional(),
  marital_status: z.string().optional(),
  answers: z.record(z.unknown()).default({}),
});

export const HouseholdContextSchema = z.object({
  household_id: z.string().optional(),
  state: z.string().optional(),
  district_id: z.string().optional(),
  taluka: z.string().optional(),
  area_type: z.enum(["URBAN", "RURAL", "URBAN_SLUM"]).optional(),
  annual_family_income: z.number().optional(),
  monthly_income: z.number().optional(),
  bpl_card_holder: z.boolean().optional(),
  answers: z.record(z.unknown()).optional(),
});

export const EvaluateRequestSchema = z.object({
  household: HouseholdContextSchema.optional(),
  members: z.array(MemberInputSchema).min(1),
  answers: z.record(z.unknown()).optional(), // Global answers shared across household
  approved_parent_benefits: z.array(z.string()).optional(),
  lang: z.enum(["en", "hi", "mr"]).optional().default("en"),
  include_all: z.boolean().optional().default(false),
  include_test: z.boolean().optional(),
});

export const NextQuestionsRequestSchema = z.object({
  subject: MemberInputSchema.optional(),
  household: HouseholdContextSchema.optional(),
  answers: z.record(z.unknown()).optional(),
  limit: z.coerce.number().min(1).max(20).default(5),
  lang: z.enum(["en", "hi", "mr"]).default("en"),
});
