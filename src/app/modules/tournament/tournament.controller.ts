import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { tournamentService } from "./tournament.service";
import { Permission } from "../../../../generated/prisma/enums";
import { prisma } from "../../../shared/prisma";
import { uploadManyToS3 } from "../../utils/s3";

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const assertManageTournamentsAccess = async (user: {
  role: string;
  id: string;
}) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_tournaments,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage tournaments",
    );
  }
};

const createTournament = catchAsync(async (req, res) => {
  const creatorId = req.user.id;
  const body = req.body;
  const files = req.files as {
    logo?: Express.Multer.File[];
    cover?: Express.Multer.File[];
    image?: Express.Multer.File[];
  };

  const filesToUpload: {
    file: Express.Multer.File;
    path: string;
    key: string;
  }[] = [];

  if (files?.logo?.[0]) {
    filesToUpload.push({
      file: files.logo[0],
      path: "tournaments/logo",
      key: "logo",
    });
  }
  if (files?.cover?.[0]) {
    filesToUpload.push({
      file: files.cover[0],
      path: "tournaments/cover",
      key: "cover",
    });
  }
  if (files?.image?.[0]) {
    filesToUpload.push({
      file: files.image[0],
      path: "tournaments/image",
      key: "image",
    });
  }

  let uploaded: Record<string, string> = {};

  if (filesToUpload.length > 0) {
    const results = await uploadManyToS3(filesToUpload);
    filesToUpload.forEach((f, idx) => {
      uploaded[f.key] = results[idx].url;
    });
  }

  if (uploaded.logo) body.logo = uploaded.logo;
  if (uploaded.cover) body.cover = uploaded.cover;
  if (uploaded.image) body.image = uploaded.image;

  const result = await tournamentService.createTournamentForCreator(
    creatorId as string,
    body,
  );

  sendResponse(res, {
    statusCode: result.requiresPayment ? httpStatus.OK : httpStatus.CREATED,
    success: true,
    message: result.requiresPayment
      ? "Complete prize pool payment to create the tournament"
      : "Tournament created successfully, pending approval",
    data: result,
  });
});

const getTournaments = catchAsync(async (req, res) => {
  const { tournaments, meta } = await tournamentService.getTournamentsFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tournaments retrieved successfully",
    meta,
    data: tournaments,
  });
});

const getTournamentById = catchAsync(async (req, res) => {
  const result = await tournamentService.getTournamentByIdFromDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tournament retrieved successfully",
    data: result,
  });
});

const approveTournament = catchAsync(async (req, res) => {
  await assertManageTournamentsAccess(req.user);
  const result = await tournamentService.approveTournamentInDB(
    req.params.id as string,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tournament approved successfully",
    data: result,
  });
});

const openRegistration = catchAsync(async (req, res) => {
  await assertManageTournamentsAccess(req.user);
  const result = await tournamentService.openRegistrationInDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tournament registration opened successfully",
    data: result,
  });
});

const rejectTournament = catchAsync(async (req, res) => {
  await assertManageTournamentsAccess(req.user);
  const result = await tournamentService.rejectTournamentInDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tournament rejected successfully",
    data: result,
  });
});

const registerTeam = catchAsync(async (req, res) => {
  const captainId = req.user.id;
  const result = await tournamentService.registerTeamIntoDB(
    req.params.id as string,
    captainId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Team registered successfully",
    data: result,
  });
});

const createMatch = catchAsync(async (req, res) => {
  await assertManageTournamentsAccess(req.user);
  const result = await tournamentService.createMatchIntoDB(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Match scheduled successfully",
    data: result,
  });
});

const declareMatchWinner = catchAsync(async (req, res) => {
  await assertManageTournamentsAccess(req.user);
  const { winnerId } = req.body;
  const result = await tournamentService.declareMatchWinnerInDB(
    req.params.matchId as string,
    winnerId,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Match winner declared successfully",
    data: result,
  });
});

export const tournamentController = {
  createTournament,
  getTournaments,
  getTournamentById,
  approveTournament,
  openRegistration,
  rejectTournament,
  registerTeam,
  createMatch,
  declareMatchWinner,
};
