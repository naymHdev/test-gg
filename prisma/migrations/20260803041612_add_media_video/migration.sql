-- CreateTable
CREATE TABLE "media_videos" (
    "id" TEXT NOT NULL,
    "mediaPostId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_videos_mediaPostId_idx" ON "media_videos"("mediaPostId");

-- AddForeignKey
ALTER TABLE "media_videos" ADD CONSTRAINT "media_videos_mediaPostId_fkey" FOREIGN KEY ("mediaPostId") REFERENCES "media_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
