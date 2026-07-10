import { z } from "zod";

export const openConversationValidation = z.object({
  content: z.string().min(1, "Message content is required").max(2000),
});

export const sendMessageValidation = z.object({
  content: z.string().min(1, "Message content is required").max(2000),
});

export type OpenConversationInput = z.infer<typeof openConversationValidation>;
export type SendMessageInput = z.infer<typeof sendMessageValidation>;
