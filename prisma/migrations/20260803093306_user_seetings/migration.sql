-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountStatus" ADD VALUE 'Deactivated';
ALTER TYPE "AccountStatus" ADD VALUE 'Deleted';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newMessageNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "systemUpdateNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT true;
