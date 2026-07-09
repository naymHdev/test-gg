import { z } from "zod";
import { Region, TournamentFormat } from "../../../../generated/prisma/client";

export const createTournamentValidation = z.object({
  name: z.string().min(3).max(200),
  region: z.nativeEnum(Region, { message: "Region is required" }),
  gameMode: z.string().min(1).max(50),
  format: z.nativeEnum(TournamentFormat, { message: "Format is required" }),
  maxTeams: z.number().int().min(2).max(256),
  entryFee: z.number().min(0).default(0),
  prizePool: z.number().min(0).default(0),
  startDate: z.coerce.date(),
});

export const createTeamValidation = z.object({
  name: z.string().min(2).max(100),
});

export const createMatchValidation = z
  .object({
    teamAId: z.string().min(1, "teamAId is required"),
    teamBId: z.string().min(1, "teamBId is required"),
    round: z.number().int().min(1),
    matchIndex: z.number().int().min(0),
    scheduledAt: z.coerce.date(),
  })
  .refine((data) => data.teamAId !== data.teamBId, {
    message: "A team cannot play against itself",
    path: ["teamBId"],
  });

export const declareMatchWinnerValidation = z.object({
  winnerId: z.string().min(1, "winnerId is required"),
});

export type CreateTournamentInput = z.infer<typeof createTournamentValidation>;
export type CreateTeamInput = z.infer<typeof createTeamValidation>;
export type CreateMatchInput = z.infer<typeof createMatchValidation>;
export type DeclareMatchWinnerInput = z.infer<
  typeof declareMatchWinnerValidation
>;
