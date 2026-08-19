import bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import {
  Prisma,
  SubscriptionStatus,
} from "../../../../generated/prisma/client";
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

const USER_FIELDS = ["username", "uiLanguage"] as const;
const PROFILE_FIELDS = [
  "bio",
  "background",
  "borderStyle",
  "nameColor",
  "postBackground",
  "postBorderStyle",
] as const;
const PREMIUM_PROFILE_FIELDS = new Set([
  "background",
  "borderStyle",
  "nameColor",
  "postBackground",
  "postBorderStyle",
]);

const updateProfile = async (
  userId: string,
  payload: {
    username?: string;
    uiLanguage?: string;
    bio?: string;
    background?: string;
    borderStyle?: string;
    nameColor?: string;
    postBackground?: string;
    postBorderStyle?: string;
  },
) => {
  const userData: Record<string, unknown> = {};
  const profileData: Record<string, unknown> = {};

  for (const key of USER_FIELDS) {
    if (payload[key] !== undefined) userData[key] = payload[key];
  }
  for (const key of PROFILE_FIELDS) {
    if (payload[key] !== undefined) profileData[key] = payload[key];
  }

  const isUpdatingPremiumCustomization = Object.keys(profileData).some((key) =>
    PREMIUM_PROFILE_FIELDS.has(key),
  );

  if (isUpdatingPremiumCustomization) {
    const activePremiumSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.Active,
        currentPeriodEnd: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!activePremiumSubscription) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "An active premium subscription is required to customize your profile",
      );
    }
  }

  if (typeof userData.username === "string") {
    const taken = await prisma.user.findFirst({
      where: {
        username: { equals: userData.username as string, mode: "insensitive" },
        id: { not: userId },
      },
    });
    if (taken) {
      throw new AppError(httpStatus.CONFLICT, "USERNAME_TAKEN");
    }
  }

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: userData,
      select: { id: true, username: true, uiLanguage: true },
    }),
    prisma.profile.update({
      where: { userId },
      data: profileData,
    }),
  ]);

  return { ...updatedUser, profile: updatedProfile };
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

const updatePremiumBackground = async (payload: {
  userId: string;
  type: "profile" | "post";
  background: string;
}) => {
  const activePremiumSubscription = await prisma.subscription.findFirst({
    where: {
      userId: payload.userId,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!activePremiumSubscription) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "An active premium subscription is required to customize your profile",
    );
  }

  return prisma.profile.update({
    where: { userId: payload.userId },
    data:
      payload.type === "profile"
        ? { background: payload.background }
        : { postBackground: payload.background },
  });
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

  const passwordMatches = await bcrypt.compare(password, user.passwordHash as string);
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

const contentBreakdown = async (userId: string) => {
  const [user, mediaPostStats, categoryStats] = await prisma.$transaction([
    // 1. User info + recent media posts
    prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        isPremium: true,
        isRiotVerified: true,

        profile: {
          select: {
            avatarUrl: true,
          },
        },

        // Recent 10 media posts
        mediaPosts: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 2,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            language: true,
            reactionsCount: true,
            views: true,
            isPremium: true,
            createdAt: true,

            images: {
              orderBy: {
                order: "asc",
              },
              select: {
                id: true,
                url: true,
                order: true,
              },
            },

            mediaVideos: {
              orderBy: {
                order: "asc",
              },
              select: {
                id: true,
                url: true,
                order: true,
              },
            },

            _count: {
              select: {
                comments: {
                  where: {
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },

        _count: {
          select: {
            friendsInitiated: true,
            friendsReceived: true,
          },
        },
      },
    }),

    // 2. ALL media post count + total reactions
    prisma.mediaPost.aggregate({
      where: {
        userId,
        deletedAt: null,
      },

      _count: {
        id: true,
      },

      _sum: {
        reactionsCount: true,
        views: true,
      },
    }),

    // 3. Content category breakdown
    prisma.mediaPost.groupBy({
      by: ["category"],

      where: {
        userId,
        deletedAt: null,
      },

      _count: {
        id: true,
      },

      orderBy: {
        _count: {
          id: "desc",
        },
      },
    }),
  ]);

  if (!user) {
    return null;
  }

  // Screenshot / Clip / Meme / Highlight
  const categoryBreakdown = categoryStats.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.category.toLowerCase()] = item._count.id;
      return acc;
    },
    {},
  );

  // groupBy already sorted DESC
  const mostPostedType =
    categoryStats.length > 0 ? categoryStats[0].category : null;

  return {
    profileInfo: {
      id: user.id,
      name: user.username,
      avatar: user.profile?.avatarUrl ?? null,
      createdAt: user.createdAt,
      isPremium: user.isPremium,
      isRiotVerified: user.isRiotVerified,
    },

    badges: ["Top Poster", "Early Adopter"],

    stats: {
      // Total non-deleted MediaPosts
      posts: mediaPostStats._count.id,

      followers: user._count.friendsInitiated,
      following: user._count.friendsReceived,

      // Total reactions received on ALL MediaPosts
      totalQReceived: mediaPostStats._sum.reactionsCount ?? 0,

      // Optional
      totalViews: mediaPostStats._sum.views ?? 0,
    },

    contentBreakdown: {
      screenshot: categoryBreakdown.screenshot ?? 0,
      clip: categoryBreakdown.clip ?? 0,
      meme: categoryBreakdown.meme ?? 0,
      highlight: categoryBreakdown.highlight ?? 0,

      mostPostedType,
    },

    recentPosts: user.mediaPosts.map((post) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      category: post.category,

      reactionCount: post.reactionsCount,
      commentCount: post._count.comments,
      views: post.views,

      isPremium: post.isPremium,
      language: post.language,

      images: post.images,
      videos: post.mediaVideos,

      createdAt: post.createdAt,
    })),
  };
};

const playerReputation = async (userId: string) => {
  console.log("userID_____", userId);
};

export const UserService = {
  getUserProfileFromDB,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
  updatePremiumBackground,
  getPresenceBatch,
  updateNotificationSettings,
  deactivateAccount,
  deleteAccount,
  contentBreakdown,
  playerReputation,
};
