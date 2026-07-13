import { Router } from "express";
import { friendController } from "./friend.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/client";
import { sendFriendRequestValidation } from "./friend.validation";

const router = Router();
const anyAuthedUser = [
  Role.User,
  Role.Moderator,
  Role.Admin,
  Role.Owner,
] as const;

router.post(
  "/request",
  auth(...anyAuthedUser),
  validateRequest(sendFriendRequestValidation),
  friendController.sendFriendRequest,
);

router.get(
  "/requests",
  auth(...anyAuthedUser),
  friendController.getIncomingFriendRequests,
);

router.get(
  "/requests/sent",
  auth(...anyAuthedUser),
  friendController.getSentFriendRequests,
);

router.get("/", auth(...anyAuthedUser), friendController.getMyFriends);

router.put(
  "/:id/accept",
  auth(...anyAuthedUser),
  friendController.acceptFriendRequest,
);

router.delete(
  "/:id",
  auth(...anyAuthedUser),
  friendController.declineFriendRequest,
);

router.put(
  "/:userId/block",
  auth(...anyAuthedUser),
  friendController.blockUser,
);

export const friendRouter = router;
