import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { legalService } from "./legal.service";
import { getLegalDocumentValidation } from "./legal.validation";
import { prisma } from "../../../shared/prisma";
import { Permission } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const assertManageLegalAccess = async (user: { role: string; id: string }) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_settings,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage legal documents",
    );
  }
};

const getPrivacyPolicy = catchAsync(async (req, res) => {
  const { version } = getLegalDocumentValidation.parse(req.query);
  const result = await legalService.getLegalDocumentFromDB(
    "privacy_policy",
    version,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Privacy policy retrieved successfully",
    data: result,
  });
});

const getTerms = catchAsync(async (req, res) => {
  const { version } = getLegalDocumentValidation.parse(req.query);
  const result = await legalService.getLegalDocumentFromDB("terms", version);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Terms of service retrieved successfully",
    data: result,
  });
});

const upsertLegalDocument = catchAsync(async (req, res) => {
  await assertManageLegalAccess(req.user);
  const result = await legalService.upsertLegalDocumentIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Legal document saved successfully",
    data: result,
  });
});

export const legalController = {
  getPrivacyPolicy,
  getTerms,
  upsertLegalDocument,
};
