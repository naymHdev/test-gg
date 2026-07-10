import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { challengeService } from "./challenge.service";
import { Permission } from "../../../../generated/prisma/enums";
import { prisma } from "../../../shared/prisma";

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const assertManageChallengesAccess = async (user: {
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
      "You do not have permission to manage challenges",
    );
  }
};

const createChallenge = catchAsync(async (req, res) => {
  await assertManageChallengesAccess(req.user);
  const creatorId = req.user.id;
  const result = await challengeService.createChallengeIntoDB(
    creatorId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Challenge created successfully",
    data: result,
  });
});

const getChallenges = catchAsync(async (req, res) => {
  const { challenges, meta } = await challengeService.getChallengesFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Challenges retrieved successfully",
    meta,
    data: challenges,
  });
});

const getChallengeById = catchAsync(async (req, res) => {
  const result = await challengeService.getChallengeByIdFromDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Challenge retrieved successfully",
    data: result,
  });
});

const toggleChallengeActive = catchAsync(async (req, res) => {
  await assertManageChallengesAccess(req.user);
  const result = await challengeService.toggleChallengeActiveInDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Challenge ${result.active ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

const enrollInChallenge = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await challengeService.enrollInChallengeIntoDB(
    userId as string,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Enrolled in challenge successfully",
    data: result,
  });
});

const updateChallengeProgress = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await challengeService.updateChallengeProgressInDB(
    userId as string,
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.completed
      ? "Challenge completed! Reward credited."
      : "Progress updated successfully",
    data: result,
  });
});

export const challengeController = {
  createChallenge,
  getChallenges,
  getChallengeById,
  toggleChallengeActive,
  enrollInChallenge,
  updateChallengeProgress,
};
