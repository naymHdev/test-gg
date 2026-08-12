import { Router } from "express";
import { UserController } from "./user.controller";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/client";
import { uploadFactory } from "../../helpers/uploadFactory";
import validateRequest from "../../middleware/validateRequest";
import { userValidation } from "./user.validation";
import requireActivePremium from "../../middleware/requireActivePremium";

const router = Router();

router.get("/:username/profile", UserController.getUserProfile);

router.patch(
  "/profile",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  validateRequest(userValidation.updateProfileValidation),
  UserController.updateProfile,
);

router.patch(
  "/profile/banner",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  uploadFactory({ type: "image", maxFiles: 1 }).single("banner"),
  UserController.updateProfileBanner,
);

router.patch(
  "/profile/avatar",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  uploadFactory({ type: "image", maxFiles: 1 }).single("avatar"),
  UserController.updateProfileAvatar,
);

router.patch(
  "/profile/background",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  requireActivePremium,
  uploadFactory({ type: "image", maxFiles: 1 }).single("background"),
  UserController.updateProfileBackground,
);

router.patch(
  "/profile/post-background",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  requireActivePremium,
  uploadFactory({ type: "image", maxFiles: 1 }).single("background"),
  UserController.updatePostBackground,
);

router.get(
  "/presence",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  UserController.getPresence,
);

router.patch(
  "/notification-settings",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(userValidation.notificationSettingsValidation),
  UserController.updateNotificationSettings,
);

router.patch(
  "/deactivate",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  UserController.deactivateAccount,
);

router.delete(
  "/account",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(userValidation.deleteAccountValidation),
  UserController.deleteAccount,
);

export const userRoutes = router;
