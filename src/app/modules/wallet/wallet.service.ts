import Stripe from "stripe";
import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";
import QueryBuilder from "../../builder/QueryBuilder";
import { userSelect } from "../../helpers/select";
import { stripe } from "../../../lib/stripe/stripe.client";
import * as paypalClient from "../../../lib/paypal/client";
import config from "../../config";
import AppError from "../../error/AppError";
import { walletHelper } from "./wallet.helper";
import { TransactionCategory } from "../../../../generated/prisma/client";
import { notificationHelper } from "../notification/notification.helper";

const myWallet = async (userId: string) => {
  const result = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      user: { select: userSelect },
      _count: { select: { transactions: true } },
    },
  });

  if (!result) return null;

  return {
    ...result,
    // what the UI calls "Available Balance" — balance minus whatever is
    // currently on hold for a pending withdrawal request
    availableBalance: Number(result.balance) - Number(result.pendingBalance),
  };
};

const myTransactions = async (userId: string, query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["type", "category", "reason"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  const transactions = await prisma.walletTransaction.findMany({
    ...options,
    where: { walletId: wallet?.id },
  });

  const meta = await queryBuilder.countTotal(prisma.walletTransaction);
  return { transactions, meta };
};

// ─── Deposit (Stripe) ───────────────────────────────────────────────────────

const createDepositCheckoutSession = async (userId: string, amount: number) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // Reuses the same Stripe Customer subscription checkout already creates.
  // Duplicated here (rather than importing ensureStripeCustomer from the
  // subscription module) to avoid a wallet <-> subscription module
  // circular import — small enough not to be worth the coupling.
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId },
    });
    stripeCustomerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: "FinderQ Wallet Deposit" },
          unit_amount: Math.round(amount * 100), // Stripe wants the smallest currency unit
        },
        quantity: 1,
      },
    ],
    success_url: `${config.client_url}/wallet?deposit=success`,
    cancel_url: `${config.client_url}/wallet?deposit=cancelled`,
    // amount is re-derived from Stripe's own line item at webhook time in
    // spirit, but session.amount_total is the authoritative source there —
    // metadata.amount is kept only as a human-readable audit trail
    metadata: { userId, purpose: "wallet_deposit", amount: amount.toFixed(2) },
  });

  return { url: session.url, sessionId: session.id };
};

// Called from the shared Stripe webhook (subscription.webhook.ts) whenever
// session.mode === "payment" && metadata.purpose === "wallet_deposit" —
// deliberately reuses that single existing webhook endpoint/secret instead
// of registering a second one in the Stripe dashboard.
const handleDepositCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Stripe can redeliver the same event more than once — session.id is
  // globally unique per checkout, so using it as referenceId doubles as an
  // idempotency key. Without this a retried webhook would double-credit.
  const alreadyProcessed = await prisma.walletTransaction.findFirst({
    where: { referenceId: session.id, category: TransactionCategory.Deposit },
  });
  if (alreadyProcessed) return;

  // amount_total is in the smallest currency unit (cents) and is Stripe's
  // own record of what was actually charged — authoritative over whatever
  // we put in metadata when creating the session
  const amount = (session.amount_total ?? 0) / 100;
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    await walletHelper.creditWallet(tx, {
      userId,
      amount,
      category: TransactionCategory.Deposit,
      reason: "Wallet deposit via card",
      referenceId: session.id,
    });
  });

  notificationHelper
    .queuePush(userId, {
      title: "Wallet credited",
      body: `€${amount.toFixed(2)} has been added to your wallet`,
    })
    .catch(() => null);
};

// ─── Deposit (PayPal) ───────────────────────────────────────────────────────
// Orders API v2: create order server-side with a fixed amount → frontend
// renders PayPal's approval button using the returned orderId → user
// approves on PayPal → frontend calls our capture endpoint with the same
// orderId → we capture server-to-server and credit the wallet from
// PayPal's own captured amount, never from anything the client sent.

const paypalDepositOrderKey = (orderId: string) =>
  `paypal_deposit_order:${orderId}`;
const PAYPAL_ORDER_TTL_SECONDS = 60 * 60 * 3; // matches PayPal's own ~3h order expiry

const createPaypalDepositOrder = async (userId: string, amount: number) => {
  const order = await paypalClient.createOrder(amount, userId);

  // binds this orderId to this specific user so capture can't be called
  // with an orderId that belongs to someone else's deposit
  await redis.set(
    paypalDepositOrderKey(order.id),
    userId,
    "EX",
    PAYPAL_ORDER_TTL_SECONDS,
  );

  return { orderId: order.id };
};

const capturePaypalDeposit = async (userId: string, orderId: string) => {
  const boundUserId = await redis.get(paypalDepositOrderKey(orderId));
  if (boundUserId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This PayPal order does not belong to you",
    );
  }

  // idempotency — a retried/duplicate capture call must not double-credit
  const alreadyProcessed = await prisma.walletTransaction.findFirst({
    where: { referenceId: orderId, category: TransactionCategory.Deposit },
  });
  if (alreadyProcessed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This deposit has already been processed",
    );
  }

  const captured = await paypalClient.captureOrder(orderId);

  if (captured.status !== "COMPLETED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "PayPal payment was not completed",
    );
  }

  // this is PayPal's own record of what was actually captured — the only
  // amount we ever trust for crediting
  const amount = Number(
    captured.purchase_units[0]?.payments.captures[0]?.amount.value ?? 0,
  );
  if (amount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid captured amount");
  }

  await prisma.$transaction(async (tx) => {
    await walletHelper.creditWallet(tx, {
      userId,
      amount,
      category: TransactionCategory.Deposit,
      reason: "Wallet deposit via PayPal",
      referenceId: orderId,
    });
  });

  await redis.del(paypalDepositOrderKey(orderId));

  notificationHelper
    .queuePush(userId, {
      title: "Wallet credited",
      body: `€${amount.toFixed(2)} has been added to your wallet`,
    })
    .catch(() => null);

  return { amount };
};

// ─── Withdrawal (user) ──────────────────────────────────────────────────────

const requestWithdrawal = async (
  userId: string,
  payload: {
    amount: number;
    method: "PayPal" | "BankTransfer";
    paymentDetails: Record<string, string | undefined>;
  },
) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const withdrawal = await prisma.$transaction(async (tx) => {
    // reserves the amount against available balance, throws if insufficient
    await walletHelper.holdForWithdrawal(tx, userId, payload.amount);

    return tx.withdrawalRequest.create({
      data: {
        walletId: wallet.id,
        userId,
        amount: payload.amount,
        method: payload.method,
        paymentDetails: payload.paymentDetails,
      },
    });
  });

  return withdrawal;
};

const myWithdrawals = async (userId: string, query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query).filter().sort().paginate();
  const options = queryBuilder.build();

  const withdrawals = await prisma.withdrawalRequest.findMany({
    ...options,
    where: { userId },
  });
  const meta = await queryBuilder.countTotal(prisma.withdrawalRequest);
  return { withdrawals, meta };
};

// ─── Withdrawal review (admin) ──────────────────────────────────────────────
// Deliberately kept as two steps (Approve, then Complete) rather than one —
// "Approve" just confirms the request looks legitimate; "Complete" is only
// clicked once the admin has actually sent the money manually. Collapsing
// these into one click would mark a withdrawal Completed before the money
// has actually left, which is worse for reconciliation than the spec asked
// for even though it reads as one step there.

const adminGetAllWithdrawals = async (query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query).filter().sort().paginate();
  const options = queryBuilder.build();

  const withdrawals = await prisma.withdrawalRequest.findMany({
    ...options,
    include: { user: { select: userSelect } },
  });
  const meta = await queryBuilder.countTotal(prisma.withdrawalRequest);
  return { withdrawals, meta };
};

const adminApproveWithdrawal = async (
  withdrawalId: string,
  adminId: string,
) => {
  const withdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({
    where: { id: withdrawalId },
  });

  if (withdrawal.status !== "Pending") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only pending requests can be approved",
    );
  }

  return prisma.withdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "Approved",
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });
};

const adminRejectWithdrawal = async (
  withdrawalId: string,
  adminId: string,
  reason: string,
) => {
  const withdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({
    where: { id: withdrawalId },
  });

  if (withdrawal.status !== "Pending" && withdrawal.status !== "Approved") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This request can no longer be rejected",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    // money never actually moved — just release the hold
    await walletHelper.releaseWithdrawalHold(
      tx,
      withdrawal.userId,
      Number(withdrawal.amount),
    );

    return tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: "Rejected",
        rejectionReason: reason,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
  });

  notificationHelper
    .queuePush(withdrawal.userId, {
      title: "Withdrawal rejected",
      body: reason,
    })
    .catch(() => null);

  return updated;
};

const adminCompleteWithdrawal = async (
  withdrawalId: string,
  adminId: string,
) => {
  const withdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({
    where: { id: withdrawalId },
  });

  if (withdrawal.status !== "Approved") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only approved requests can be marked completed",
    );
  }

  const amount = Number(withdrawal.amount);

  const updated = await prisma.$transaction(async (tx) => {
    // release the hold, then take the real money out — the hold only
    // reserved the balance, this is where it actually leaves the wallet
    // and gets its own ledger row
    await walletHelper.releaseWithdrawalHold(tx, withdrawal.userId, amount);
    await walletHelper.debitWallet(tx, {
      userId: withdrawal.userId,
      amount,
      category: TransactionCategory.Withdrawal,
      reason: `Withdrawal via ${withdrawal.method}`,
      referenceId: withdrawal.id,
    });

    return tx.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "Completed" },
    });
  });

  notificationHelper
    .queuePush(withdrawal.userId, {
      title: "Withdrawal completed",
      body: `€${amount.toFixed(2)} has been sent to you`,
    })
    .catch(() => null);

  return updated;
};

// ─── Transaction visibility (admin) ─────────────────────────────────────────
// One shared function backs "all deposits", "all transactions of any
// category", and "one user's full history" — they're the same query with a
// different `where`, so a single generic listing avoids three near-copies
// that would drift out of sync over time.

const adminGetAllTransactions = async (query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["type", "category", "reason"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const transactions = await prisma.walletTransaction.findMany({
    ...options,
    include: { wallet: { include: { user: { select: userSelect } } } },
  });
  const meta = await queryBuilder.countTotal(prisma.walletTransaction);
  return { transactions, meta };
};

const adminGetUserTransactions = async (
  userId: string,
  query: Record<string, any>,
) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const queryBuilder = new QueryBuilder(query)
    .search(["type", "category", "reason"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const transactions = await prisma.walletTransaction.findMany({
    ...options,
    where: { ...options.where, walletId: wallet.id },
  });
  const meta = await queryBuilder.countTotal(prisma.walletTransaction);
  return { wallet, transactions, meta };
};

// ─── Manual balance adjustment (admin) ──────────────────────────────────────

const adminAdjustBalance = async (
  targetUserId: string,
  adminId: string,
  payload: { direction: "Credit" | "Debit"; amount: number; reason: string },
) => {
  const updated = await prisma.$transaction(async (tx) => {
    if (payload.direction === "Credit") {
      return walletHelper.creditWallet(tx, {
        userId: targetUserId,
        amount: payload.amount,
        category: TransactionCategory.ManualAdjustment,
        reason: payload.reason,
        referenceId: adminId,
      });
    }

    return walletHelper.debitWallet(tx, {
      userId: targetUserId,
      amount: payload.amount,
      category: TransactionCategory.ManualAdjustment,
      reason: payload.reason,
      referenceId: adminId,
    });
  });

  return updated;
};

export const walletService = {
  myWallet,
  myTransactions,
  createDepositCheckoutSession,
  handleDepositCheckoutCompleted,
  createPaypalDepositOrder,
  capturePaypalDeposit,
  requestWithdrawal,
  myWithdrawals,
  adminGetAllWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminCompleteWithdrawal,
  adminGetAllTransactions,
  adminGetUserTransactions,
  adminAdjustBalance,
};
