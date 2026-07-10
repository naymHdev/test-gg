import { z } from "zod";

export const createRewardValidation = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(10).optional(),
  cost: z.number().int().min(1),
  type: z.string().min(1).max(50),
});

export type CreateRewardInput = z.infer<typeof createRewardValidation>;
