import { Router } from "express";
import { channelController } from "./channel.controller";
import { channelValidation } from "./channel.validation";
import { Role } from "../../../generated/prisma/client";
import auth from "../middleware/auth";
import validateRequest from "../middleware/validateRequest";

const router = Router();

router.get("/", channelController.getPublicChannels);

router.post(
  "/",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(channelValidation.createChannelValidation),
  channelController.createChannel,
);

router.get(
  "/mine",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.getMyChannel,
);

router.get(
  "/invite/:inviteCode",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.getChannelByInviteCode,
);

router.post(
  "/:channelId/join",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.joinChannel,
);

router.get(
  "/:channelId/waiting-room",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.listWaitingRoomRequests,
);

router.patch(
  "/:channelId/waiting-room/:requestId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(channelValidation.waitingRoomDecisionValidation),
  channelController.respondToWaitingRoomRequest,
);

router.post(
  "/:channelId/ban/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.banParticipant,
);

router.delete(
  "/:channelId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.deleteChannel,
);

router.post(
  "/:channelId/kick/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.kickParticipant,
);

router.post(
  "/:channelId/mute/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.muteParticipant,
);

router.post(
  "/:channelId/unmute/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.unmuteParticipant,
);

router.post(
  "/:channelId/deafen/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.deafenParticipant,
);

router.post(
  "/:channelId/undeafen/:userId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.unDeafenParticipant,
);

router.patch(
  "/:channelId/transfer-ownership",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(channelValidation.transferOwnershipValidation),
  channelController.transferOwnership,
);

// -------------------- CHAT --------------------
router.get(
  "/:channelId/messages",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.listMessages,
);

router.post(
  "/:channelId/messages",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(channelValidation.sendChannelMessageValidation),
  channelController.sendMessage,
);

router.patch(
  "/:channelId/messages/:messageId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(channelValidation.editChannelMessageValidation),
  channelController.editMessage,
);

router.delete(
  "/:channelId/messages/:messageId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  channelController.deleteMessage,
);

export const channelRoutes = router;
