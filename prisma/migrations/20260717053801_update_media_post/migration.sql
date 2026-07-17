/*
  Warnings:

  - You are about to drop the column `dislikesCount` on the `media_posts` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `media_posts` table. All the data in the column will be lost.
  - You are about to drop the column `likesCount` on the `media_posts` table. All the data in the column will be lost.
  - You are about to drop the `media_likes` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'HAHA', 'WOW', 'SAD', 'ANGRY', 'FIRE');

-- DropForeignKey
ALTER TABLE "media_likes" DROP CONSTRAINT "media_likes_mediaPostId_fkey";

-- DropForeignKey
ALTER TABLE "media_likes" DROP CONSTRAINT "media_likes_userId_fkey";

-- AlterTable
ALTER TABLE "media_comments" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "reactionsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "media_posts" DROP COLUMN "dislikesCount",
DROP COLUMN "imageUrl",
DROP COLUMN "likesCount",
ADD COLUMN     "reactionsCount" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "media_likes";

-- CreateTable
CREATE TABLE "media_images" (
    "id" TEXT NOT NULL,
    "mediaPostId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_reactions" (
    "userId" TEXT NOT NULL,
    "mediaPostId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_reactions_pkey" PRIMARY KEY ("userId","mediaPostId")
);

-- CreateTable
CREATE TABLE "media_comment_reactions" (
    "userId" TEXT NOT NULL,
    "mediaCommentId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_comment_reactions_pkey" PRIMARY KEY ("userId","mediaCommentId")
);

-- CreateIndex
CREATE INDEX "media_images_mediaPostId_idx" ON "media_images"("mediaPostId");

-- CreateIndex
CREATE INDEX "media_reactions_mediaPostId_type_idx" ON "media_reactions"("mediaPostId", "type");

-- CreateIndex
CREATE INDEX "media_comment_reactions_mediaCommentId_type_idx" ON "media_comment_reactions"("mediaCommentId", "type");

-- CreateIndex
CREATE INDEX "media_comments_parentId_idx" ON "media_comments"("parentId");

-- AddForeignKey
ALTER TABLE "media_images" ADD CONSTRAINT "media_images_mediaPostId_fkey" FOREIGN KEY ("mediaPostId") REFERENCES "media_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_reactions" ADD CONSTRAINT "media_reactions_mediaPostId_fkey" FOREIGN KEY ("mediaPostId") REFERENCES "media_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_comment_reactions" ADD CONSTRAINT "media_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_comment_reactions" ADD CONSTRAINT "media_comment_reactions_mediaCommentId_fkey" FOREIGN KEY ("mediaCommentId") REFERENCES "media_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
