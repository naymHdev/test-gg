import z from "zod";

const accountCreateValidation = z.object({
  name: z
    .string({ message: "Name is required" })
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name is too long" }),

  email: z
    .string({ message: "Email is required" })
    .email({ message: "Invalid email address" }),

  password: z
    .string({ message: "Password is required" })
    .min(6, { message: "Password must be at least 6 characters" })
    .max(50, { message: "Password is too long" }),
  role: z.enum(["Admin", "SuperAdmin", "Vendor", "User"]).default("User"),
});

const accountLoginValidation = z.object({
  email: z
    .string({ message: "Email is required" })
    .email({ message: "Invalid email address" }),

  password: z
    .string({ message: "Password is required" })
    .min(6, { message: "Password must be at least 6 characters" })
    .max(50, { message: "Password is too long" }),
});

const changedPasswordValidation = z.object({
  oldPassword: z.string({ message: "Old password is required" }),
  newPassword: z.string({ message: "New password is required" }).min(6),
  confirmPassword: z.string({ message: "Confirm password is required" }).min(6),
});

export const authValidation = {
  accountCreateValidation,
  loginValidation: accountLoginValidation,
  changedPasswordValidation,
};
