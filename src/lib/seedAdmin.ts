import bcrypt from "bcrypt";
import config from "../app/config";
import { prisma } from "../shared/prisma";
import { Role } from "../../generated/prisma/client";

const seedAdmin = async (): Promise<void> => {
  try {
    const email = config.admin.admin_email!;
    const phone = config.admin.phone_number!;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("Admin account already exists ✅");
      return;
    }

    const hashedPassword = await bcrypt.hash(config.admin.admin_password!, 10);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: "Miss Chine",
          email,
          phone,
          gender: "OTHER",
          notification: true,
          isOnline: false,
          socialLogin: false,
          isGuest: false,
          isDeleted: false,
          locationType: "Point",
          latitude: 0,
          longitude: 0,
        },
      });

      await tx.auth.create({
        data: {
          email,
          password: hashedPassword,
          role: Role.SUPER_ADMIN,
          roles: [Role.SUPER_ADMIN],
          isActive: true,
          isDeleted: false,
          isVerified: true,
          otp: "0",
          otp_status: true,
          expiredAt: new Date(),
          last_login: new Date(),
          passwordChangedAt: new Date(),
          userId: user.id,
        },
      });
    });

    console.log("Admin account created ✅");
  } catch (err: any) {
    console.error("Error creating admin account:", err.message);
  } finally {
    await prisma.$disconnect();
  }
};

export default seedAdmin;
