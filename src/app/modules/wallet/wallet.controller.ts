import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { walletService } from "./wallet.service";
import { prisma } from "../../../shared/prisma";
import { Permission } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";

/** Owner always has full access; Moderator/Admin need the explicit grant.
 *  Same local-helper pattern as assertManageSubscriptionsAccess in
 *  subscription.controller.ts. */
const assertManageWalletAccess = async (user: { role: string; id: string }) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_wallet,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage the wallet system",
    );
  }
};

const myWallet = catchAsync(async (req, res) => {
  const result = await walletService.myWallet(req.user.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My wallet retrieved successfully",
    data: result,
  });
});

const myTransactions = catchAsync(async (req, res) => {
  const { transactions, meta } = await walletService.myTransactions(
    req.user.id as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My transactions retrieved successfully",
    meta,
    data: transactions,
  });
});

const depositCheckout = catchAsync(async (req, res) => {
  const { id } = req.user;
  const { amount } = req.body;

  const result = await walletService.createDepositCheckoutSession(id, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Checkout session created",
    data: result,
  });
});

const requestWithdrawal = catchAsync(async (req, res) => {
  const { id } = req.user;
  const result = await walletService.requestWithdrawal(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Withdrawal request submitted",
    data: result,
  });
});

const myWithdrawals = catchAsync(async (req, res) => {
  const { id } = req.user;
  const { withdrawals, meta } = await walletService.myWithdrawals(
    id,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal requests retrieved",
    meta,
    data: withdrawals,
  });
});

// ─── Admin ───────────────────────────────────────────────────────────────

const adminGetAllWithdrawals = catchAsync(async (req, res) => {
  await assertManageWalletAccess(req.user);

  const { withdrawals, meta } = await walletService.adminGetAllWithdrawals(
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal requests retrieved",
    meta,
    data: withdrawals,
  });
});

const adminApproveWithdrawal = catchAsync(async (req, res) => {
  await assertManageWalletAccess(req.user);

  const result = await walletService.adminApproveWithdrawal(
    req.params.id as string,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal approved",
    data: result,
  });
});

const adminRejectWithdrawal = catchAsync(async (req, res) => {
  await assertManageWalletAccess(req.user);

  const result = await walletService.adminRejectWithdrawal(
    req.params.id as string,
    req.user.id as string,
    req.body.reason,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal rejected",
    data: result,
  });
});

const adminCompleteWithdrawal = catchAsync(async (req, res) => {
  await assertManageWalletAccess(req.user);

  const result = await walletService.adminCompleteWithdrawal(
    req.params.id as string,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal marked as completed",
    data: result,
  });
});

export const walletController = {
  myWallet,
  myTransactions,
  depositCheckout,
  requestWithdrawal,
  myWithdrawals,
  adminGetAllWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminCompleteWithdrawal,
};
