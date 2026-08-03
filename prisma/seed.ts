import { prisma } from "../src/shared/prisma";
import config from "../src/app/config";
import { challengeSeeds } from "../src/lib/data/mockData";

const seedChallenges = async (): Promise<void> => {
  try {
    const adminEmail = config.admin.admin_email!;
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });

    for (const seed of challengeSeeds) {
      const existing = await prisma.challenge.findFirst({
        where: { title: seed.title },
      });

      if (existing) {
        console.log(`✅ Challenge "${seed.title}" already exists`);
        continue;
      }

      await prisma.challenge.create({
        data: {
          ...seed,
          createdById: admin.id,
        },
      });

      console.log(`✅ Challenge "${seed.title}" seeded successfully`);
    }
  } catch (error) {
    console.error("❌ Failed to seed challenges:", error);
  } finally {
    await prisma.$disconnect();
  }
};

seedChallenges();
