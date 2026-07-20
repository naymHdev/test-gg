import httpStatus from "http-status";
import { channelService } from "./channel.service";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/sendResponse";

const createChannel = catchAsync(async (req, res) => {
  const result = await channelService.createChannel(
    req.user.id,
    req.user.username,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Voice channel created",
    data: result,
  });
});

const getPublicChannels = catchAsync(async (req, res) => {
  const result = await channelService.getPublicChannels();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Public channels retrieved",
    data: result,
  });
});

const joinChannel = catchAsync(async (req, res) => {
  const result = await channelService.joinChannel(
    req.params.channelId as string,
    req.user.id,
    req.user.username,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.status === "waiting_room"
        ? "Waiting for owner approval"
        : "Joined channel",
    data: result,
  });
});

const listWaitingRoomRequests = catchAsync(async (req, res) => {
  const result = await channelService.listWaitingRoomRequests(
    req.params.channelId as string,
    req.user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Waiting room requests retrieved",
    data: result,
  });
});

const respondToWaitingRoomRequest = catchAsync(async (req, res) => {
  const result = await channelService.respondToWaitingRoomRequest(
    req.params.channelId as string,
    req.user.id,
    req.params.requestId as string,
    req.body.accept,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: req.body.accept ? "Request accepted" : "Request rejected",
    data: result,
  });
});

const banParticipant = catchAsync(async (req, res) => {
  const result = await channelService.banParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Participant banned",
    data: result,
  });
});

const deleteChannel = catchAsync(async (req, res) => {
  const result = await channelService.deleteChannel(
    req.params.channelId as string,
    req.user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Channel deleted",
    data: result,
  });
});

export const channelController = {
  createChannel,
  getPublicChannels,
  joinChannel,
  listWaitingRoomRequests,
  respondToWaitingRoomRequest,
  banParticipant,
  deleteChannel,
};
