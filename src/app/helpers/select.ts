export const userSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  region: true,
  accountLanguage: true,
  uiLanguage: true,
  isPremium: true,
  isRiotVerified: true,
  riotAccount: true,
  warningCount: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userCard = {
  id: true,
  username: true,
  profile: { select: { avatarUrl: true } },
  isPremium: true,
} as const;
