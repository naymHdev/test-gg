import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { messageService } from "./message.service";

const getConversation = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { userId: otherUserId } = req.params;
  const { messages, meta } = await messageService.getConversationFromDB(
    userId,
    otherUserId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages retrieved successfully",
    meta,
    data: messages,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const senderId = req.user.id as string;
  const result = await messageService.sendMessageIntoDB(senderId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const markMessagesAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { senderId } = req.body;
  await messageService.markMessagesAsReadInDB(userId, senderId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages marked as read",
    data: null,
  });
});

export const messageController = {
  getConversation,
  sendMessage,
  markMessagesAsRead,
};
