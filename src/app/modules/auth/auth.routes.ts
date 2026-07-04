import { Router } from "express";
import { authController } from "./auth.controller";
import validateRequest from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

router.post(
  "/create-account",
  validateRequest(authValidation.accountCreateValidation),
  authController.createAccount,
);

router.post(
  "/login",
  validateRequest(authValidation.loginValidation),
  authController.accountLogin,
);

router.post(
  "/change-password",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  validateRequest(authValidation.changedPasswordValidation),
  authController.changePassword,
);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/refresh-token", authController.refreshToken);

router.post("/social-login", authController.socialLogin);

// Switch account (User ↔ Vendor)
router.post(
  "/switch-account",
  auth(Role.User, Role.Vendor),
  authController.switchAccount,
);

// Vendor upgrade request
router.post(
  "/upgrade-to-vendor",
  auth(Role.User),
  authController.upgradeToVendor,
);

export const authRoutes = router;
