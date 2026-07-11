import { z } from "zod";
import { BillingInterval } from "../../../../generated/prisma/client";

const planFeatureInput = z.object({
  title: z.string().min(1, "Feature title is required").max(100),
  description: z.string().max(300).optional(),
  order: z.number().int().min(0).default(0),
});

// price/currency/interval are immutable once a plan is live (Stripe prices
// can't be edited) — to change pricing, deactivate this plan and create a
// new one instead.
export const createPlanValidation = z.object({
  name: z.string().min(3, "Plan name is required").max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive("Price must be greater than 0"),
  currency: z.string().length(3).default("usd"),
  interval: z.nativeEnum(BillingInterval, {
    message: "interval is required",
  }),
  features: z
    .array(planFeatureInput)
    .min(1, "At least one feature is required"),
});

export const updatePlanValidation = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  features: z.array(planFeatureInput).min(1).optional(),
});

export const createCheckoutValidation = z.object({
  planId: z.string().min(1, "planId is required"),
});

export type CreatePlanInput = z.infer<typeof createPlanValidation>;
export type UpdatePlanInput = z.infer<typeof updatePlanValidation>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutValidation>;
