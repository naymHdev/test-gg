import crypto from "crypto";
import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";
import AppError from "../../error/AppError";
import {
  getAccountByRiotId,
  getSummonerByPuuid,
  getValidProfileIconIds,
  profileIconUrl,
} from "../../../lib/riot/client";
import { RiotPlatform } from "../../../lib/riot/regions";

const pendingKey = (userId: string) => `riot_verify_pending:${userId}`;
const PENDING_TTL_SECONDS = 10 * 60; // 10 min window to change the icon
const MAX_VERIFY_ATTEMPTS = 10;

type PendingChallenge = {
  puuid: string;
  platform: RiotPlatform;
  gameName: string;
  tagLine: string;
  expectedIconId: number;
  attempts: number;
};

const assertNotAlreadyLinked = async (puuid: string, userId: string) => {
  const alreadyLinked = await prisma.user.findFirst({
    where: { riotPuuid: puuid, id: { not: userId } },
  });
  if (alreadyLinked) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This Riot account is already linked to another FinderQ account",
    );
  }
};

// Step 1 — lookup the Riot ID, generate a random icon challenge
const startLink = async (
  userId: string,
  riotId: string,
  platform: RiotPlatform,
) => {
  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Riot ID must be in the form Name#Tag",
    );
  }

  const account = await getAccountByRiotId(gameName, tagLine, platform);
  await assertNotAlreadyLinked(account.puuid, userId);

  const summoner = await getSummonerByPuuid(account.puuid, platform);

  const iconIds = await getValidProfileIconIds();
  const candidates = iconIds.filter((id) => id !== summoner.profileIconId);
  const expectedIconId = candidates[crypto.randomInt(0, candidates.length)];

  const challenge: PendingChallenge = {
    puuid: account.puuid,
    platform,
    gameName: account.gameName,
    tagLine: account.tagLine,
    expectedIconId,
    attempts: 0,
  };

  await redis.set(
    pendingKey(userId),
    JSON.stringify(challenge),
    "EX",
    PENDING_TTL_SECONDS,
  );

  return {
    riotId: `${account.gameName}#${account.tagLine}`,
    expectedIconId,
    expectedIconUrl: await profileIconUrl(expectedIconId),
    expiresInSeconds: PENDING_TTL_SECONDS,
  };
};

// resume-friendly — lets the frontend re-fetch the active challenge on reload
const getPendingChallenge = async (userId: string) => {
  const raw = await redis.get(pendingKey(userId));
  if (!raw) return null;

  const challenge: PendingChallenge = JSON.parse(raw);
  return {
    riotId: `${challenge.gameName}#${challenge.tagLine}`,
    expectedIconId: challenge.expectedIconId,
    expectedIconUrl: await profileIconUrl(challenge.expectedIconId),
  };
};

// Step 2 — re-check the live icon against what we asked for
const verifyLink = async (userId: string) => {
  const raw = await redis.get(pendingKey(userId));
  if (!raw) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No pending verification found, please start again",
    );
  }
  const challenge: PendingChallenge = JSON.parse(raw);

  const summoner = await getSummonerByPuuid(
    challenge.puuid,
    challenge.platform,
  );

  if (summoner.profileIconId !== challenge.expectedIconId) {
    challenge.attempts += 1;

    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      await redis.del(pendingKey(userId));
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Too many failed attempts, please start verification again",
      );
    }

    await redis.set(
      pendingKey(userId),
      JSON.stringify(challenge),
      "EX",
      PENDING_TTL_SECONDS,
    );

    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Profile icon doesn't match yet — change it in the League client and try again",
    );
  }

  // re-check uniqueness right before committing (closes the race window
  // between startLink and verifyLink)
  await assertNotAlreadyLinked(challenge.puuid, userId);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isRiotVerified: true,
      riotPuuid: challenge.puuid,
      riotAccount: {
        puuid: challenge.puuid,
        gameName: challenge.gameName,
        tagLine: challenge.tagLine,
        platform: challenge.platform,
        summonerLevel: summoner.summonerLevel,
        verifiedAt: new Date().toISOString(),
      },
    },
  });

  await redis.del(pendingKey(userId));

  return {
    isRiotVerified: updated.isRiotVerified,
    riotAccount: updated.riotAccount,
  };
};

export const riotService = { startLink, getPendingChallenge, verifyLink };
