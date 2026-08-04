export const RIOT_PLATFORMS = [
  "na1",
  "euw1",
  "eun1",
  "kr",
  "jp1",
  "br1",
  "la1",
  "la2",
  "oc1",
  "tr1",
  "ru",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2",
] as const;

export type RiotPlatform = (typeof RIOT_PLATFORMS)[number];

const PLATFORM_TO_CONTINENT: Record<
  RiotPlatform,
  "americas" | "europe" | "asia" | "sea"
> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};

export const continentFor = (platform: RiotPlatform) =>
  PLATFORM_TO_CONTINENT[platform];
