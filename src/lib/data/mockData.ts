import { ChallengeDifficulty } from "../../../generated/prisma/client";

export const challengeSeeds = [
  {
    title: "Tournament Conqueror",
    description: "Win a full tournament from group stage to grand final.",
    difficulty: ChallengeDifficulty.Legendary,
    type: "custom",
    total: 1,
    rewardPts: 1000,
    xp: 2500,
    isPremium: true,
  },
];
