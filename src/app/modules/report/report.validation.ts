import { z } from "zod";
import { ReportTargetType } from "../../../../generated/prisma/client";

export const createReportValidation = z.object({
  targetType: z.nativeEnum(ReportTargetType, {
    message: "targetType is required",
  }),
  targetId: z.string().min(1, "targetId is required"),
  reason: z.string().min(3, "Reason is required").max(100),
  details: z
    .string()
    .min(10, "Please provide at least 10 characters of detail")
    .max(2000),
});

export type CreateReportInput = z.infer<typeof createReportValidation>;
