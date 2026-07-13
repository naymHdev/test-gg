import { z } from "zod";
import { Role } from "../../../../generated/prisma/client";

export const registerDeviceTokenValidation = z.object({
  token: z.string().min(10, "token is required"),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export const unregisterDeviceTokenValidation = z.object({
  token: z.string().min(10, "token is required"),
});

export const broadcastNotificationValidation = z.object({
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(1000),
  data: z.record(z.string(), z.unknown()).optional(),
  // Who receives it — defaults to everyone. `roles` narrows to specific
  // roles (e.g. announce to Moderators only), `premiumOnly` narrows further.
  roles: z.array(z.nativeEnum(Role)).optional(),
  premiumOnly: z.boolean().optional(),
});

export type RegisterDeviceTokenInput = z.infer<
  typeof registerDeviceTokenValidation
>;
export type BroadcastNotificationInput = z.infer<
  typeof broadcastNotificationValidation
>;
