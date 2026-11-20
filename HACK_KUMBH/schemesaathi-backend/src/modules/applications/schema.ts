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
