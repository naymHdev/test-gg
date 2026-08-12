import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
    message: "Color must be a valid hex color",
  });

const premiumBackground = z.string().trim().min(1).max(2048);
const premiumBorderStyle = z.string().trim().min(1).max(100);

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
    background: premiumBackground.optional(),
    borderStyle: premiumBorderStyle.optional(),
    nameColor: hexColor.optional(),
    postBackground: premiumBackground.optional(),
    postBorderStyle: premiumBorderStyle.optional(),
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
