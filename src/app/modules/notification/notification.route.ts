import { Router } from "express";
import { notificationController } from "./notification.controller";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { Role } from "../../../../generated/prisma/client";
import {
  registerDeviceTokenValidation,
  unregisterDeviceTokenValidation,
} from "./notification.validation";

const router = Router();
const anyAuthedUser = [Role.User, Role.Moderator, Role.Admin, Role.Owner] as const;

router.post(
  "/device-token",
  auth(...anyAuthedUser),
  validateRequest(registerDeviceTokenValidation),
  notificationController.registerDeviceToken,
);

router.delete(
  "/device-token",
  auth(...anyAuthedUser),
  validateRequest(unregisterDeviceTokenValidation),
  notificationController.unregisterDeviceToken,
);

router.get("/", auth(...anyAuthedUser), notificationController.getMyNotifications);
router.get(
  "/unread-count",
  auth(...anyAuthedUser),
  notificationController.getUnreadCount,
);
router.patch(
  "/:id/read",
  auth(...anyAuthedUser),
  notificationController.markAsRead,
);
router.patch(
  "/read-all",
  auth(...anyAuthedUser),
  notificationController.markAllAsRead,
);

export const notificationRouter = router;
