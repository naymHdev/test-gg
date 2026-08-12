import { Router } from "express";
import { supportController } from "./support.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import {
  openConversationValidation,
  sendMessageValidation,
} from "./support.validation";
import { uploadFactory } from "../../helpers/uploadFactory";
import parseData from "../../middleware/parseData";

const router = Router();

// ─── User conversations ─────────────────────────────────────────────────────

router.post(
  "/",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  uploadFactory({ type: "image", maxFiles: 1 }).single("image"),
  parseData(),
  validateRequest(openConversationValidation),
  supportController.openConversation,
);

router.get(
  "/me",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  supportController.getMyConversations,
);

router.post(
  "/:id/messages",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  uploadFactory({ type: "image", maxFiles: 1 }).single("image"),
  parseData(),
  validateRequest(sendMessageValidation),
  supportController.sendMessage,
);

router.get(
  "/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  supportController.getConversationById,
);

export const supportRouter = router;
