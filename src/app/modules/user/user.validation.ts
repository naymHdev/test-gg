import { z } from "zod";

const notificationSettingsValidation = z
  .object({
    emailNotifications: z.boolean().optional(),
    newMessageNotifications: z.boolean().optional(),
    systemUpdateNotifications: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one notification setting is required",
  });

const deleteAccountValidation = z.object({
  password: z.string({ message: "Password is required to confirm deletion" }),
});

export const userValidation = {
  notificationSettingsValidation,
  deleteAccountValidation,
};
