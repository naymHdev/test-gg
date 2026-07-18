import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postController } from "./post.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";
import { uploadFactory } from "../../helpers/uploadFactory";
import parseData from "../../middleware/parseData";
import {
  createPostCommentValidation,
  createPostValidation,
  reactToPostValidation,
  updatePostCommentValidation,
  updatePostValidation,
} from "./post.validation";
import { rateLimiter } from "../../middleware/rateLimiter";

const router = Router();

router.get("/", optionalAuth, postController.getPosts);

router.post(
  "/",
  uploadFactory({ type: "image", maxFiles: 10 }).fields([
    { name: "images", maxCount: 10 },
  ]),
  parseData(),
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  rateLimiter.createPost,
  validateRequest(createPostValidation),
  postController.createPost,
);

router.put(
  "/:id",
  uploadFactory({ type: "image", maxFiles: 10 }).fields([
    { name: "images", maxCount: 10 },
  ]),
  parseData(),
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(updatePostValidation),
  postController.updatePost,
);

router.delete(
  "/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  postController.deletePost,
);

// ---------- Reactions ----------
router.post(
  "/:postId/reactions",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(reactToPostValidation),
  postController.reactToPost,
);

router.get("/:postId/reactions/summary", postController.getReactionSummary);

// ---------- Comments ----------
router.post(
  "/:postId/comments",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createPostCommentValidation),
  postController.createComment,
);

router.get("/:postId/comments", postController.getComments);

router.get("/comments/:commentId/replies", postController.getReplies);

router.patch(
  "/comments/:commentId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(updatePostCommentValidation),
  postController.updateComment,
);

router.delete(
  "/comments/:commentId",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  postController.deleteComment,
);

export const postRoutes = router;
