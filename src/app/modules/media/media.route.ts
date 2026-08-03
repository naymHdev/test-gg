import { Router } from "express";
import { uploadFactory } from "../../helpers/uploadFactory";
import parseData from "../../middleware/parseData";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/client";
import { rateLimiter } from "../../middleware/rateLimiter";
import validateRequest from "../../middleware/validateRequest";
import { mediaController } from "./media.controller";
import {
  createMediaCommentValidation,
  createMediaPostValidation,
  reactToMediaValidation,
  updateMediaCommentValidation,
  updateMediaPostValidation,
} from "./media.validation";
import { uploadMulterDisk } from "../../utils/s3";

const router = Router();

// ---------- Post ----------
router.get("/", mediaController.getAllMedia);
router.get("/:id", mediaController.getSingleMedia);

router.post(
  "/",
  uploadMulterDisk.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 10 },
  ]),
  parseData(),
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  rateLimiter.createPost,
  validateRequest(createMediaPostValidation),
  mediaController.createMedia,
);

router.patch(
  "/:id",
  uploadMulterDisk.fields([{ name: "images", maxCount: 10 }]),
  parseData(),
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(updateMediaPostValidation),
  mediaController.updateMedia,
);

router.delete(
  "/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  mediaController.deleteMedia,
);

// ---------- Reactions (like) ----------
router.post(
  "/:postId/reactions",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(reactToMediaValidation),
  mediaController.reactToPost,
);

router.get("/:postId/reactions/summary", mediaController.getReactionSummary);

// ---------- Comments ----------
router.post(
  "/:postId/comments",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createMediaCommentValidation),
  mediaController.createComment,
);

router.get("/:postId/comments", mediaController.getComments);

router.get("/comments/:commentId/replies", mediaController.getReplies);

router.patch(
  "/comments/:commentId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(updateMediaCommentValidation),
  mediaController.updateComment,
);

router.delete(
  "/comments/:commentId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  mediaController.deleteComment,
);

export const mediaRouter = router;
