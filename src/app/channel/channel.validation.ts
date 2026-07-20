import { z } from "zod";
import { ChannelVisibility } from "../../../generated/prisma/client";

const createChannelValidation = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  visibility: z.nativeEnum(ChannelVisibility).default(ChannelVisibility.Public),
  maxParticipants: z.number().int().min(2).max(50).default(25),
  waitingRoomEnabled: z.boolean().default(false),
});

const updateChannelValidation = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional(),
  visibility: z.nativeEnum(ChannelVisibility).optional(),
  maxParticipants: z.number().int().min(2).max(50).optional(),
  isLocked: z.boolean().optional(),
  waitingRoomEnabled: z.boolean().optional(),
});

const waitingRoomDecisionValidation = z.object({
  accept: z.boolean(),
});

export const channelValidation = {
  createChannelValidation,
  updateChannelValidation,
  waitingRoomDecisionValidation,
};
