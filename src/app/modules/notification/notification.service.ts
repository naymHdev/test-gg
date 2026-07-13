import { prisma } from "../../../shared/prisma";
import {
  NotificationType,
  Prisma,
} from "../../../../generated/prisma/client";
import { PaginationQuery, paginate } from "../../helpers/paginate";
import { sendMulticastPush } from "../../../utils/fcm.helper";
import {
  RegisterDeviceTokenInput,
  BroadcastNotificationInput,
} from "./notification.validation";

// ─── Device tokens ───────────────────────────────────────────────────────────
// One row per device (mirrors RefreshToken) — upsert on the token itself so
// re-registering the same device (app reinstall, token refresh) never
// duplicates rows, and a device that logs into a different account simply
// gets reassigned instead of erroring.

const registerDeviceTokenInDB = async (
  userId: string,
  payload: RegisterDeviceTokenInput,
) =>
  prisma.deviceToken.upsert({
    where: { token: payload.token },
    create: { userId, token: payload.token, platform: payload.platform },
    update: { userId, platform: payload.platform },
  });

const unregisterDeviceTokenInDB = async (userId: string, token: string) =>
  prisma.deviceToken.deleteMany({ where: { userId, token } });

// ─── User-facing notification inbox ─────────────────────────────────────────

const getMyNotificationsFromDB = async (
  userId: string,
  pagination: PaginationQuery,
) =>
  paginate({
    model: prisma.notification,
    where: { userId },
    pagination,
    defaults: { sortBy: "createdAt", sortOrder: "desc" },
  });

const getUnreadCountFromDB = async (userId: string) =>
  prisma.notification.count({ where: { userId, isRead: false } });

const markAsReadInDB = async (userId: string, notificationId: string) =>
  prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });

const markAllAsReadInDB = async (userId: string) =>
  prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

// ─── Admin broadcast ─────────────────────────────────────────────────────────
// Fans a single announcement out to every matching user: one Notification
// row per recipient (so each shows up in their inbox / unread count) plus a
// single chunked FCM multicast covering every recipient's devices.

const broadcastNotificationToDB = async (payload: BroadcastNotificationInput) => {
  const recipients = await prisma.user.findMany({
    where: {
      ...(payload.roles?.length ? { role: { in: payload.roles } } : {}),
      ...(payload.premiumOnly ? { isPremium: true } : {}),
    },
    select: { id: true },
  });

  if (recipients.length === 0) {
    return { recipientCount: 0, pushedDeviceCount: 0 };
  }

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: NotificationType.admin_announcement,
      title: payload.title,
      body: payload.body,
      data: payload.data as Prisma.InputJsonValue,
    })),
  });

  const devices = await prisma.deviceToken.findMany({
    where: { userId: { in: recipients.map((r) => r.id) } },
    select: { token: true },
  });

  const pushResults =
    devices.length > 0
      ? await sendMulticastPush({
          tokens: devices.map((d) => d.token),
          title: payload.title,
          body: payload.body,
        })
      : [];

  return {
    recipientCount: recipients.length,
    pushedDeviceCount: pushResults.filter((r) => r.success).length,
  };
};

export const notificationService = {
  registerDeviceTokenInDB,
  unregisterDeviceTokenInDB,
  getMyNotificationsFromDB,
  getUnreadCountFromDB,
  markAsReadInDB,
  markAllAsReadInDB,
  broadcastNotificationToDB,
};
