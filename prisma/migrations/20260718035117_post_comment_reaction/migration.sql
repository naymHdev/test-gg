-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "reactionsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "post_reactions" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(300) NOT NULL,
    "parentId" TEXT,
    "replyToUserId" TEXT,
    "reactionsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comment_reactions" (
    "userId" TEXT NOT NULL,
    "postCommentId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comment_reactions_pkey" PRIMARY KEY ("userId","postCommentId")
);

-- CreateIndex
CREATE INDEX "post_reactions_postId_type_idx" ON "post_reactions"("postId", "type");

-- CreateIndex
CREATE INDEX "post_comments_postId_idx" ON "post_comments"("postId");

-- CreateIndex
CREATE INDEX "post_comments_parentId_idx" ON "post_comments"("parentId");

-- CreateIndex
CREATE INDEX "post_comment_reactions_postCommentId_type_idx" ON "post_comment_reactions"("postCommentId", "type");

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "post_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_replyToUserId_fkey" FOREIGN KEY ("replyToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment_reactions" ADD CONSTRAINT "post_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment_reactions" ADD CONSTRAINT "post_comment_reactions_postCommentId_fkey" FOREIGN KEY ("postCommentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
