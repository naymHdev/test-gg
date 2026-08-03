import bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";
import AppError from "../../error/AppError";
import { logActivity } from "../admin/admin.helper";
import {
  sendAccountDeactivatedEmail,
  sendAccountDeletedEmail,
} from "../../utils/mailSender";

const getUserProfileFromDB = async (username: string) => {
  const result = await prisma.user.findUnique({
    where: { username },
    include: {
      profile: true,
      wallet: true,
      userPoints: true,
      subscription: true,
      permissions: true,
    },
  });

  return result;
};

const updateProfile = async (payload: any) => {
  console.log("payload____", payload);
};

const updateProfileAvatar = async (payload: {
  userId: string;
  avatar: string;
}) => {
  const { userId, avatar } = payload;

  const result = await prisma.profile.update({
    where: { userId: userId },
    data: { avatarUrl: avatar },
  });

  return result;
};

const updateProfileBanner = async (payload: {
  userId: string;
  banner: string;
}) => {
  const { userId, banner } = payload;

  const result = await prisma.profile.update({
    where: { userId: userId },
    data: { bannerUrl: banner },
  });

  return result;
};

const getPresenceBatch = async (userIds: string[]) => {
  const keys = userIds?.map((id) => `presence:${id}`);
  const values = await redis.mget(...keys);

  return userIds?.reduce(
    (acc, id, i) => {
      acc[id] = values[i] === "online";
      return acc;
    },
    {} as Record<string, boolean>,
  );
};

// ─── Notification Settings ──────────────────────────────────────────────────

const updateNotificationSettings = async (
  userId: string,
  payload: {
    emailNotifications?: boolean;
    newMessageNotifications?: boolean;
    systemUpdateNotifications?: boolean;
  },
) => {
  const result = await prisma.user.update({
    where: { id: userId },
    data: payload,
    select: {
      emailNotifications: true,
      newMessageNotifications: true,
      systemUpdateNotifications: true,
    },
  });

  return result;
};

// ─── Deactivate Account (temporary) ─────────────────────────────────────────
// Logging back in with the correct credentials reactivates the account —
// see the Deactivated branch in auth.service.ts::loginWithCredentials

const deactivateAccount = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.status === "Deactivated") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Account is already deactivated",
    );
  }
  if (user.status === "Banned" || user.status === "Deleted") {
    throw new AppError(httpStatus.BAD_REQUEST, "Account cannot be deactivated");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: userId },
      data: { status: "Deactivated" },
    });

    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(tx, {
      actorId: userId,
      action: "deactivated_account",
      targetType: "User",
      targetId: userId,
    });

    return result;
  });

  sendAccountDeactivatedEmail(updated.email).catch(() => null);
  return { status: updated.status };
};

// ─── Delete Account (permanent) ─────────────────────────────────────────────
// This is an anonymization, not a literal SQL DELETE: several relations this
// user may own (Tournament.creatorId, Report.reporterId/resolvedById,
// Challenge/Reward.createdById, Match.declaredById, ActivityLog.actorId,
// User.bannedById) use the default Restrict FK, so a hard delete would throw
// once the user has any history at all. Scrubbing PII + revoking access gets
// the same practical outcome ("this person is gone") without breaking every
// piece of content/moderation history that points back at this row.
const deleteAccount = async (userId: string, password: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Password is incorrect");
  }

  const anonymizedTag = `deleted_${userId}`;
  const unusablePasswordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    10,
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "Deleted",
        username: anonymizedTag,
        email: `${anonymizedTag}@deleted.finderq`,
        passwordHash: unusablePasswordHash,
        riotAccount: Prisma.JsonNull,
        isRiotVerified: false,
      },
    });

    await tx.profile.update({
      where: { userId },
      data: { avatarUrl: null, bannerUrl: null, bio: null },
    });

    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.deviceToken.deleteMany({ where: { userId } });

    await logActivity(tx, {
      actorId: userId,
      action: "deleted_account",
      targetType: "User",
      targetId: userId,
    });
  });

  sendAccountDeletedEmail(user.email).catch(() => null);
};

export const UserService = {
  getUserProfileFromDB,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
  getPresenceBatch,
  updateNotificationSettings,
  deactivateAccount,
  deleteAccount,
};
