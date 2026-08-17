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

router.post(
  "/google",
  rateLimiter.login,
  validateRequest(authValidation.googleLoginValidation),
  authController.googleLogin,
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

router.put(
  "/change-password",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(authValidation.changePasswordValidation),
  authController.changePassword,
);

router.patch(
  "/two-factor",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(authValidation.toggleTwoFactorValidation),
  authController.toggleTwoFactor,
);

router.get(
  "/login-history",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  authController.getLoginHistory,
);

export const authRoutes = router;
