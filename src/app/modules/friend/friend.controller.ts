import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { friendService } from "./friend.service";

const sendFriendRequest = catchAsync(async (req, res) => {
  const initiatorId = req.user.id as string;
  const result = await friendService.sendFriendRequestIntoDB(
    initiatorId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Friend request sent successfully",
    data: result,
  });
});

const acceptFriendRequest = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await friendService.acceptFriendRequestInDB(
    userId,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Friend request accepted",
    data: result,
  });
});

const declineFriendRequest = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  await friendService.declineFriendRequestInDB(userId, req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Friend request declined",
    data: null,
  });
});

const blockUser = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await friendService.blockUserInDB(
    userId,
    req.params.userId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User blocked successfully",
    data: result,
  });
});

const getIncomingFriendRequests = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await friendService.getIncomingFriendRequestsFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Friend requests retrieved successfully",
    data: result,
  });
});

const getSentFriendRequests = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await friendService.getSentFriendRequestsFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sent friend requests retrieved successfully",
    data: result,
  });
});

const getMyFriends = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await friendService.getMyFriendsFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Friends retrieved successfully",
    data: result,
  });
});

export const friendController = {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  blockUser,
  getIncomingFriendRequests,
  getSentFriendRequests,
  getMyFriends,
};
