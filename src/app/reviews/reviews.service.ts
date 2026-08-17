import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import { CreatePlayerReviewInput } from "./reviews.validation";

const createPlayerReviewFromDB = async (
  reviewedUserId: string,
  reviewerId: string,
  payload: CreatePlayerReviewInput,
) => {
  const { rating, review } = payload;

  if (reviewerId === reviewedUserId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot review yourself");
  }

  return prisma.playerReview.upsert({
    where: {
      reviewerId_reviewedUserId: {
        reviewerId,
        reviewedUserId,
      },
    },

    create: {
      reviewerId,
      reviewedUserId,
      rating,
      review: review || null,
    },

    update: {
      rating,
      review: review || null,
    },
  });
};

const findPlayerReviews = async (playerId: string) => {
  const now = new Date();

  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const [
    summary,
    ratingGroups,
    recentReviews,
    currentMonthReviews,
    previousMonthReviews,
  ] = await prisma.$transaction([
    // Average rating + total reviews
    prisma.playerReview.aggregate({
      where: {
        reviewedUserId: playerId,
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    }),

    // Rating distribution
    prisma.playerReview.groupBy({
      by: ["rating"],
      where: {
        reviewedUserId: playerId,
      },
      _count: {
        id: true,
      },
      orderBy: {
        rating: "desc",
      },
    }),

    // Recent reviews
    prisma.playerReview.findMany({
      where: {
        reviewedUserId: playerId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        rating: true,
        review: true,
        createdAt: true,

        reviewer: {
          select: {
            id: true,
            username: true,

            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    }),

    // Current month reviews
    prisma.playerReview.count({
      where: {
        reviewedUserId: playerId,
        createdAt: {
          gte: currentMonthStart,
          lte: now,
        },
      },
    }),

    // Previous month reviews
    prisma.playerReview.count({
      where: {
        reviewedUserId: playerId,
        createdAt: {
          gte: previousMonthStart,
          lt: currentMonthStart,
        },
      },
    }),
  ]);

  const totalReviews = summary._count.id;

  const averageRating = summary._avg.rating ?? 0;

  // --------------------------
  // Rating Distribution
  // --------------------------

  const distribution: Record<
    number,
    {
      count: number;
      percentage: number;
    }
  > = {
    5: { count: 0, percentage: 0 },
    4: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    1: { count: 0, percentage: 0 },
  };

  ratingGroups.forEach((item) => {
    const count = item._count.id;

    distribution[item.rating] = {
      count,
      percentage:
        totalReviews > 0
          ? Number(((count / totalReviews) * 100).toFixed(1))
          : 0,
    };
  });

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: distribution[rating].count,
    percentage: distribution[rating].percentage,
  }));

  // --------------------------
  // Monthly Growth
  // --------------------------

  let growthPercentage = 0;

  if (previousMonthReviews > 0) {
    growthPercentage = Number(
      (
        ((currentMonthReviews - previousMonthReviews) / previousMonthReviews) *
        100
      ).toFixed(1),
    );
  } else if (currentMonthReviews > 0) {
    // Previous month had 0 reviews,
    // but current month has reviews.
    growthPercentage = 100;
  }

  return {
    summary: {
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews,
    },

    growth: {
      currentMonthReviews,
      previousMonthReviews,
      percentage: growthPercentage,

      direction:
        growthPercentage > 0 ? "up" : growthPercentage < 0 ? "down" : "same",
    },

    ratingDistribution,

    recentReviews: recentReviews.map((item) => ({
      id: item.id,
      rating: item.rating,
      review: item.review,
      createdAt: item.createdAt,

      reviewer: {
        id: item.reviewer.id,
        name: item.reviewer.username,
        avatar: item.reviewer.profile?.avatarUrl ?? null,
      },
    })),
  };
};

export const reviewsService = {
  createPlayerReviewFromDB,
  findPlayerReviews,
};
