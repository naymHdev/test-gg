import httpStatus from "http-status";
import {
  AccountStatus,
  NotificationType,
  Permission,
  Role,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import {
  buildWhereClause,
  paginate,
  PaginationQuery,
} from "../../helpers/paginate";
import {
  ActivityLogFilterQuery,
  UserFilterQuery,
} from "../../interface/contents.interface";
import { logActivity } from "./admin.helper";
import { sendAccountBannedEmail } from "../../utils/mailSender";
import { notificationHelper } from "../notification/notification.helper";
import {
  BanUserInput,
  TimeoutUserInput,
  WarnUserInput,
} from "./admin.validation";

const WARNING_COUNT_AUTO_BAN_THRESHOLD = 5;

const getAllUsersFromDB = async (
  options: PaginationQuery,
  query: UserFilterQuery,
) => {
  const { searchTerm, ...filters } = query;

  const where = buildWhereClause(
    searchTerm,
    [{ field: "username" }, { field: "email" }],
    filters,
    [
      { query: "username", operator: "contains" },
      { query: "email", operator: "contains" },
      { query: "region", operator: "equals" },
    ],
  );

  return paginate({
    model: prisma.user,
    where,
    pagination: options,
    include: { profile: true, permissions: true },
  });
};

const updateRole = async (id: string, role: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (user?.role === role) {
    throw new AppError(httpStatus.BAD_REQUEST, "Role is already same");
  }

  const res = await prisma.user.update({
    where: { id },
    data: {
      role: role as Role,
    },
  });

  return res;
};

const upsertPermissions = async (
  id: string,
  permissions: Permission[],
  grantedById: string,
) => {
  return await prisma.$transaction([
    prisma.userPermission.deleteMany({
      where: {
        userId: id,
      },
    }),

    prisma.userPermission.createMany({
      data: permissions.map((permission) => ({
        userId: id,
        permission,
        grantedById,
      })),
    }),
  ]);
};

// ─── Ban / Unban ─────────────────────────────────────────────────────────────

const banUserInDB = async (
  adminId: string,
  userId: string,
  payload: BanUserInput,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.status === AccountStatus.Banned) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already banned");
  }

  const bannedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.Banned,
        banReason: payload.reason,
        banDetails: payload.details,
        bannedById: adminId,
        bannedAt: new Date(),
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await notificationHelper.createNotification(tx, {
      userId,
      type: NotificationType.account_banned,
      title: "Your account has been banned",
      body: payload.reason,
      data: { reason: payload.reason, details: payload.details },
    });

    await logActivity(tx, {
      actorId: adminId,
      action: "banned_user",
      targetType: "User",
      targetId: userId,
      metadata: { reason: payload.reason, details: payload.details },
    });

    return updated;
  });

  // fire-and-forget after commit, same reasoning as socket emits elsewhere
  sendAccountBannedEmail(bannedUser.email, payload.reason).catch(() => null);
  notificationHelper.queuePush(userId, {
    title: "Your account has been banned",
    body: payload.reason,
  });

  return bannedUser;
};

const unbanUserInDB = async (adminId: string, userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.status !== AccountStatus.Banned) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is not banned");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.Active,
        banReason: null,
        banDetails: null,
        bannedById: null,
        bannedAt: null,
      },
    });

    await logActivity(tx, {
      actorId: adminId,
      action: "unbanned_user",
      targetType: "User",
      targetId: userId,
    });

    return updated;
  });
};

// ─── Warn ────────────────────────────────────────────────────────────────────

const warnUserInDB = async (
  adminId: string,
  userId: string,
  payload: WarnUserInput,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.status === AccountStatus.Banned) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already banned");
  }

  const newWarningCount = user.warningCount + 1;

  // Reuse the ban service instead of duplicating the ban logic here
  if (newWarningCount >= WARNING_COUNT_AUTO_BAN_THRESHOLD) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { warningCount: newWarningCount },
      });

      await logActivity(tx, {
        actorId: adminId,
        action: "warned_user",
        targetType: "User",
        targetId: userId,
        metadata: { reason: payload.reason, warningCount: newWarningCount },
      });
    });

    return banUserInDB(adminId, userId, {
      reason: "Automatic ban: exceeded warning threshold",
      details: `Last warning reason: ${payload.reason}`,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        warningCount: newWarningCount,
        status: AccountStatus.Warned,
      },
    });

    await notificationHelper.createNotification(tx, {
      userId,
      type: NotificationType.warning_issued,
      title: "You have received a warning",
      body: payload.reason,
      data: { reason: payload.reason, warningCount: newWarningCount },
    });

    await logActivity(tx, {
      actorId: adminId,
      action: "warned_user",
      targetType: "User",
      targetId: userId,
      metadata: { reason: payload.reason, warningCount: newWarningCount },
    });

    return updatedUser;
  });

  notificationHelper.queuePush(userId, {
    title: "You have received a warning",
    body: payload.reason,
  });

  return updated;
};

// ─── Timeout ─────────────────────────────────────────────────────────────────

const timeoutUserInDB = async (
  adminId: string,
  userId: string,
  payload: TimeoutUserInput,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.status === AccountStatus.Banned) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already banned");
  }

  const timeoutUntil = new Date(
    Date.now() + payload.durationMinutes * 60 * 1000,
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { timeoutUntil },
    });

    await logActivity(tx, {
      actorId: adminId,
      action: "timed_out_user",
      targetType: "User",
      targetId: userId,
      metadata: {
        reason: payload.reason,
        durationMinutes: payload.durationMinutes,
        timeoutUntil,
      },
    });

    return updated;
  });
};

// ─── Activity log ────────────────────────────────────────────────────────────

const getActivityLogsFromDB = async (
  options: PaginationQuery,
  query: ActivityLogFilterQuery,
) => {
  const { ...filters } = query;

  const where = buildWhereClause(undefined, [], filters, [
    { query: "actorId", operator: "equals" },
    { query: "action", operator: "equals" },
    { query: "targetType", operator: "equals" },
  ]);

  return paginate({
    model: prisma.activityLog,
    where,
    pagination: options,
    include: { actor: { select: { id: true, username: true, role: true } } },
  });
};

export const adminService = {
  getAllUsersFromDB,
  updateRole,
  upsertPermissions,
  banUserInDB,
  unbanUserInDB,
  warnUserInDB,
  timeoutUserInDB,
  getActivityLogsFromDB,
};
