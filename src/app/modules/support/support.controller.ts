import httpStatus from "http-status";
import { Request } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { supportService } from "./support.service";
import { Permission } from "../../../../generated/prisma/enums";
import { prisma } from "../../../shared/prisma";
import { uploadToS3 } from "../../utils/s3";

const getSupportMessagePayload = async (req: Request) => {
  const content = req.body.content?.trim();
  const file = req.file;

  if (!content && !file) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Message text or an image is required",
    );
  }

  const imageUrl = file
    ? await uploadToS3({
        file,
        fileName: `support/${req.user.id}-${Date.now()}-${file.originalname}`,
      })
    : undefined;

  return { content, imageUrl: imageUrl ?? undefined };
};

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const hasViewSupportAccess = async (user: { role: string; id: string }) => {
  if (user.role === "Owner") return true;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  return grantedPermissions.some(
    (p) => p.permission === Permission.view_support,
  );
};

const openConversation = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const payload = await getSupportMessagePayload(req);
  const result = await supportService.openConversationIntoDB(
    userId as string,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Support conversation opened successfully",
    data: result,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const { id: userId, role } = req.user;
  const hasPermission = await hasViewSupportAccess(req.user);
  const requester = { id: userId as string, role };

  await supportService.assertCanSendMessage(
    req.params.id as string,
    requester,
    hasPermission,
  );
  const payload = await getSupportMessagePayload(req);

  const result = await supportService.sendMessageIntoDB(
    req.params.id as string,
    requester,
    hasPermission,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const getMyConversations = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { conversations, meta } = await supportService.getMyConversationsFromDB(
    userId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversations retrieved successfully",
    meta,
    data: conversations,
  });
});

const getConversations = catchAsync(async (req, res) => {
  const { conversations, meta } = await supportService.getConversationsFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversations retrieved successfully",
    meta,
    data: conversations,
  });
});

const getConversationById = catchAsync(async (req, res) => {
  const { id: userId, role } = req.user;
  const hasPermission = await hasViewSupportAccess(req.user);

  const result = await supportService.getConversationByIdFromDB(
    req.params.id as string,
    { id: userId as string, role },
    hasPermission,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation retrieved successfully",
    data: result,
  });
});

const closeConversation = catchAsync(async (req, res) => {
  const closedById = req.user.id;
  const result = await supportService.closeConversationInDB(
    req.params.id as string,
    closedById as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation closed successfully",
    data: result,
  });
});

export const supportController = {
  openConversation,
  sendMessage,
  getMyConversations,
  getConversations,
  getConversationById,
  closeConversation,
};
