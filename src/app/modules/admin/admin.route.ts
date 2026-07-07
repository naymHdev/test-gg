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

const router = Router();

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

// ─── Moderation (manage_tournaments) ────────────────────────────────────────

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

export const adminRoutes = router;
