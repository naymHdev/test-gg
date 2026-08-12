type BracketTeam = {
  id: string;
  name: string;
  seed: number;
};

type BracketMatchInput = {
  id: string;
  teamAId: string;
  teamBId: string;
  winnerId: string | null;
  round: number;
  matchIndex: number;
  scheduledAt: Date;
  status: string;
  declaredAt: Date | null;
};

type TournamentBracketInput = {
  format: string;
  maxTeams: number;
  teams: Array<{ id: string; name: string; createdAt: Date }>;
  matches: BracketMatchInput[];
};

type BracketMatch = {
  id: string | null;
  matchIndex: number;
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  winner: BracketTeam | null;
  status: string;
  scheduledAt: Date | null;
  declaredAt: Date | null;
  sourceMatchIndexes: [number, number] | null;
};

const getBracketSize = (maxTeams: number) => {
  let size = 2;

  while (size < maxTeams) {
    size *= 2;
  }

  return size;
};

const getRoundName = (matchCount: number) => {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi Finals";
  if (matchCount === 4) return "Quarter Finals";

  return `Round of ${matchCount * 2}`;
};

const createBracketMatch = (
  match: BracketMatchInput | undefined,
  matchIndex: number,
  teamA: BracketTeam | null,
  teamB: BracketTeam | null,
  sourceMatchIndexes: [number, number] | null,
  getTeam: (teamId: string | null | undefined) => BracketTeam | null,
): BracketMatch => ({
  id: match?.id ?? null,
  matchIndex,
  teamA: match ? getTeam(match.teamAId) : teamA,
  teamB: match ? getTeam(match.teamBId) : teamB,
  winner: getTeam(match?.winnerId),
  status: match?.winnerId ? "Completed" : (match?.status ?? "Pending"),
  scheduledAt: match?.scheduledAt ?? null,
  declaredAt: match?.declaredAt ?? null,
  sourceMatchIndexes,
});

const buildSingleEliminationBracket = (input: TournamentBracketInput) => {
  const capacity = getBracketSize(input.maxTeams);
  const totalRounds = Math.log2(capacity);
  const seededTeams = [...input.teams]
    .sort(
      (first, second) =>
        first.createdAt.getTime() - second.createdAt.getTime() ||
        first.id.localeCompare(second.id),
    )
    .map((team, index) => ({ ...team, seed: index + 1 }));
  const teamsById = new Map(seededTeams.map((team) => [team.id, team]));
  const getTeam = (teamId: string | null | undefined) =>
    teamId ? (teamsById.get(teamId) ?? null) : null;
  const matchesBySlot = new Map<string, BracketMatchInput>();
  const unmappedMatches: BracketMatchInput[] = [];

  for (const match of input.matches) {
    const matchesInRound = capacity / 2 ** match.round;
    const slotKey = `${match.round}:${match.matchIndex}`;

    if (
      match.round < 1 ||
      match.round > totalRounds ||
      match.matchIndex < 0 ||
      match.matchIndex >= matchesInRound ||
      matchesBySlot.has(slotKey)
    ) {
      unmappedMatches.push(match);
      continue;
    }

    matchesBySlot.set(slotKey, match);
  }

  const rounds: Array<{
    round: number;
    name: string;
    matches: BracketMatch[];
  }> = [];

  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = capacity / 2 ** round;
    const previousRound = rounds[round - 2];
    const matches = Array.from({ length: matchCount }, (_, matchIndex) => {
      const match = matchesBySlot.get(`${round}:${matchIndex}`);

      if (round === 1) {
        return createBracketMatch(
          match,
          matchIndex,
          seededTeams[matchIndex * 2] ?? null,
          seededTeams[matchIndex * 2 + 1] ?? null,
          null,
          getTeam,
        );
      }

      const previousMatchA = previousRound.matches[matchIndex * 2];
      const previousMatchB = previousRound.matches[matchIndex * 2 + 1];

      return createBracketMatch(
        match,
        matchIndex,
        previousMatchA.winner,
        previousMatchB.winner,
        [matchIndex * 2, matchIndex * 2 + 1],
        getTeam,
      );
    });

    rounds.push({ round, name: getRoundName(matchCount), matches });
  }

  return {
    type: "single_elimination" as const,
    format: input.format,
    capacity,
    totalTeams: input.teams.length,
    totalRounds,
    rounds,
    unmappedMatches,
  };
};

const buildRoundRobinBracket = (input: TournamentBracketInput) => {
  const seededTeams = [...input.teams]
    .sort(
      (first, second) =>
        first.createdAt.getTime() - second.createdAt.getTime() ||
        first.id.localeCompare(second.id),
    )
    .map((team, index) => ({ ...team, seed: index + 1 }));
  const teamsById = new Map(seededTeams.map((team) => [team.id, team]));
  const getTeam = (teamId: string | null | undefined) =>
    teamId ? (teamsById.get(teamId) ?? null) : null;
  const matchesByRound = new Map<number, BracketMatchInput[]>();

  for (const match of input.matches) {
    const roundMatches = matchesByRound.get(match.round) ?? [];
    roundMatches.push(match);
    matchesByRound.set(match.round, roundMatches);
  }

  const totalRounds = Math.max(
    seededTeams.length > 1 ? seededTeams.length - 1 : 0,
    ...matchesByRound.keys(),
  );

  return {
    type: "round_robin" as const,
    format: input.format,
    capacity: input.maxTeams,
    totalTeams: input.teams.length,
    totalRounds,
    rounds: Array.from({ length: totalRounds }, (_, index) => {
      const round = index + 1;
      const matches = (matchesByRound.get(round) ?? [])
        .sort((first, second) => first.matchIndex - second.matchIndex)
        .map((match) =>
          createBracketMatch(
            match,
            match.matchIndex,
            null,
            null,
            null,
            getTeam,
          ),
        );

      return { round, name: `Round ${round}`, matches };
    }),
    unmappedMatches: [],
  };
};

/**
 * Creates the visual bracket payload returned by tournament details. The
 * persisted Match records remain the source of truth; empty future slots are
 * represented with null teams so clients can render them as TBD.
 */
export const buildTournamentBracket = (input: TournamentBracketInput) =>
  input.format === "SingleElimination"
    ? buildSingleEliminationBracket(input)
    : buildRoundRobinBracket(input);
