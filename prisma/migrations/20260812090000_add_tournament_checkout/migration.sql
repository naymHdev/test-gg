CREATE TABLE "tournament_checkouts" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payload" JSONB NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "tournamentId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_checkouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_checkouts_stripeCheckoutSessionId_key" ON "tournament_checkouts"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "tournament_checkouts_tournamentId_key" ON "tournament_checkouts"("tournamentId");
CREATE INDEX "tournament_checkouts_creatorId_idx" ON "tournament_checkouts"("creatorId");

CREATE TABLE "tournament_payment_transactions" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_payment_transactions_tournamentId_key" ON "tournament_payment_transactions"("tournamentId");
CREATE UNIQUE INDEX "tournament_payment_transactions_stripeCheckoutSessionId_key" ON "tournament_payment_transactions"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "tournament_payment_transactions_stripePaymentIntentId_key" ON "tournament_payment_transactions"("stripePaymentIntentId");
CREATE INDEX "tournament_payment_transactions_creatorId_idx" ON "tournament_payment_transactions"("creatorId");
CREATE INDEX "tournament_payment_transactions_paidAt_idx" ON "tournament_payment_transactions"("paidAt");

ALTER TABLE "tournament_payment_transactions" ADD CONSTRAINT "tournament_payment_transactions_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
