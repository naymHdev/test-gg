import { z } from "zod";

export const sendFriendRequestValidation = z.object({
  targetId: z.string().min(1, "targetId is required"),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestValidation>;
