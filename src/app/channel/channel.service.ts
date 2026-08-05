import httpStatus from "http-status";
import { nanoid } from "nanoid";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import {
  generateStreamUserToken,
  streamClient,
  upsertStreamUser,
} from "../../lib/getstream/client";
import { emitToChannel, emitToUser } from "../../socket/socket";

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
      settings_override: {
        backstage: { enabled: false },
      },
    },
  });

  let channel;
  try {
    channel = await prisma.voiceChannel.create({
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
  } catch (err) {
    await call.delete({ hard: true }).catch(() => {});
    throw err;
  }

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
      emitToUser(channel.ownerId, "waiting_room:new_request", {
        channelId,
        request,
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

  emitToUser(
    request.userId,
    accept ? "waiting_room:accepted" : "waiting_room:rejected",
    { channelId },
  );

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

  const banRecord = await prisma.voiceChannelBan.upsert({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    update: {},
    create: { channelId, userId: targetUserId },
  });

  emitToUser(targetUserId, "channel:banned", { channelId });
  emitToChannel(channelId, "channel:user_banned", {
    channelId,
    userId: targetUserId,
  });

  return banRecord;
};

const kickParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  const channel = await assertOwner(channelId, ownerId);
  if (targetUserId === ownerId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Owner cannot kick themselves");
  }

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.kickUser({ user_id: targetUserId });

  emitToUser(targetUserId, "channel:kicked", { channelId });
  emitToChannel(channelId, "channel:user_kicked", {
    channelId,
    userId: targetUserId,
  });

  return { channelId, kickedUserId: targetUserId };
};

const muteParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  const channel = await assertOwner(channelId, ownerId);
  if (targetUserId === ownerId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Owner cannot mute themselves");
  }

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);

  await call.muteUsers({ user_ids: [targetUserId], audio: true });
  await call.updateUserPermissions({
    user_id: targetUserId,
    revoke_permissions: ["send-audio"],
  });

  emitToUser(targetUserId, "channel:muted", { channelId });
  emitToChannel(channelId, "channel:user_muted", {
    channelId,
    userId: targetUserId,
  });

  return { channelId, mutedUserId: targetUserId };
};

const unmuteParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  const channel = await assertOwner(channelId, ownerId);

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.updateUserPermissions({
    user_id: targetUserId,
    grant_permissions: ["send-audio"],
  });

  emitToUser(targetUserId, "channel:unmuted", { channelId });
  emitToChannel(channelId, "channel:user_unmuted", {
    channelId,
    userId: targetUserId,
  });

  return { channelId, unmutedUserId: targetUserId };
};

const deafenParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  await assertOwner(channelId, ownerId);
  emitToUser(targetUserId, "channel:deafen_requested", { channelId });
  emitToChannel(channelId, "channel:user_deafened", {
    channelId,
    userId: targetUserId,
  });
  return { channelId, deafenedUserId: targetUserId, enforced: false };
};

const unDeafenParticipant = async (
  channelId: string,
  ownerId: string,
  targetUserId: string,
) => {
  await assertOwner(channelId, ownerId);
  emitToUser(targetUserId, "channel:undeafen_requested", { channelId });
  emitToChannel(channelId, "channel:user_undeafened", {
    channelId,
    userId: targetUserId,
  });
  return { channelId, undeafenedUserId: targetUserId, enforced: false };
};

const transferOwnership = async (
  channelId: string,
  currentOwnerId: string,
  newOwnerId: string,
) => {
  const channel = await assertOwner(channelId, currentOwnerId);
  if (newOwnerId === currentOwnerId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You already own this channel");
  }

  const isBanned = await prisma.voiceChannelBan.findUnique({
    where: { channelId_userId: { channelId, userId: newOwnerId } },
  });
  if (isBanned) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot transfer ownership to a banned user",
    );
  }

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.updateCallMembers({
    update_members: [
      { user_id: newOwnerId, role: "admin" },
      { user_id: currentOwnerId, role: "user" },
    ],
  });

  const updated = await prisma.voiceChannel.update({
    where: { id: channelId },
    data: { ownerId: newOwnerId },
  });

  emitToChannel(channelId, "channel:ownership_transferred", {
    channelId,
    previousOwnerId: currentOwnerId,
    newOwnerId,
  });

  return updated;
};

// -------------------- LEAVE / DELETE --------------------
const deleteChannel = async (channelId: string, ownerId: string) => {
  const channel = await assertOwner(channelId, ownerId);

  const call = streamClient.video.call(STREAM_CALL_TYPE, channel.streamCallId);
  await call.end();

  const updated = await prisma.voiceChannel.update({
    where: { id: channelId },
    data: { deletedAt: new Date() },
  });

  emitToChannel(channelId, "channel:deleted", { channelId });

  return updated;
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

// -------------------- PRIVATE CHANNEL ACCESS --------------------
const getMyChannel = async (ownerId: string) => {
  const channel = await prisma.voiceChannel.findFirst({
    where: { ownerId, deletedAt: null },
  });
  if (!channel) {
    throw new AppError(httpStatus.NOT_FOUND, "You don't own an active channel");
  }
  return channel;
};

const getChannelByInviteCode = async (inviteCode: string, userId: string) => {
  const channel = await prisma.voiceChannel.findFirst({
    where: { inviteCode, deletedAt: null },
  });
  if (!channel) throw new AppError(httpStatus.NOT_FOUND, "Invalid invite link");

  const isBanned = await prisma.voiceChannelBan.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
  });
  if (isBanned) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are banned from this channel",
    );
  }

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    visibility: channel.visibility,
    maxParticipants: channel.maxParticipants,
    isLocked: channel.isLocked,
    waitingRoomEnabled: channel.waitingRoomEnabled,
  };
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
  kickParticipant,
  muteParticipant,
  unmuteParticipant,
  deafenParticipant,
  unDeafenParticipant,
  transferOwnership,

  getPublicChannels,
  getMyChannel,
  getChannelByInviteCode,
};
