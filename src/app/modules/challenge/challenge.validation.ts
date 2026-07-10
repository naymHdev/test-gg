import { z } from "zod";
import { ChallengeDifficulty } from "../../../../generated/prisma/client";

export const createChallengeValidation = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  difficulty: z.nativeEnum(ChallengeDifficulty, {
    message: "Difficulty is required",
  }),
  type: z.enum(["wins", "games_played", "custom"]),
  total: z.number().int().min(1),
  rewardPts: z.number().int().min(0),
  xp: z.number().int().min(0),
  isPremium: z.boolean().default(false),
});

export const updateChallengeProgressValidation = z.object({
  incrementBy: z.number().int().min(1).default(1),
});

export type CreateChallengeInput = z.infer<typeof createChallengeValidation>;
export type UpdateChallengeProgressInput = z.infer<
  typeof updateChallengeProgressValidation
>;
