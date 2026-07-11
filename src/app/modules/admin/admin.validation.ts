import { z } from "zod";

export const banUserValidation = z.object({
  reason: z.string().min(3, "Reason is required").max(200),
  details: z.string().max(2000).optional(),
});

export const warnUserValidation = z.object({
  reason: z.string().min(3, "Reason is required").max(200),
});

export const timeoutUserValidation = z.object({
  durationMinutes: z.number().int().min(1).max(43200), // max 30 days
  reason: z.string().min(3).max(200).optional(),
});

export type BanUserInput = z.infer<typeof banUserValidation>;
export type WarnUserInput = z.infer<typeof warnUserValidation>;
export type TimeoutUserInput = z.infer<typeof timeoutUserValidation>;
