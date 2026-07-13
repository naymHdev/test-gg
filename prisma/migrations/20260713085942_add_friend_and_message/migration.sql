/*
  Warnings:

  - You are about to drop the column `friendId` on the `friends` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `friends` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `messages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[initiatorId,targetId]` on the table `friends` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `initiatorId` to the `friends` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetId` to the `friends` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "friends" DROP CONSTRAINT "friends_friendId_fkey";

-- DropForeignKey
ALTER TABLE "friends" DROP CONSTRAINT "friends_userId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropIndex
DROP INDEX "friends_userId_friendId_key";

-- DropIndex
DROP INDEX "messages_senderId_receiverId_createdAt_idx";

-- AlterTable
ALTER TABLE "friends" DROP COLUMN "friendId",
DROP COLUMN "userId",
ADD COLUMN     "initiatorId" TEXT NOT NULL,
ADD COLUMN     "targetId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "deletedAt";

-- CreateIndex
CREATE INDEX "friends_targetId_status_idx" ON "friends"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friends_initiatorId_targetId_key" ON "friends"("initiatorId", "targetId");

-- CreateIndex
CREATE INDEX "messages_senderId_receiverId_idx" ON "messages"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "messages_receiverId_senderId_idx" ON "messages"("receiverId", "senderId");

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
