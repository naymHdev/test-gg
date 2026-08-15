import httpStatus from "http-status";
import { TournamentStatus } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";
import { getAccountByRiotId } from "../../../lib/riot/client";
import { prisma } from "../../../shared/prisma";

export const assertTournamentStatus = (
  status: TournamentStatus,
  allowed: TournamentStatus[],
  action: string,
) => {
  if (!allowed.includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot ${action} while tournament status is "${status}"`,
    );
  }
};

export const resolveRiotIdToUser = async (riotId: string) => {
  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `"${riotId}" is not a valid Riot ID (expected Name#Tag)`,
    );
  }

  let account: { puuid: string };
  try {
    account = await getAccountByRiotId(gameName, tagLine, "euw1");
  } catch (err) {
    if (err instanceof AppError && err.statusCode === httpStatus.NOT_FOUND) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `Riot ID "${riotId}" could not be found`,
      );
    }
    throw err; // rate-limit / gateway errors — surface as-is, not "not found"
  }

  const user = await prisma.user.findUnique({
    where: { riotPuuid: account.puuid },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `No FinderQ account is linked to Riot ID "${riotId}" — that player must verify their Riot account first`,
    );
  }

  return user;
};
