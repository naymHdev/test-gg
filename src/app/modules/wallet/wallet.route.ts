import { Router } from "express";
import { walletController } from "./wallet.controller";
import auth from "../../middleware/auth";
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

export const walletRouter = router;
