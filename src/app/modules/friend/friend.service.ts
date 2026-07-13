import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import {
  FriendStatus,
  NotificationType,
} from "../../../../generated/prisma/client";
import { SendFriendRequestInput } from "./friend.validation";
import { notificationHelper } from "../notification/notification.helper";
import { userCard } from "../../helpers/select";

const findFriendRowBetween = (userAId: string, userBId: string) =>
  prisma.friend.findFirst({
    where: {
      OR: [
        { initiatorId: userAId, targetId: userBId },
        { initiatorId: userBId, targetId: userAId },
      ],
    },
  });

// Reused by message.service.ts before every send — a Blocked row in either
// direction shuts down both new friend requests and new messages.
export const assertCanInteract = async (userAId: string, userBId: string) => {
  const existing = await findFriendRowBetween(userAId, userBId);
  if (existing?.status === FriendStatus.Blocked) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot interact with this user",
    );
  }
};

// ─── Request / Accept / Decline ─────────────────────────────────────────────

const sendFriendRequestIntoDB = async (
  initiatorId: string,
  payload: SendFriendRequestInput,
) => {
  const { targetId } = payload;

  if (targetId === initiatorId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot friend yourself");
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const existing = await findFriendRowBetween(initiatorId, targetId);

  if (existing) {
    if (existing.status === FriendStatus.Blocked) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You cannot send a friend request to this user",
      );
    }
    if (existing.status === FriendStatus.Accepted) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You are already friends with this user",
      );
    }
    throw new AppError(
      httpStatus.CONFLICT,
      "A friend request is already pending between you two",
    );
  }

  const friendRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.friend.create({
      data: { initiatorId, targetId, status: FriendStatus.Pending },
    });

    await notificationHelper.createNotification(tx, {
      userId: targetId,
      type: NotificationType.friend_request,
      title: "New friend request",
      body: "You have a new friend request.",
      data: { friendId: created.id, fromUserId: initiatorId },
    });

    return created;
  });

  notificationHelper.queuePush(targetId, {
    title: "New friend request",
    body: "You have a new friend request.",
  });

  // TODO: socket.io not installed yet — emit "friend_request:received" to
  // targetId's socket room here once socket is wired up.

  return friendRequest;
};

const acceptFriendRequestInDB = async (
  userId: string,
  friendRequestId: string,
) => {
  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.friend.findUniqueOrThrow({
      where: { id: friendRequestId },
    });

    if (request.targetId !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "This friend request is not addressed to you",
      );
    }
    if (request.status !== FriendStatus.Pending) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `This request is already ${request.status.toLowerCase()}`,
      );
    }

    const accepted = await tx.friend.update({
      where: { id: friendRequestId },
      data: { status: FriendStatus.Accepted },
    });

    // Bidirectional — mirror the reverse row in the same transaction so both
    // users show up as friends to each other, not just the original direction.
    await tx.friend.upsert({
      where: {
        initiatorId_targetId: {
          initiatorId: request.targetId,
          targetId: request.initiatorId,
        },
      },
      create: {
        initiatorId: request.targetId,
        targetId: request.initiatorId,
        status: FriendStatus.Accepted,
      },
      update: { status: FriendStatus.Accepted },
    });

    await notificationHelper.createNotification(tx, {
      userId: request.initiatorId,
      type: NotificationType.friend_accepted,
      title: "Friend request accepted",
      body: "Your friend request was accepted.",
      data: { friendId: accepted.id, byUserId: userId },
    });

    return accepted;
  });

  notificationHelper.queuePush(updated.initiatorId, {
    title: "Friend request accepted",
    body: "Your friend request was accepted.",
  });

  // TODO: socket.io not installed yet — emit "friend_request:accepted" to
  // updated.initiatorId's socket room here once socket is wired up.

  return updated;
};

const declineFriendRequestInDB = async (
  userId: string,
  friendRequestId: string,
) => {
console.log({ friendRequestId });
  const request = await prisma.friend.findUniqueOrThrow({
    where: { id: friendRequestId },
  });

  if (request.targetId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This friend request is not addressed to you",
    );
  }
  if (request.status !== FriendStatus.Pending) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only a pending request can be declined",
    );
  }

  // Decline is a hard delete of the pending row only — an Accepted or
  // Blocked row never reaches this branch, so nothing else is ever wiped.
  return prisma.friend.delete({ where: { id: friendRequestId } });
};

// ─── Block ───────────────────────────────────────────────────────────────────

const blockUserInDB = async (userId: string, targetUserId: string) => {
  if (targetUserId === userId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot block yourself");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!target) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const existing = await findFriendRowBetween(userId, targetUserId);

  if (existing) {
    // Normalize direction so the blocker is always the row's initiator.
    if (existing.initiatorId === userId) {
      return prisma.friend.update({
        where: { id: existing.id },
        data: { status: FriendStatus.Blocked },
      });
    }
    return prisma.$transaction(async (tx) => {
      await tx.friend.delete({ where: { id: existing.id } });
      return tx.friend.create({
        data: {
          initiatorId: userId,
          targetId: targetUserId,
          status: FriendStatus.Blocked,
        },
      });
    });
  }

  return prisma.friend.create({
    data: {
      initiatorId: userId,
      targetId: targetUserId,
      status: FriendStatus.Blocked,
    },
  });
};

// ─── Listing ─────────────────────────────────────────────────────────────────

// Requests sent TO me, still pending — the ones I can accept/decline.
const getIncomingFriendRequestsFromDB = (userId: string) =>
  prisma.friend.findMany({
    where: { targetId: userId, status: FriendStatus.Pending },
    include: { initiator: { select: userCard } },
    orderBy: { createdAt: "desc" },
  });

// Requests I sent, still pending — waiting on the other person.
const getSentFriendRequestsFromDB = (userId: string) =>
  prisma.friend.findMany({
    where: { initiatorId: userId, status: FriendStatus.Pending },
    include: { target: { select: userCard } },
    orderBy: { createdAt: "desc" },
  });

// Accepted friends. Accept mirrors the row for both directions (see
// acceptFriendRequestInDB), so "I'm the initiator on an Accepted row" alone
// already covers every friend regardless of who sent the original request.
const getMyFriendsFromDB = (userId: string) =>
  prisma.friend.findMany({
    where: { initiatorId: userId, status: FriendStatus.Accepted },
    include: { target: { select: userCard } },
    orderBy: { updatedAt: "desc" },
  });

export const friendService = {
  sendFriendRequestIntoDB,
  acceptFriendRequestInDB,
  declineFriendRequestInDB,
  blockUserInDB,
  getIncomingFriendRequestsFromDB,
  getSentFriendRequestsFromDB,
  getMyFriendsFromDB,
};
