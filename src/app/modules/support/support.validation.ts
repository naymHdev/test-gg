import { z } from "zod";

const supportMessageContentValidation = z.object({
  content: z.string().trim().max(2000).optional(),
});

export const openConversationValidation = supportMessageContentValidation;

export const sendMessageValidation = supportMessageContentValidation;

export type OpenConversationInput = z.infer<typeof openConversationValidation>;
export type SendMessageInput = z.infer<typeof sendMessageValidation>;
