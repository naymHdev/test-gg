import { prisma } from "../src/shared/prisma";
import config from "../src/app/config";
import { challengeSeeds, tournamentSeeds,} from "../src/lib/data/mockData";

const seedChallenges = async (adminId: string): Promise<void> => {
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
        createdById: adminId,
      },
    });

    console.log(`✅ Challenge "${seed.title}" seeded successfully`);
  }
};

const seedTournaments = async (adminId: string): Promise<void> => {
  for (const seed of tournamentSeeds) {
    const existing = await prisma.tournament.findFirst({
      where: { name: seed.name },
    });

    if (existing) {
      console.log(`✅ Tournament "${seed.name}" already exists`);
      continue;
    }

    await prisma.tournament.create({
      data: {
        ...seed,
        creatorId: adminId,
        approvedById: seed.status === "Pending" ? null : adminId,
        approvedAt: seed.status === "Pending" ? null : new Date(),
      },
    });

    console.log(`✅ Tournament "${seed.name}" seeded successfully`);
  }
};

const seed = async (): Promise<void> => {
  try {
    const adminEmail = config.admin.admin_email!;
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });

    await seedChallenges(admin.id);
    await seedTournaments(admin.id);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

seed();
