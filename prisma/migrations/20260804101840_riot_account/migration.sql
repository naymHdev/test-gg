/*
  Warnings:

  - A unique constraint covering the columns `[riotPuuid]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "riotPuuid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_riotPuuid_key" ON "users"("riotPuuid");
