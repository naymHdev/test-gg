import { Router } from "express";
import { subscriptionController } from "./subscription.controller";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { Role } from "../../../../generated/prisma/client";
import { createCheckoutValidation } from "./subscription.validation";

const router = Router();

router.get("/plans", subscriptionController.getActivePlans);

router.get("/success", subscriptionController.renderCheckoutSuccess);
router.get("/cancel", subscriptionController.renderCheckoutCancel);

router.post(
  "/create-checkout",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  validateRequest(createCheckoutValidation),
  subscriptionController.createCheckout,
);

router.post(
  "/cancel",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  subscriptionController.cancelMySubscription,
);

router.get(
  "/my-subscription",
  auth(Role.User, Role.Moderator, Role.Admin, Role.Owner),
  subscriptionController.getMySubscription,
);

export const subscriptionRouter = router;
