import { prisma } from "../../../shared/prisma";

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

export const UserService = {
  getUserProfileFromDB,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
};
