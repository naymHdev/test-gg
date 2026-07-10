import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { reportService } from "./report.service";
import { Permission } from "../../../../generated/prisma/enums";
import { prisma } from "../../../shared/prisma";

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const assertManageReportsAccess = async (user: {
  role: string;
  id: string;
}) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_reports,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage reports",
    );
  }
};

const createReport = catchAsync(async (req, res) => {
  const reporterId = req.user.id;
  const result = await reportService.createReportIntoDB(
    reporterId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Report submitted successfully",
    data: result,
  });
});

const getReports = catchAsync(async (req, res) => {
  await assertManageReportsAccess(req.user);
  const { reports, meta } = await reportService.getReportsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reports retrieved successfully",
    meta,
    data: reports,
  });
});

const getReportById = catchAsync(async (req, res) => {
  await assertManageReportsAccess(req.user);
  const result = await reportService.getReportByIdFromDB(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report retrieved successfully",
    data: result,
  });
});

const resolveReport = catchAsync(async (req, res) => {
  await assertManageReportsAccess(req.user);
  const result = await reportService.resolveReportInDB(
    req.params.id as string,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report resolved successfully",
    data: result,
  });
});

const dismissReport = catchAsync(async (req, res) => {
  await assertManageReportsAccess(req.user);
  const result = await reportService.dismissReportInDB(
    req.params.id as string,
    req.user.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report dismissed successfully",
    data: result,
  });
});

export const reportController = {
  createReport,
  getReports,
  getReportById,
  resolveReport,
  dismissReport,
};
