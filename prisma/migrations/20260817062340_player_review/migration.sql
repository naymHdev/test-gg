-- CreateTable
CREATE TABLE "player_reviews" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_reviews_reviewedUserId_rating_idx" ON "player_reviews"("reviewedUserId", "rating");

-- CreateIndex
CREATE INDEX "player_reviews_reviewerId_idx" ON "player_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "player_reviews_reviewedUserId_createdAt_idx" ON "player_reviews"("reviewedUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_reviews_reviewerId_reviewedUserId_key" ON "player_reviews"("reviewerId", "reviewedUserId");

-- AddForeignKey
ALTER TABLE "player_reviews" ADD CONSTRAINT "player_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_reviews" ADD CONSTRAINT "player_reviews_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
