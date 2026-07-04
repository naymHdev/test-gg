import { Router } from "express";
import { authController } from "./auth.controller";
import { authValidation } from "./auth.validation";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { rateLimiter } from "../../middleware/rateLimiter";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.registerValidation),
  authController.register,
);

router.post(
  "/verify-otp",
  validateRequest(authValidation.verifyOtpValidation),
  authController.verifyOtp,
);

router.post(
  "/login",
  rateLimiter.login,
  validateRequest(authValidation.loginValidation),
  authController.login,
);

router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);

router.post(
  "/forgot-password",
  validateRequest(authValidation.forgotPasswordValidation),
  authController.forgotPassword,
);

router.put(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidation),
  authController.resetPassword,
);

// "which devices am I logged in on" + force-logout a specific one
router.get(
  "/sessions",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  authController.getSessions,
);
router.delete(
  "/sessions/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  authController.revokeSession,
);

export const authRoutes = router;
