import httpStatus from "http-status";
import AppError from "../../app/error/AppError";
import config from "../../app/config";
import { RiotPlatform, continentFor } from "./regions";

const riotFetch = async (url: string) => {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": config.riot.api_key! },
  });

  if (res.status === 404) {
    throw new AppError(httpStatus.NOT_FOUND, "Riot account not found");
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "5";
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Riot API rate limit hit, retry in ${retryAfter}s`,
    );
  }
  if (!res.ok) {
    throw new AppError(httpStatus.BAD_GATEWAY, "Riot API request failed");
  }

  return res.json();
};

export const getAccountByRiotId = (
  gameName: string,
  tagLine: string,
  platform: RiotPlatform,
) =>
  riotFetch(
    `https://${continentFor(platform)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName,
    )}/${encodeURIComponent(tagLine)}`,
  ) as Promise<{ puuid: string; gameName: string; tagLine: string }>;

export const getSummonerByPuuid = (puuid: string, platform: RiotPlatform) =>
  riotFetch(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
  ) as Promise<{
    id: string;
    puuid: string;
    profileIconId: number;
    summonerLevel: number;
  }>;

// Data Dragon profile-icon catalog — refreshed every 6h, not per-request
let ddragonCache: {
  version: string;
  iconIds: number[];
  fetchedAt: number;
} | null = null;
const DDRAGON_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const loadDDragonCatalog = async () => {
  if (
    ddragonCache &&
    Date.now() - ddragonCache.fetchedAt < DDRAGON_CACHE_TTL_MS
  ) {
    return ddragonCache;
  }

  const versions: string[] = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json",
  ).then((r) => r.json());
  const version = versions[0];

  const data: { data: Record<string, unknown> } = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/profileicon.json`,
  ).then((r) => r.json());

  ddragonCache = {
    version,
    iconIds: Object.keys(data.data).map(Number),
    fetchedAt: Date.now(),
  };
  return ddragonCache;
};

export const getValidProfileIconIds = async () =>
  (await loadDDragonCatalog()).iconIds;

export const profileIconUrl = async (iconId: number) => {
  const { version } = await loadDDragonCatalog();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
};
