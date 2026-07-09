/*
  Warnings:

  - A unique constraint covering the columns `[tournamentId,userId]` on the table `team_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tournamentId,captainId]` on the table `teams` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tournamentId` to the `team_members` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "tournamentId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "team_members_tournamentId_userId_key" ON "team_members"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tournamentId_captainId_key" ON "teams"("tournamentId", "captainId");
