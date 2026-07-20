import httpStatus from "http-status";
import { nanoid } from "nanoid";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import {
  generateStreamUserToken,
  streamClient,
  upsertStreamUser,
} from "../../lib/getstream/client";

const STREAM_CALL_TYPE = "audio_room";

type TCreateChannelPayload = {
  name: string;
  description?: string;
  visibility: "Public" | "Private";
  maxParticipants: number;
  waitingRoomEnabled: boolean;
};

// -------------------- CREATE --------------------
const createChannel = async (
  ownerId: string,
  ownerUsername: string,
  payload: TCreateChannelPayload,
) => {
  const existingActiveChannel = await prisma.voiceChannel.findFirst({
    where: { ownerId, deletedAt: null },
  });
  if (existingActiveChannel) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already own an active voice channel. Delete it before creating a new one.",
    );
  }

  const streamCallId = nanoid(12);

  await upsertStreamUser({ id: ownerId, username: ownerUsername });

  const call = streamClient.video.call(STREAM_CALL_TYPE, streamCallId);
  await call.getOrCreate({
    data: {
      created_by_id: ownerId,
      members: [{ user_id: ownerId, role: "admin" }],
      custom: { name: payload.name, visibility: payload.visibility },
    },
  });

  const channel = await prisma.voiceChannel.create({
    data: {
      name: payload.name,
      description: payload.description,
      visibility: payload.visibility,
      maxParticipants: payload.maxParticipants,
      waitingRoomEnabled: payload.waitingRoomEnabled,
      ownerId,
      streamCallId,
      streamCallType: STREAM_CALL_TYPE,
    },
  });

  const token = generateStreamUserToken(ownerId);

  return { channel, streamToken: token, streamCallType: STREAM_CALL_TYPE };
};

// -------------------- JOIN --------------------
const joinChannel = async (
  channelId: string,
  userId: string,
  username: string,
) => {
  const channel = await prisma.voiceChannel.findFirst({
    where: { id: channelId, deletedAt: null },
  });
  if (!channel) throw new AppError(httpStatus.NOT_FOUND, "Channel not found");

  if (channel.isLocked && channel.ownerId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "This channel is locked");
  }

  const isBanned = await prisma.voiceChannelBan.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (isBanned) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are banned from this channel",
    );
  }

  const isOwner = channel.ownerId === userId;

  if (channel.waitingRoomEnabled && !isOwner) {
    const existingRequest = await prisma.waitingRoomRequest.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    if (!existingRequest) {
      const request = await prisma.waitingRoomRequest.create({
        data: { channelId, userId },
      });
      return { status: "waiting_room" as const, request };
    }

    if (existingRequest.status === "Pending") {
      return { status: "waiting_room" as const, request: existingRequest };
    }

    if (existingRequest.status === "Rejected") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your request to join was rejected by the owner",
      );
    }
    // status === "Accepted" → fall through and issue a token
  }

  await upsertStreamUser({ id: userId, username });

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.updateCallMembers({
    update_members: [{ user_id: userId, role: "user" }],
  });

  const token = generateStreamUserToken(userId);

  return {
    status: "joined" as const,
    channel,
    streamToken: token,
    streamCallType: STREAM_CALL_TYPE,
  };
};

// -------------------- WAITING ROOM --------------------
const listWaitingRoomRequests = async (channelId: string, ownerId: string) => {
  await assertOwner(channelId, ownerId);
  return prisma.waitingRoomRequest.findMany({
    where: { channelId, status: "Pending" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });
};

const respondToWaitingRoomRequest = async (
  channelId: string,
  ownerId: string,
  requestId: string,
  accept: boolean,
) => {
  const channel = await assertOwner(channelId, ownerId);

  const request = await prisma.waitingRoomRequest.findFirst({
    where: { id: requestId, channelId },
  });
  if (!request) throw new AppError(httpStatus.NOT_FOUND, "Request not found");

  const updated = await prisma.waitingRoomRequest.update({
    where: { id: requestId },
    data: { status: accept ? "Accepted" : "Rejected" },
  });

  if (accept) {
    const call = streamClient.video.call(
      STREAM_CALL_TYPE,
      channel.streamCallId,
    );
    await call.updateCallMembers({
      update_members: [{ user_id: request.userId, role: "user" }],
    });
  }

  return updated;
};

// -------------------- OWNER ACTIONS --------------------
const banParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  const channel = await assertOwner(channelId, ownerId);
  if (targetUserId === ownerId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Owner cannot ban themselves");
  }

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.updateCallMembers({ remove_members: [targetUserId] });

  return prisma.voiceChannelBan.upsert({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    update: {},
    create: { channelId, userId: targetUserId },
  });
};

// -------------------- LEAVE / DELETE --------------------
const deleteChannel = async (channelId: string, ownerId: string) => {
  const channel = await assertOwner(channelId, ownerId);

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.end();

  return prisma.voiceChannel.update({
    where: { id: channelId },
    data: { deletedAt: new Date() },
  });
};

// -------------------- helpers --------------------
const assertOwner = async (channelId: string, ownerId: string) => {
  const channel = await prisma.voiceChannel.findFirst({
    where: { id: channelId, deletedAt: null },
  });
  if (!channel) throw new AppError(httpStatus.NOT_FOUND, "Channel not found");
  if (channel.ownerId !== ownerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the channel owner can do this",
    );
  }
  return channel;
};

const getPublicChannels = async () => {
  return prisma.voiceChannel.findMany({
    where: { visibility: "Public", deletedAt: null, isLocked: false },
    include: { owner: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const channelService = {
  createChannel,
  joinChannel,
  listWaitingRoomRequests,
  respondToWaitingRoomRequest,
  banParticipant,
  deleteChannel,
  getPublicChannels,
};
