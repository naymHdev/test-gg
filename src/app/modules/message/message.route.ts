import { Router } from "express";
import { messageController } from "./message.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/client";
import { rateLimiter } from "../../middleware/rateLimiter";
import {
  sendMessageValidation,
  markMessagesReadValidation,
} from "./message.validation";

const router = Router();
const anyAuthedUser = [
  Role.User,
  Role.Moderator,
  Role.Admin,
  Role.Owner,
] as const;

router.get(
  "/:userId",
  auth(...anyAuthedUser),
  messageController.getConversation,
);

router.post(
  "/",
  auth(...anyAuthedUser),
  rateLimiter.sendMessage,
  validateRequest(sendMessageValidation),
  messageController.sendMessage,
);

router.put(
  "/read",
  auth(...anyAuthedUser),
  validateRequest(markMessagesReadValidation),
  messageController.markMessagesAsRead,
);

export const messageRouter = router;
