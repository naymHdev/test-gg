import { Router } from "express";
import { reportController } from "./report.controller";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { createReportValidation } from "./report.validation";

const router = Router();

router.post(
  "/",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createReportValidation),
  reportController.createReport,
);

export const reportRouter = router;
