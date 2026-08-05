import { z } from "zod";

const updateProfileValidation = z
  .object({
    username: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscore allowed")
      .optional(),

    uiLanguage: z
      .enum([
        "en",
        "ro",
        "pl",
        "tr",
        "fr",
        "de",
        "es",
        "it",
        "pt",
        "ru",
        "el",
        "hu",
        "cs",
        "sk",
        "nl",
        "sv",
        "da",
        "no",
        "fi",
        "bg",
        "uk",
        "sr",
        "hr",
        "sl",
      ])
      .optional(),

    bio: z.string().max(500).optional(),
    background: z.string().optional(),
    borderStyle: z.string().optional(),
    nameColor: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

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
  updateProfileValidation
};
