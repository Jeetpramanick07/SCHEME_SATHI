import { z } from "zod";

export const CreateHouseholdSchema = z.object({
  consent_given: z.boolean().default(true),
  district_id: z.string().optional(),
  taluka: z.string().optional(),
  state: z.string().default("Maharashtra"),
  preferred_lang: z.enum(["en", "hi", "mr"]).default("mr"),
  text_tier: z.enum(["STANDARD", "LARGE", "EXTRA_LARGE"]).default("LARGE"),
});

export const PatchHouseholdSchema = CreateHouseholdSchema.partial();

export const CreateMemberSchema = z.object({
  relation_to_head: z.string().default("SELF"),
  age: z.number().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  caste_category: z.string().optional(),
  marital_status: z.string().optional(),
  answers: z.record(z.unknown()).default({}),
});

export const PatchMemberSchema = CreateMemberSchema.partial();

export const UpdateHouseholdDocumentSchema = z.object({
  member_id: z.string().optional(),
  status: z.enum(["have", "missing", "expired"]).default("have"),
  expires_on: z.string().optional(),
  alt_used: z.string().optional(),
  notes: z.string().optional(),
});
