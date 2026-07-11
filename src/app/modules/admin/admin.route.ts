import { Router } from "express";
import auth from "../../middleware/auth";
import { adminController } from "./admin.controller";
import { Role } from "../../../../generated/prisma/client";
import { tournamentController } from "../tournament/tournament.controller";
import validateRequest from "../../middleware/validateRequest";
import {
  createMatchValidation,
  declareMatchWinnerValidation,
} from "../tournament/tournament.validation";
import { createChallengeValidation } from "../challenge/challenge.validation";
import { challengeController } from "../challenge/challenge.controller";
import { createRewardValidation } from "../reward/reward.validation";
import { rewardController } from "../reward/reward.controller";
import { reportController } from "../report/report.controller";
import { supportController } from "../support/support.controller";
import { upsertLegalDocumentValidation } from "../legal/legal.validation";
import { legalController } from "../legal/legal.controller";
import {
  banUserValidation,
  timeoutUserValidation,
  warnUserValidation,
} from "./admin.validation";

const router = Router();

// ─── User management ────────────────────
router.get(
  "/users",
  auth(Role.Admin, Role.Owner, Role.Moderator),
  adminController.getAllUsers,
);

router.patch(
  "/users/:id/role",
  auth(Role.Admin, Role.Owner),
  adminController.updateRole,
);

router.patch(
  "/users/:id/permissions",
  auth(Role.Admin, Role.Owner),
  adminController.upsertPermissions,
);

// ─── Moderation (ban_users / warn_users / timeout_users / view_activity) ────
router.post(
  "/users/:id/ban",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(banUserValidation),
  adminController.banUser,
);

router.delete(
  "/users/:id/ban",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  adminController.unbanUser,
);

router.post(
  "/users/:id/warn",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(warnUserValidation),
  adminController.warnUser,
);

router.post(
  "/users/:id/timeout",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(timeoutUserValidation),
  adminController.timeoutUser,
);

router.get(
  "/activity-logs",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  adminController.getActivityLogs,
);

// ─── Moderation (manage_tournaments) ────────────────────────────────────────

// ─── Tournaments ────────────────────────────
router.put(
  "/tournaments/:id/approve",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  tournamentController.approveTournament,
);

router.put(
  "/tournaments/:id/open-registration",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  tournamentController.openRegistration,
);

router.put(
  "/tournaments/:id/reject",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  tournamentController.rejectTournament,
);

router.post(
  "/tournaments/:id/matches",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createMatchValidation),
  tournamentController.createMatch,
);

router.put(
  "/tournaments/matches/:matchId/winner",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(declareMatchWinnerValidation),
  tournamentController.declareMatchWinner,
);

// ─── Challenges ────────────────────────
router.post(
  "/challenge",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createChallengeValidation),
  challengeController.createChallenge,
);

router.patch(
  "/challenge/:id/toggle-active",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  challengeController.toggleChallengeActive,
);

// ─── Rewards ────────────────
router.post(
  "/reward",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createRewardValidation),
  rewardController.createReward,
);

router.patch(
  "/reward/:id/toggle-active",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  rewardController.toggleRewardActive,
);

// ─── Moderation (manage_reports) ────────────────────────────────────────────
router.get(
  "/reports",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  reportController.getReports,
);

router.get(
  "/report/:id",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  reportController.getReportById,
);

router.put(
  "/report/:id/resolve",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  reportController.resolveReport,
);

router.put(
  "/report/:id/dismiss",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  reportController.dismissReport,
);

// ─── Moderation (view_support) ──────────────────────────────────────────────

router.get(
  "/support",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  supportController.getConversations,
);

router.put(
  "/support/:id/close",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  supportController.closeConversation,
);

// ─── Legal documents (manage_settings) ──────────────────────────────────────
router.put(
  "/legal",
  auth(Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(upsertLegalDocumentValidation),
  legalController.upsertLegalDocument,
);

export const adminRoutes = router;
