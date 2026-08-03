import { z } from "zod";

const registerValidation = z.object({
  username: z
    .string({ message: "Username is required" })
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscore allowed"),

  email: z.string({ message: "Email is required" }).email(),

  password: z
    .string({ message: "Password is required" })
    .min(8)
    .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Must contain at least 1 number"),

  region: z.enum([
    "EUW",
    "EUNE",
    "NA",
    "KR",
    "BR",
    "LAN_LAS",
    "OCE",
    "TR",
    "JP",
    "ME_SEA",
  ]),

  language: z.enum([
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
  ]),

  agreedToTerms: z.literal(true, {
    message: "You must agree to the Terms of Service",
  }),
  agreedToPrivacy: z.literal(true, {
    message: "You must agree to the Privacy Policy",
  }),
});

const loginValidation = z.object({
  email: z.string({ message: "Email is required" }).email(),
  password: z.string({ message: "Password is required" }),
  stayLoggedIn: z.boolean().default(false),
});

const verifyOtpValidation = z.object({
  pendingToken: z.string({ message: "pendingToken is required" }),
  otp: z.string().length(6, "OTP must be 6 digits"),
  purpose: z.string().optional(),
});

const forgotPasswordValidation = z.object({
  email: z.string({ message: "Email is required" }).email(),
});

const resetPasswordValidation = z.object({
  token: z.string({ message: "Reset token is required" }),
  newPassword: z
    .string({ message: "New password is required" })
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

const changePasswordValidation = z.object({
  currentPassword: z.string({ message: "Current password is required" }),
  newPassword: z
    .string({ message: "New password is required" })
    .min(8)
    .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Must contain at least 1 number"),
});

const toggleTwoFactorValidation = z.object({
  enabled: z.boolean({ message: "enabled is required" }),
});

export const authValidation = {
  registerValidation,
  loginValidation,
  verifyOtpValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  toggleTwoFactorValidation,
};
