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
  rules: z.string().trim().max(5000).default(""),
  startDate: z.coerce.date(),
});

const teamMemberInput = z.object({
  position: z.enum(["Top", "Jungle", "Mid", "ADC", "Support"], {
    message: "position must be Top, Jungle, Mid, ADC, or Support",
  }),
  riotId: z
    .string({ message: "Riot ID is required" })
    .regex(/^.+#.+$/, "Riot ID must be in the form Name#Tag"),
});

export const createTeamValidation = z
  .object({
    name: z.string().min(2).max(100),
    members: z
      .array(teamMemberInput)
      .length(
        5,
        "Exactly 5 players are required (Top, Jungle, Mid, ADC, Support)",
      ),
  })
  .superRefine((data, ctx) => {
    const positions = data.members.map((m) => m.position);
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each position must be filled exactly once — no duplicates",
        path: ["members"],
      });
    }

    const riotIds = data.members.map((m) => m.riotId.toLowerCase());
    if (new Set(riotIds).size !== riotIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The same Riot ID was entered more than once",
        path: ["members"],
      });
    }
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
