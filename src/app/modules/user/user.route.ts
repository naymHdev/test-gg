import { Router } from "express";
import { UserController } from "./user.controller";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/client";
import { uploadFactory } from "../../helpers/uploadFactory";

const router = Router();

router.get("/:username/profile", UserController.getUserProfile);

router.patch(
  "/profile",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  UserController.updateProfile,
);

router.patch(
  "/profile/banner",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
);

router.patch(
  "/profile/avatar",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  uploadFactory({ type: "image", maxFiles: 1 }).single("avatar"),
  UserController.updateProfileAvatar,
);

router.patch(
  "/profile/banner",
  auth(Role.Admin, Role.Moderator, Role.Owner, Role.User),
  uploadFactory({ type: "image", maxFiles: 1 }).single("banner"),
  UserController.updateProfileBanner,
);

export const userRoutes = router;
