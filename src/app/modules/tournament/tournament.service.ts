import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import {
  TournamentStatus,
  TeamMemberRole,
  TransactionType,
  NotificationType,
} from "../../../../generated/prisma/client";
import {
  CreateTournamentInput,
  CreateTeamInput,
  CreateMatchInput,
} from "./tournament.validation";
import { notificationHelper } from "../notification/notification.helper";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Throws unless the tournament is currently in one of the allowed statuses. */
const assertTournamentStatus = (
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

// ─── Tournament CRUD ─────────────────────────────────────────────────────────

const createTournamentIntoDB = async (
  creatorId: string,
  payload: CreateTournamentInput,
) => {
  return prisma.tournament.create({
    data: {
      ...payload,
      creatorId,
      status: TournamentStatus.Pending,
    },
  });
};

const getTournamentsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["name", "gameMode"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();

  const tournaments = await prisma.tournament.findMany({
    ...options,
    include: {
      creator: { select: { id: true, username: true } },
      _count: { select: { teams: true, matches: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.tournament);
  return { tournaments, meta };
};

const getTournamentByIdFromDB = async (tournamentId: string) => {
  return prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: {
      creator: { select: { id: true, username: true } },
      approvedBy: { select: { id: true, username: true } },
      teams: {
        include: {
          captain: { select: { id: true, username: true } },
          members: {
            include: { user: { select: { id: true, username: true } } },
          },
        },
      },
      matches: {
        orderBy: [{ round: "asc" }, { matchIndex: "asc" }],
      },
    },
  });
};

// ─── Lifecycle: approve / open registration / reject ───────────────────────

const approveTournamentInDB = async (
  tournamentId: string,
  approverId: string,
) => {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  assertTournamentStatus(
    tournament.status,
    [TournamentStatus.Pending],
    "approve this tournament",
  );

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.Approved,
      approvedById: approverId,
      approvedAt: new Date(),
    },
  });
};

const openRegistrationInDB = async (tournamentId: string) => {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  assertTournamentStatus(
    tournament.status,
    [TournamentStatus.Approved],
    "open registration",
  );

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: TournamentStatus.RegistrationOpen },
  });
};

const rejectTournamentInDB = async (tournamentId: string) => {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });

  assertTournamentStatus(
    tournament.status,
    [
      TournamentStatus.Pending,
      TournamentStatus.Approved,
      TournamentStatus.RegistrationOpen,
    ],
    "reject this tournament",
  );

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: TournamentStatus.Cancelled },
  });
};

// ─── Team registration ──────────────────────────────────────────────────────

const registerTeamIntoDB = async (
  tournamentId: string,
  captainId: string,
  payload: CreateTeamInput,
) => {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      include: { _count: { select: { teams: true } } },
    });

    assertTournamentStatus(
      tournament.status,
      [TournamentStatus.RegistrationOpen],
      "register a team",
    );

    if (tournament._count.teams >= tournament.maxTeams) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Tournament has reached its maximum number of teams",
      );
    }

    const existingMembership = await tx.teamMember.findFirst({
      where: { userId: captainId, team: { tournamentId } },
    });

    if (existingMembership) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You have already registered a team in this tournament",
      );
    }

    return tx.team.create({
      data: {
        tournamentId,
        name: payload.name,
        captainId,
        members: {
          create: {
            userId: captainId,
            tournamentId,
            role: TeamMemberRole.Captain,
          },
        },
      },
      include: { members: true },
    });
  });
};

// ─── Match scheduling ────────────────────────────────────────────────────────

const createMatchIntoDB = async (
  tournamentId: string,
  payload: CreateMatchInput,
) => {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
    });

    assertTournamentStatus(
      tournament.status,
      [TournamentStatus.RegistrationOpen, TournamentStatus.Active],
      "schedule a match",
    );

    const teams = await tx.team.findMany({
      where: {
        tournamentId,
        id: { in: [payload.teamAId, payload.teamBId] },
      },
    });

    if (teams.length !== 2) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Both teams must belong to this tournament",
      );
    }

    const clashingMatch = await tx.match.findFirst({
      where: {
        tournamentId,
        OR: [
          { teamAId: { in: [payload.teamAId, payload.teamBId] } },
          { teamBId: { in: [payload.teamAId, payload.teamBId] } },
        ],
        AND: [
          {
            OR: [
              { round: payload.round },
              { scheduledAt: payload.scheduledAt },
            ],
          },
        ],
      },
    });

    if (clashingMatch) {
      throw new AppError(
        httpStatus.CONFLICT,
        clashingMatch.round === payload.round
          ? "One of these teams already has a match scheduled for this round"
          : "One of these teams already has a match scheduled at this time",
      );
    }

    const match = await tx.match.create({
      data: {
        tournamentId,
        teamAId: payload.teamAId,
        teamBId: payload.teamBId,
        round: payload.round,
        matchIndex: payload.matchIndex,
        scheduledAt: payload.scheduledAt,
      },
    });

    // First scheduled match kicks the tournament off from RegistrationOpen → Active.
    if (tournament.status === TournamentStatus.RegistrationOpen) {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.Active },
      });
    }

    return match;
  });
};

// ─── Prize distribution ─────────────────────────────────────────────────────

const declareMatchWinnerInDB = async (
  matchId: string,
  winnerId: string,
  declaredById: string,
) => {
  const pushTargets: { userId: string; prize: number }[] = [];

  const updatedMatch = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (match.winnerId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This match's winner has already been declared",
      );
    }

    if (winnerId !== match.teamAId && winnerId !== match.teamBId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Winner must be one of the two teams that played this match",
      );
    }

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { winnerId, declaredById, declaredAt: new Date() },
    });

    const remainingMatches = await tx.match.count({
      where: { tournamentId: match.tournamentId, winnerId: null },
    });

    // No matches left undecided → this was the final, distribute the prize pool.
    if (remainingMatches === 0) {
      await tx.tournament.update({
        where: { id: match.tournamentId },
        data: { status: TournamentStatus.Completed },
      });

      const winningMembers = await tx.teamMember.findMany({
        where: { teamId: winnerId },
      });

      if (winningMembers.length > 0) {
        const prizePool = Number(match.tournament.prizePool);
        const prizePerMember =
          Math.round((prizePool / winningMembers.length) * 100) / 100;

        for (const member of winningMembers) {
          const wallet = await tx.wallet.upsert({
            where: { userId: member.userId },
            update: { balance: { increment: prizePerMember } },
            create: { userId: member.userId, balance: prizePerMember },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: TransactionType.Credit,
              amount: prizePerMember,
              reason: "Tournament prize",
              referenceId: match.tournamentId,
            },
          });

          await notificationHelper.createNotification(tx, {
            userId: member.userId,
            type: NotificationType.tournament_winner,
            title: "Your team won the tournament!",
            body: `You earned ${prizePerMember} for winning "${match.tournament.name}".`,
            data: {
              tournamentId: match.tournamentId,
              matchId: match.id,
              prize: prizePerMember,
            },
          });

          pushTargets.push({ userId: member.userId, prize: prizePerMember });
        }
      }
    }

    return updatedMatch;
  });

  pushTargets.forEach(({ userId, prize }) =>
    notificationHelper.queuePush(userId, {
      title: "Your team won the tournament!",
      body: `You earned ${prize} for winning the tournament.`,
    }),
  );

  return updatedMatch;
};

export const tournamentService = {
  createTournamentIntoDB,
  getTournamentsFromDB,
  getTournamentByIdFromDB,
  approveTournamentInDB,
  openRegistrationInDB,
  rejectTournamentInDB,
  registerTeamIntoDB,
  createMatchIntoDB,
  declareMatchWinnerInDB,
};
