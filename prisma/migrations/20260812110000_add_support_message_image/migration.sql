ALTER TABLE "support_messages"
ALTER COLUMN "content" SET DEFAULT '';

ALTER TABLE "support_messages"
ADD COLUMN "imageUrl" TEXT;
