import { Router } from "express";
import { walletController } from "./wallet.controller";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { walletValidation } from "./wallet.validation";
import { Role } from "../../../../generated/prisma/client";

const router = Router();

router.get(
  "/",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  walletController.myWallet,
);
router.get(
  "/transactions",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  walletController.myTransactions,
);

router.post(
  "/deposit/stripe/checkout",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  validateRequest(walletValidation.depositValidation),
  walletController.depositCheckout,
);

router.post(
  "/deposit/paypal/create",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  validateRequest(walletValidation.depositValidation),
  walletController.paypalDepositCreate,
);
router.post(
  "/deposit/paypal/capture",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  validateRequest(walletValidation.paypalCaptureValidation),
  walletController.paypalDepositCapture,
);

router.post(
  "/withdrawals",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  validateRequest(walletValidation.withdrawalRequestValidation),
  walletController.requestWithdrawal,
);
router.get(
  "/withdrawals",
  auth(Role.User, Role.Admin, Role.Owner, Role.Moderator),
  walletController.myWithdrawals,
);

export const walletRouter = router;
