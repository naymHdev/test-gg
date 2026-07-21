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

const transferOwnershipValidation = z.object({
  newOwnerId: z.string().min(1),
});

const sendChannelMessageValidation = z
  .object({
    content: z.string().min(1).max(2000).optional(),
    imageUrl: z.string().url().optional(),
    fileUrl: z.string().url().optional(),
    mentionIds: z.array(z.string()).max(20).optional(),
    replyToId: z.string().optional(),
  })
  .refine((data) => data.content || data.imageUrl || data.fileUrl, {
    message: "Message must have content, an image, or a file",
  });

const editChannelMessageValidation = z.object({
  content: z.string().min(1).max(2000),
});

export const channelValidation = {
  createChannelValidation,
  updateChannelValidation,
  waitingRoomDecisionValidation,
  transferOwnershipValidation,
  sendChannelMessageValidation,
  editChannelMessageValidation,
};
