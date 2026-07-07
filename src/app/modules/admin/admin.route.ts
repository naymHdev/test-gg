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

export const adminRoutes = router;
