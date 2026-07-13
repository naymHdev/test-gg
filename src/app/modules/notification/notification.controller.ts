import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { notificationService } from "./notification.service";
import pick from "../../utils/pick";
import { PAGINATION_KEYS } from "../../helpers/paginate";
import { prisma } from "../../../shared/prisma";
import { Permission } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";

/** Owner always has full access; Moderator/Admin need the explicit grant.
 *  Reuses manage_settings, same call made in legal/subscription controllers. */
const assertBroadcastAccess = async (user: { role: string; id: string }) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_settings,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to send broadcast notifications",
    );
  }
};

// ─── Device token ────────────────────────────────────────────────────────────

const registerDeviceToken = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await notificationService.registerDeviceTokenInDB(
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Device registered for push notifications",
    data: result,
  });
});

const unregisterDeviceToken = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { token } = req.body;
  await notificationService.unregisterDeviceTokenInDB(userId, token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Device unregistered",
    data: null,
  });
});

// ─── User inbox ──────────────────────────────────────────────────────────────

const getMyNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const options = pick(req.query, PAGINATION_KEYS);
  const result = await notificationService.getMyNotificationsFromDB(
    userId,
    options,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const count = await notificationService.getUnreadCountFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved successfully",
    data: { count },
  });
});

const markAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  await notificationService.markAsReadInDB(userId, id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: null,
  });
});

const markAllAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  await notificationService.markAllAsReadInDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
    data: null,
  });
});

// ─── Admin broadcast ─────────────────────────────────────────────────────────

const broadcastNotification = catchAsync(async (req, res) => {
  await assertBroadcastAccess(req.user);
  const result = await notificationService.broadcastNotificationToDB(
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Broadcast sent to ${result.recipientCount} user(s)`,
    data: result,
  });
});

export const notificationController = {
  registerDeviceToken,
  unregisterDeviceToken,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  broadcastNotification,
};
