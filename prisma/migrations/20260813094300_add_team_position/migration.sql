/*
  Warnings:

  - Added the required column `position` to the `team_members` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TeamPosition" AS ENUM ('Top', 'Jungle', 'Mid', 'ADC', 'Support');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "position" "TeamPosition" NOT NULL;
