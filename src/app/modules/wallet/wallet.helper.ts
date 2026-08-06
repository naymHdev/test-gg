import httpStatus from "http-status";
import {
  Prisma,
  TransactionCategory,
  TransactionType,
  NotificationType,
} from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";
import { notificationHelper } from "../notification/notification.helper";

type LedgerEntryInput = {
  userId: string;
  amount: number; // always positive — direction comes from credit/debit call
  category: TransactionCategory;
  reason: string;
  referenceId?: string;
};

// Credits/debits are the ONLY sanctioned way Wallet.balance ever changes.
// Deposit, withdrawal-completion, tournament prizes, challenge rewards, and
// admin manual adjustments all call these instead of writing to
// Wallet/WalletTransaction directly — keeps the ledger internally
// consistent and makes every balance change auditable in one place.
//
// Both must always be called from inside the caller's own `tx` — a
// Prisma.TransactionClient from an active $transaction — never with the
// bare `prisma` client, so the balance update and the ledger row can never
// land without each other.

const creditWallet = async (
  tx: Prisma.TransactionClient,
  input: LedgerEntryInput,
) => {
  if (input.amount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Amount must be positive");
  }

  const wallet = await tx.wallet.update({
    where: { userId: input.userId },
    data: { balance: { increment: input.amount } },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: TransactionType.Credit,
      category: input.category,
      amount: input.amount,
      reason: input.reason,
      referenceId: input.referenceId,
    },
  });

  await notificationHelper.createNotification(tx, {
    userId: input.userId,
    type: NotificationType.wallet_credited,
    title: "Wallet credited",
    body: `€${input.amount.toFixed(2)} added — ${input.reason}`,
    data: { amount: input.amount, category: input.category },
  });

  return wallet;
};

const debitWallet = async (
  tx: Prisma.TransactionClient,
  input: LedgerEntryInput,
) => {
  if (input.amount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Amount must be positive");
  }

  // Atomic conditional update — `updateMany` with the balance check baked
  // into `where` means the balance check and the decrement happen as one
  // DB operation. Two concurrent debits can never both pass a separate
  // "read balance, then check, then write" and drive the balance negative.
  const result = await tx.wallet.updateMany({
    where: { userId: input.userId, balance: { gte: input.amount } },
    data: { balance: { decrement: input.amount } },
  });

  if (result.count === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Insufficient wallet balance");
  }

  const wallet = await tx.wallet.findUniqueOrThrow({
    where: { userId: input.userId },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: TransactionType.Debit,
      category: input.category,
      amount: input.amount,
      reason: input.reason,
      referenceId: input.referenceId,
    },
  });

  return wallet;
};

// Atomically holds `amount` against a wallet's available balance
// (balance - pendingBalance) for a pending withdrawal request. Raw SQL is
// required here because Prisma's `where` can't compare two columns
// (balance - pendingBalance >= amount) — an ordinary "read balance, check,
// then write" would let two concurrent withdrawal requests both pass a
// stale check and over-withdraw the same balance.
const holdForWithdrawal = async (
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
) => {
  const affectedRows = await tx.$executeRaw`
    UPDATE "wallets"
    SET "pendingBalance" = "pendingBalance" + ${amount}
    WHERE "userId" = ${userId} AND ("balance" - "pendingBalance") >= ${amount}
  `;

  if (affectedRows === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Insufficient available balance",
    );
  }
};

// Releases a previously-held amount back to available balance — used both
// on rejection (money never moves) and on completion (right before the
// real debitWallet() call actually takes it out of `balance`).
const releaseWithdrawalHold = async (
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
) => {
  await tx.wallet.update({
    where: { userId },
    data: { pendingBalance: { decrement: amount } },
  });
};

export const walletHelper = {
  creditWallet,
  debitWallet,
  holdForWithdrawal,
  releaseWithdrawalHold,
};
