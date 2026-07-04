import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postController } from "./post.controller";
import { postValidation } from "./post.validation";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

const createPostLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3 }); // 3/hour

// Public feed — optionalAuth so a Guest still gets results,
// while a logged-in user's role/premium status can later personalize ordering
router.get("/", optionalAuth, postController.getPosts);

router.post(
  "/",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  createPostLimiter,
  validateRequest(postValidation.createPostValidation),
  postController.createPost,
);

router.put(
  "/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(postValidation.updatePostValidation),
  postController.updatePost,
);

router.delete(
  "/:id",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  postController.deletePost,
);

export const postRoutes = router;
