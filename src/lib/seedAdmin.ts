import bcrypt from "bcrypt";
import { prisma } from "../shared/prisma";
import {
  Role,
  AccountStatus,
  Region,
  Language,
} from "../../generated/prisma/client";
import config from "../app/config";

const seedAdmin = async (): Promise<void> => {
  try {
    const email = config.admin.admin_email!;
    const password = config.admin.admin_password!;
    const username = config.admin.admin_username ?? "admin";

    const existingAdmin = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingAdmin) {
      console.log("✅ Admin account already exists");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,

        role: Role.Admin,
        status: AccountStatus.Active,

        region: Region.NA, // Change your default region
        accountLanguage: Language.en,
        uiLanguage: Language.en,

        agreedToTerms: true,
        agreedToPrivacy: true,

        profile: {
          create: {
            bio: "System Administrator",
          },
        },
      },
    });

    console.log("✅ Admin account created successfully");
  } catch (error) {
    console.error("❌ Failed to seed admin:", error);
  } finally {
    await prisma.$disconnect();
  }
};

export default seedAdmin;
