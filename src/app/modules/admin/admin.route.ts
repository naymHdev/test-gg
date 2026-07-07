import { Router } from "express";
import auth from "../../middleware/auth";
import { adminController } from "./admin.controller";
import { Role } from "../../../../generated/prisma/client";

const router = Router();

router.get(
  "/users",
  auth(Role.Admin, Role.Owner, Role.Moderator),
  adminController.getAllUsers,
);

router.patch(
  "/users/:id/role",
  auth(Role.Admin, Role.Owner),
  adminController.updateRole,
);

router.patch(
  "/users/:id/permissions",
  auth(Role.Admin, Role.Owner),
  adminController.upsertPermissions,
);

export const adminRoutes = router;
