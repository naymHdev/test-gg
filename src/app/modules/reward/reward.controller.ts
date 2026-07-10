import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { rewardService } from "./reward.service";
import { Permission } from "../../../../generated/prisma/enums";
import { prisma } from "../../../shared/prisma";

/** Owner always has full access; Moderator/Admin need the explicit grant.
 *  Reuses `manage_challenges` — there's no separate reward permission in the
 *  Permission enum, and rewards are part of the same gamification surface. */
const assertManageRewardsAccess = async (user: {
  role: string;
  id: string;
}) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_challenges,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage rewards",
    );
  }
};

const createReward = catchAsync(async (req, res) => {
  await assertManageRewardsAccess(req.user);
  const creatorId = req.user.id;
  const result = await rewardService.createRewardIntoDB(
    creatorId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Reward created successfully",
    data: result,
  });
});

const getRewards = catchAsync(async (req, res) => {
  const { rewards, meta } = await rewardService.getRewardsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Rewards retrieved successfully",
    meta,
    data: rewards,
  });
});

const getRewardById = catchAsync(async (req, res) => {
  const result = await rewardService.getRewardByIdFromDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reward retrieved successfully",
    data: result,
  });
});

const toggleRewardActive = catchAsync(async (req, res) => {
  await assertManageRewardsAccess(req.user);
  const result = await rewardService.toggleRewardActiveInDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Reward ${result.active ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

const purchaseReward = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await rewardService.purchaseRewardIntoDB(
    userId as string,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Reward purchased successfully",
    data: result,
  });
});

export const rewardController = {
  createReward,
  getRewards,
  getRewardById,
  toggleRewardActive,
  purchaseReward,
};
