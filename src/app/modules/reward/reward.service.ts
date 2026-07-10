import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { CreateRewardInput } from "./reward.validation";

// ─── Reward CRUD ─────────────────────────────────────────────────────────────

const createRewardIntoDB = async (
  creatorId: string,
  payload: CreateRewardInput,
) => {
  return prisma.reward.create({
    data: { ...payload, createdById: creatorId },
  });
};

const getRewardsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["title", "description"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const rewards = await prisma.reward.findMany({
    ...options,
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { purchases: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.reward);
  return { rewards, meta };
};

const getRewardByIdFromDB = async (rewardId: string) => {
  return prisma.reward.findUniqueOrThrow({
    where: { id: rewardId },
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { purchases: true } },
    },
  });
};

const toggleRewardActiveInDB = async (rewardId: string) => {
  const reward = await prisma.reward.findUniqueOrThrow({
    where: { id: rewardId },
  });

  return prisma.reward.update({
    where: { id: rewardId },
    data: { active: !reward.active },
  });
};

// ─── Purchase (spends points earned from challenges) ────────────────────────

const purchaseRewardIntoDB = async (userId: string, rewardId: string) => {
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUniqueOrThrow({
      where: { id: rewardId },
    });

    if (!reward.active) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This reward is not currently available",
      );
    }

    const userPoints = await tx.userPoints.findUnique({ where: { userId } });
    const balance = userPoints?.balance ?? 0;

    if (balance < reward.cost) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You do not have enough points to purchase this reward",
      );
    }

    await tx.userPoints.update({
      where: { userId },
      data: { balance: { decrement: reward.cost } },
    });

    return tx.rewardPurchase.create({
      data: { rewardId, userId, costPaid: reward.cost },
    });
  });
};

export const rewardService = {
  createRewardIntoDB,
  getRewardsFromDB,
  getRewardByIdFromDB,
  toggleRewardActiveInDB,
  purchaseRewardIntoDB,
};
