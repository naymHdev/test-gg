/*
  Warnings:

  - Added the required column `scheduledAt` to the `matches` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('Scheduled', 'Live', 'Completed', 'Cancelled');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "scheduledAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "MatchStatus" NOT NULL DEFAULT 'Scheduled';

-- CreateIndex
CREATE INDEX "matches_teamAId_scheduledAt_idx" ON "matches"("teamAId", "scheduledAt");

-- CreateIndex
CREATE INDEX "matches_teamBId_scheduledAt_idx" ON "matches"("teamBId", "scheduledAt");
