export type UserFilterQuery = Partial<{
  searchTerm: string;
  username: string;
  email: string;
  region: string;
}>;

export type ActivityLogFilterQuery = Partial<{
  actorId: string;
  action: string;
  targetType: string;
}>;