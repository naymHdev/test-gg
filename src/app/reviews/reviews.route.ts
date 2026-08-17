import { Router } from "express";
import auth from "../middleware/auth";
import { Role } from "../../../generated/prisma/client";
import { reviewsController } from "./reviews.controller";
import validateRequest from "../middleware/validateRequest";
import { createPlayerReviewValidation } from "./reviews.validation";

const router = Router();

router.get(
  "/:id/player-reviews",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  reviewsController.findPlayerReviews,
);

router.patch(
  "/:id/submit-review",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createPlayerReviewValidation),
  reviewsController.createPlayerReview,
);

export const reviewsRoutes = router;
