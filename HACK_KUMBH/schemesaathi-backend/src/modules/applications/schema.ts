import { z } from "zod";

export const CreateApplicationSchema = z.object({
  household_id: z.string(),
  member_id: z.string(),
  scheme_id: z.string(),
  reference_no: z.string().optional(),
});

export const PatchApplicationStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"]),
  note: z.string().optional(),
  current_step_number: z.number().optional(),
});

export const UpdateStepStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
});

export const RecordOutcomeSchema = z.object({
  outcome: z.enum(["approved", "rejected", "pending", "withdrawn"]),
  rejection_reason_code: z.string().optional(),
  rejection_note: z.string().optional(),
  outcome_recorded_by_role: z.string().optional(),
});
