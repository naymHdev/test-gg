import { Router } from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { rateLimiter } from "../../middleware/rateLimiter";
import { Role } from "../../../../generated/prisma/client";
import { riotController } from "./riot.controller";
import { riotValidation } from "./riot.validation";

const router = Router();

router.post(
  "/link/start",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  rateLimiter.riotVerify,
  validateRequest(riotValidation.startLinkValidation),
  riotController.startLink,
);

router.get(
  "/link/pending",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  riotController.getPending,
);

router.post(
  "/link/verify",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  rateLimiter.riotVerify,
  riotController.verifyLink,
);

export const riotRoutes = router;
