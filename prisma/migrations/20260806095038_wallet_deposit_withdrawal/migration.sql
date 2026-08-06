/*
  Warnings:

  - Added the required column `category` to the `wallet_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('Deposit', 'Withdrawal', 'TournamentPrize', 'ChallengeReward', 'ManualAdjustment', 'Refund');

-- CreateEnum
CREATE TYPE "WithdrawalMethod" AS ENUM ('PayPal', 'BankTransfer');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Completed');

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('Card', 'PayPal', 'BankAccount');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'manage_wallet';

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "category" "TransactionCategory" NOT NULL;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "pendingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "WithdrawalMethod" NOT NULL,
    "paymentDetails" JSONB NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'Pending',
    "rejectionReason" VARCHAR(300),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL,
    "stripePaymentMethodId" TEXT,
    "last4" VARCHAR(4),
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "paypalEmail" TEXT,
    "iban" TEXT,
    "accountHolderName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_requests_userId_status_idx" ON "withdrawal_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE INDEX "payment_methods_userId_idx" ON "payment_methods"("userId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_category_idx" ON "wallet_transactions"("walletId", "category");

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
