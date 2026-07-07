import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";

const getUserProfileFromDB = async (username: string) => {
  const result = await prisma.user.findUnique({
    where: {
      username,
    },
    include: {
      profile: true,
      wallet: true,
      userPoints: true,
      subscription: true,
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
  const keys = userIds.map((id) => `presence:${id}`);
  const values = await redis.mget(...keys); // 👈 batch read, একবারেই সব key

  return userIds.reduce(
    (acc, id, i) => {
      acc[id] = values[i] === "online";
      return acc;
    },
    {} as Record<string, boolean>,
  );
};

export const UserService = {
  getUserProfileFromDB,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
  getPresenceBatch,
};
