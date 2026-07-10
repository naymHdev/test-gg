import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { NotificationType } from "../../../../generated/prisma/client";
import {
  CreateChallengeInput,
  UpdateChallengeProgressInput,
} from "./challenge.validation";

// ─── Challenge CRUD ──────────────────────────────────────────────────────────
const createChallengeIntoDB = async (
  creatorId: string,
  payload: CreateChallengeInput,
) => {
  return prisma.challenge.create({
    data: { ...payload, createdById: creatorId },
  });
};

const getChallengesFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["title", "description"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const challenges = await prisma.challenge.findMany({
    ...options,
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { enrollments: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.challenge);
  return { challenges, meta };
};

const getChallengeByIdFromDB = async (challengeId: string) => {
  return prisma.challenge.findUniqueOrThrow({
    where: { id: challengeId },
    include: {
      createdBy: { select: { id: true, username: true } },
      _count: { select: { enrollments: true } },
      enrollments: true,
    },
  });
};

const toggleChallengeActiveInDB = async (challengeId: string) => {
  const challenge = await prisma.challenge.findUniqueOrThrow({
    where: { id: challengeId },
  });

  return prisma.challenge.update({
    where: { id: challengeId },
    data: { active: !challenge.active },
  });
};

// ─── Enrollment ──────────────────────────────────────────────────────────────

const enrollInChallengeIntoDB = async (userId: string, challengeId: string) => {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUniqueOrThrow({
      where: { id: challengeId },
    });

    if (!challenge.active) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This challenge is not currently active",
      );
    }

    const existingEnrollment = await tx.challengeEnrollment.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    });

    if (existingEnrollment) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You are already enrolled in this challenge",
      );
    }

    return tx.challengeEnrollment.create({
      data: { challengeId, userId },
    });
  });
};

// ─── Progress & reward payout ───────────────────────────────────────────────

const updateChallengeProgressInDB = async (
  userId: string,
  challengeId: string,
  payload: UpdateChallengeProgressInput,
) => {
  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.challengeEnrollment.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
      include: { challenge: true },
    });

    if (!enrollment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are not enrolled in this challenge",
      );
    }

    if (enrollment.completed) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This challenge has already been completed",
      );
    }

    const newProgress = Math.min(
      enrollment.progress + payload.incrementBy,
      enrollment.challenge.total,
    );
    const justCompleted = newProgress >= enrollment.challenge.total;

    const updatedEnrollment = await tx.challengeEnrollment.update({
      where: { challengeId_userId: { challengeId, userId } },
      data: {
        progress: newProgress,
        completed: justCompleted,
        completedAt: justCompleted ? new Date() : null,
      },
    });

    if (justCompleted) {
      const { rewardPts, xp } = enrollment.challenge;

      await tx.userPoints.upsert({
        where: { userId },
        update: {
          balance: { increment: rewardPts },
          totalEarned: { increment: rewardPts },
          xp: { increment: xp },
        },
        create: {
          userId,
          balance: rewardPts,
          totalEarned: rewardPts,
          xp,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          type: NotificationType.challenge_completed,
          title: "Challenge completed!",
          body: `You earned ${rewardPts} points and ${xp} XP for completing "${enrollment.challenge.title}".`,
          data: { challengeId, rewardPts, xp },
        },
      });
    }

    return updatedEnrollment;
  });
};

export const challengeService = {
  createChallengeIntoDB,
  getChallengesFromDB,
  getChallengeByIdFromDB,
  toggleChallengeActiveInDB,
  enrollInChallengeIntoDB,
  updateChallengeProgressInDB,
};
