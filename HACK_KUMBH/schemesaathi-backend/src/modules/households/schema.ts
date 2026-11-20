import { z } from "zod";

export const CreateHouseholdSchema = z.object({
  consent_given: z.boolean().default(true),
  district_id: z.string().optional(),
  taluka: z.string().optional(),
  state: z.string().default("Maharashtra"),
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

export const ClaimHouseholdSchema = z.object({
  household_id: z.string().optional(),
  answers: z.record(z.unknown()),
  consent: z
    .object({
      data_processing: z.boolean().default(true),
      sms_reminders: z.boolean().optional(),
      volunteer_assist: z.boolean().optional(),
    })
    .optional(),
  district_id: z.string().optional(),
  taluka: z.string().optional(),
  state: z.string().optional(),
  lang: z.enum(["en", "hi", "mr"]).default("en"),
});

export const PatchAnswersSchema = z.object({
  member_id: z.string().optional(),
  answers: z.record(z.unknown()).optional(),
  items: z
    .array(
      z.object({
        attribute_key: z.string(),
        value: z.unknown(),
        member_id: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .optional(),
  source: z
    .enum([
      "self_declared",
      "chatbot_confirmed",
      "digilocker",
      "aadhaar_qr",
      "volunteer_confirmed",
      "document_verified",
    ])
    .optional(),
});

export const ProposedAnswersSchema = z.object({
  member_id: z.string().optional(),
  answers: z.record(z.unknown()),
  source: z.enum(["chatbot_confirmed", "self_declared"]).optional(),
});

export const ConfirmProposedSchema = z.object({
  member_id: z.string().optional(),
  keys: z.array(z.string()),
  edits: z.record(z.unknown()).optional(),
});
