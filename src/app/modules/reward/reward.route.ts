import { Router } from "express";
import { rewardController } from "./reward.controller";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

// ─── Public browsing ─────────────────────────────────────────────────────────

router.get("/", optionalAuth, rewardController.getRewards);
router.get("/:id", optionalAuth, rewardController.getRewardById);

// ─── Purchase (spends points) ───────────────────────────────────────────────

router.post(
  "/:id/purchase",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  rewardController.purchaseReward,
);

export const rewardRoute = router;
