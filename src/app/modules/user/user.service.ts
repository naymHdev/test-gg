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

const updateProfile = async (payload: any) => {};

export const UserService = {
  getUserProfileFromDB,
  updateProfile,
};
