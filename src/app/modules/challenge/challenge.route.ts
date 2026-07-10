import { Router } from "express";
import { challengeController } from "./challenge.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";
import { updateChallengeProgressValidation } from "./challenge.validation";

const router = Router();

// ─── Public browsing ─────────────────────────────────────────────────────────

router.get("/", optionalAuth, challengeController.getChallenges);
router.get("/:id", optionalAuth, challengeController.getChallengeById);

// ─── Enrollment & self-reported progress ────────────────────────────────────

router.post(
  "/:id/enroll",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  challengeController.enrollInChallenge,
);

router.patch(
  "/:id/progress",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(updateChallengeProgressValidation),
  challengeController.updateChallengeProgress,
);

export const challengeRoute = router;
