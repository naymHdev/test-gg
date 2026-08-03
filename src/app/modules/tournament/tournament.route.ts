import { Router } from "express";
import { tournamentController } from "./tournament.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import optionalAuth from "../../middleware/optionalAuth";
import { Role } from "../../../../generated/prisma/enums";
import {
  createTournamentValidation,
  createTeamValidation,
} from "./tournament.validation";
import { uploadMulterDisk } from "../../utils/s3";
import parseData from "../../middleware/parseData";

const router = Router();

// ─── Public browsing ─────────────────────────────────────────────────────────

router.get("/", optionalAuth, tournamentController.getTournaments);
router.get("/:id", optionalAuth, tournamentController.getTournamentById);

// ─── Tournament creation & team registration ────────────────────────────────

router.post(
  "/",
  uploadMulterDisk.fields([
    { name: "logo", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  parseData(),
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createTournamentValidation),
  tournamentController.createTournament,
);

router.post(
  "/:id/teams",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createTeamValidation),
  tournamentController.registerTeam,
);

export const tournamentRoute = router;
