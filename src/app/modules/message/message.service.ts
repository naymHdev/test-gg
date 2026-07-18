import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { NotificationType } from "../../../../generated/prisma/client";
import { SendMessageInput } from "./message.validation";
import { notificationHelper } from "../notification/notification.helper";
import { assertCanInteract } from "../friend/friend.service";
import { emitToUser } from "../../../socket/socket";

// ─── Conversation ────────────────────────────────────────────────────────────

const getConversationFromDB = async (
  userId: string,
  otherUserId: string,
  query: Record<string, unknown>,
) => {
  // Only sort()/paginate() are used here (not filter()) — the two-user pair
  // filter below must stay authoritative and never be overridable by
  // arbitrary query params.
  const queryBuilder = new QueryBuilder(query).sort().paginate();
  const { skip, take } = queryBuilder.build();

  const where = {
    OR: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const total = await prisma.message.count({ where });

  return {
    messages,
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
  };
};

// ─── Send ────────────────────────────────────────────────────────────────────

const sendMessageIntoDB = async (
  senderId: string,
  payload: SendMessageInput,
) => {
  const { receiverId, content } = payload;

  if (receiverId === senderId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot message yourself");
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
  });
  if (!receiver) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  await assertCanInteract(senderId, receiverId);

  const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { senderId, receiverId, content },
    });

    await notificationHelper.createNotification(tx, {
      userId: receiverId,
      type: NotificationType.message_new,
      title: "New message",
      body: preview,
      data: { messageId: created.id, fromUserId: senderId },
    });

    return created;
  });

  notificationHelper.queuePush(receiverId, {
    title: "New message",
    body: preview,
  });

  // If socket.io not installed yet — emit "message:new" to receiverId's
  emitToUser(receiverId, "message:new", message);

  return message;
};

// ─── Read receipts ───────────────────────────────────────────────────────────

const markMessagesAsReadInDB = async (userId: string, senderId: string) =>
  prisma.message.updateMany({
    where: { senderId, receiverId: userId, read: false },
    data: { read: true },
  });

export const messageService = {
  getConversationFromDB,
  sendMessageIntoDB,
  markMessagesAsReadInDB,
};
