-- CreateEnum
CREATE TYPE "ChannelVisibility" AS ENUM ('Public', 'Private');

-- CreateEnum
CREATE TYPE "WaitingRoomRequestStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- CreateTable
CREATE TABLE "voice_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'Public',
    "maxParticipants" INTEGER NOT NULL DEFAULT 25,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "waitingRoomEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inviteCode" TEXT NOT NULL,
    "streamCallId" TEXT NOT NULL,
    "streamCallType" TEXT NOT NULL DEFAULT 'audio_room',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "voice_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_channel_bans" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_channel_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiting_room_requests" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WaitingRoomRequestStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waiting_room_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_channels_inviteCode_key" ON "voice_channels"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "voice_channels_streamCallId_key" ON "voice_channels"("streamCallId");

-- CreateIndex
CREATE INDEX "voice_channels_ownerId_idx" ON "voice_channels"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_channel_bans_channelId_userId_key" ON "voice_channel_bans"("channelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "waiting_room_requests_channelId_userId_key" ON "waiting_room_requests"("channelId", "userId");

-- AddForeignKey
ALTER TABLE "voice_channels" ADD CONSTRAINT "voice_channels_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_channel_bans" ADD CONSTRAINT "voice_channel_bans_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "voice_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_channel_bans" ADD CONSTRAINT "voice_channel_bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_room_requests" ADD CONSTRAINT "waiting_room_requests_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "voice_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_room_requests" ADD CONSTRAINT "waiting_room_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
