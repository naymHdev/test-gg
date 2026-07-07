import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postController } from "./post.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";
import { uploadFactory } from "../../helpers/uploadFactory";
import parseData from "../../middleware/parseData";
import { createPostValidation, updatePostValidation } from "./post.validation";
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

export const postRoutes = router;
