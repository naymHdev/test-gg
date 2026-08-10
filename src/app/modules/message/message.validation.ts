import { z } from "zod";

export const sendMessageValidation = z.object({
  receiverId: z.string().min(1, "receiverId is required"),
  content: z.string().min(1, "Message cannot be empty").max(2000),
  imageUrl: z.string().optional(),
});

export const markMessagesReadValidation = z.object({
  senderId: z.string().min(1, "senderId is required"),
});

export type SendMessageInput = z.infer<typeof sendMessageValidation>;
