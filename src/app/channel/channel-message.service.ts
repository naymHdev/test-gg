import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import { emitToChannel } from "../../socket/socket";

type TSendMessagePayload = {
  content?: string;
  imageUrl?: string;
  fileUrl?: string;
  mentionIds?: string[];
  replyToId?: string;
};

const assertChannelAccess = async (channelId: string, userId: string) => {
  const channel = await prisma.voiceChannel.findFirst({
    where: { id: channelId, deletedAt: null },
  });
  if (!channel) throw new AppError(httpStatus.NOT_FOUND, "Channel not found");

  const isBanned = await prisma.voiceChannelBan.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (isBanned) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are banned from this channel",
    );
  }

  return channel;
};

const sendMessage = async (
  channelId: string,
  senderId: string,
  payload: TSendMessagePayload,
) => {
  await assertChannelAccess(channelId, senderId);

  if (payload.replyToId) {
    const parent = await prisma.channelMessage.findFirst({
      where: { id: payload.replyToId, channelId, deletedAt: null },
    });
    if (!parent) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "The message you're replying to doesn't exist",
      );
    }
  }

  const message = await prisma.channelMessage.create({
    data: {
      channelId,
      senderId,
      content: payload.content,
      imageUrl: payload.imageUrl,
      fileUrl: payload.fileUrl,
      mentionIds: payload.mentionIds ?? [],
      replyToId: payload.replyToId,
    },
    include: {
      sender: { select: { id: true, username: true } },
      replyTo: {
        select: { id: true, content: true, senderId: true },
      },
    },
  });

  // chat is live inside the voice call — broadcast to everyone already
  // sitting in the channel:{id} socket room
  emitToChannel(channelId, "chat:new_message", message);

  return message;
};

const editMessage = async (
  channelId: string,
  messageId: string,
  senderId: string,
  content: string,
) => {
  const message = await prisma.channelMessage.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
  });
  if (!message) throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  if (message.senderId !== senderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only edit your own messages",
    );
  }

  const updated = await prisma.channelMessage.update({
    where: { id: messageId },
    data: { content, isEdited: true },
  });

  emitToChannel(channelId, "chat:message_edited", updated);

  return updated;
};

const deleteMessage = async (
  channelId: string,
  messageId: string,
  requesterId: string,
) => {
  const message = await prisma.channelMessage.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
  });
  if (!message) throw new AppError(httpStatus.NOT_FOUND, "Message not found");

  const channel = await prisma.voiceChannel.findFirst({
    where: { id: channelId },
  });
  const isSender = message.senderId === requesterId;
  const isOwner = channel?.ownerId === requesterId;

  if (!isSender && !isOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the sender or the channel owner can delete this message",
    );
  }

  const deleted = await prisma.channelMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  emitToChannel(channelId, "chat:message_deleted", { channelId, messageId });

  return deleted;
};

const listMessages = async (
  channelId: string,
  userId: string,
  cursor?: string,
  limit = 30,
) => {
  await assertChannelAccess(channelId, userId);

  const messages = await prisma.channelMessage.findMany({
    where: { channelId, deletedAt: null },
    include: {
      sender: { select: { id: true, username: true } },
      replyTo: { select: { id: true, content: true, senderId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
  });

  return messages.reverse(); // oldest → newest for chat UI rendering
};

export const channelMessageService = {
  sendMessage,
  editMessage,
  deleteMessage,
  listMessages,
};
