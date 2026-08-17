import { z } from "zod";

export const createPlayerReviewValidation = z.object({
  rating: z
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot be more than 5"),

  review: z
    .string()
    .trim()
    .max(500, "Review cannot exceed 500 characters")
    .optional(),
});

export type CreatePlayerReviewInput = z.infer<
  typeof createPlayerReviewValidation
>;
