import httpStatus from "http-status";
import { channelService } from "./channel.service";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/sendResponse";
import { channelMessageService } from "./channel-message.service";

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

const getMyChannel = catchAsync(async (req, res) => {
  const result = await channelService.getMyChannel(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your channel retrieved",
    data: result,
  });
});

const getChannelByInviteCode = catchAsync(async (req, res) => {
  const result = await channelService.getChannelByInviteCode(
    req.params.inviteCode as string,
    req.user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Channel retrieved",
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

const kickParticipant = catchAsync(async (req, res) => {
  const result = await channelService.kickParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Participant kicked",
    data: result,
  });
});

const muteParticipant = catchAsync(async (req, res) => {
  const result = await channelService.muteParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Participant muted",
    data: result,
  });
});

const unmuteParticipant = catchAsync(async (req, res) => {
  const result = await channelService.unmuteParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Participant unmuted",
    data: result,
  });
});

const deafenParticipant = catchAsync(async (req, res) => {
  const result = await channelService.deafenParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Deafen requested (advisory — client must honor it)",
    data: result,
  });
});

const unDeafenParticipant = catchAsync(async (req, res) => {
  const result = await channelService.unDeafenParticipant(
    req.params.channelId as string,
    req.user.id,
    req.params.userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Undeafen requested",
    data: result,
  });
});

const transferOwnership = catchAsync(async (req, res) => {
  const result = await channelService.transferOwnership(
    req.params.channelId as string,
    req.user.id,
    req.body.newOwnerId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ownership transferred",
    data: result,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const result = await channelMessageService.sendMessage(
    req.params.channelId as string,
    req.user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent",
    data: result,
  });
});

const editMessage = catchAsync(async (req, res) => {
  const result = await channelMessageService.editMessage(
    req.params.channelId as string,
    req.params.messageId as string,
    req.user.id,
    req.body.content,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message updated",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req, res) => {
  const result = await channelMessageService.deleteMessage(
    req.params.channelId as string,
    req.params.messageId as string,
    req.user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message deleted",
    data: result,
  });
});

const listMessages = catchAsync(async (req, res) => {
  const result = await channelMessageService.listMessages(
    req.params.channelId as string,
    req.user.id,
    req.query.cursor as string | undefined,
    req.query.limit ? Number(req.query.limit) : undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages retrieved",
    data: result,
  });
});

export const channelController = {
  createChannel,
  getMyChannel,
  getChannelByInviteCode,
  getPublicChannels,
  joinChannel,
  listWaitingRoomRequests,
  respondToWaitingRoomRequest,

  banParticipant,
  deleteChannel,
  kickParticipant,
  muteParticipant,
  unmuteParticipant,
  deafenParticipant,
  unDeafenParticipant,
  transferOwnership,

  sendMessage,
  editMessage,
  deleteMessage,
  listMessages,
};
