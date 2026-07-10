import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import {
  SupportConversationStatus,
  SupportSenderType,
} from "../../../../generated/prisma/client";
import { OpenConversationInput, SendMessageInput } from "./support.validation";

// ─── Conversation lifecycle ─────────────────────────────────────────────────

const openConversationIntoDB = async (
  userId: string,
  payload: OpenConversationInput,
) => {
  return prisma.$transaction(async (tx) => {
    const existingOpenConversation = await tx.supportConversation.findFirst({
      where: { userId, status: SupportConversationStatus.Open },
    });

    if (existingOpenConversation) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You already have an open support conversation",
      );
    }

    return tx.supportConversation.create({
      data: {
        userId,
        status: SupportConversationStatus.Open,
        messages: {
          create: {
            senderId: userId,
            senderType: SupportSenderType.User,
            content: payload.content,
          },
        },
      },
      include: { messages: true },
    });
  });
};

const closeConversationInDB = async (
  conversationId: string,
  closedById: string,
) => {
  const conversation = await prisma.supportConversation.findUniqueOrThrow({
    where: { id: conversationId },
  });

  if (conversation.status === SupportConversationStatus.Closed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This conversation is already closed",
    );
  }

  return prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: SupportConversationStatus.Closed,
      closedById,
      closedAt: new Date(),
    },
  });
};

// ─── Messaging ───────────────────────────────────────────────────────────────

const sendMessageIntoDB = async (
  conversationId: string,
  requester: { id: string; role: string },
  hasViewSupportPermission: boolean,
  payload: SendMessageInput,
) => {
  const conversation = await prisma.supportConversation.findUniqueOrThrow({
    where: { id: conversationId },
  });

  const isOwner = conversation.userId === requester.id;
  const isStaff = requester.role !== "User";

  if (!isOwner && !(isStaff && hasViewSupportPermission)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this conversation",
    );
  }

  if (conversation.status === SupportConversationStatus.Closed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot send a message in a closed conversation",
    );
  }

  return prisma.supportMessage.create({
    data: {
      conversationId,
      senderId: requester.id,
      senderType: isOwner ? SupportSenderType.User : SupportSenderType.Support,
      content: payload.content,
    },
  });
};

// ─── Listing ─────────────────────────────────────────────────────────────────

const getMyConversationsFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const queryBuilder = new QueryBuilder({ ...query, userId })
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const conversations = await prisma.supportConversation.findMany({
    ...options,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.supportConversation);
  return { conversations, meta };
};

const getConversationsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query).filter().sort().paginate();

  const options = queryBuilder.build();

  const conversations = await prisma.supportConversation.findMany({
    ...options,
    include: {
      user: { select: { id: true, username: true } },
      closedBy: { select: { id: true, username: true } },
      _count: { select: { messages: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.supportConversation);
  return { conversations, meta };
};

const getConversationByIdFromDB = async (
  conversationId: string,
  requester: { id: string; role: string },
  hasViewSupportPermission: boolean,
) => {
  const conversation = await prisma.supportConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      user: { select: { id: true, username: true } },
      closedBy: { select: { id: true, username: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  const isOwner = conversation.userId === requester.id;
  const isStaff = requester.role !== "User";

  if (!isOwner && !(isStaff && hasViewSupportPermission)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this conversation",
    );
  }

  return conversation;
};

export const supportService = {
  openConversationIntoDB,
  closeConversationInDB,
  sendMessageIntoDB,
  getMyConversationsFromDB,
  getConversationsFromDB,
  getConversationByIdFromDB,
};
