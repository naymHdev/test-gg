import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { adminService } from "./admin.service";
import pick from "../../utils/pick";
import { PAGINATION_KEYS } from "../../helpers/paginate";
import { Permission, Role } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";

/** Owner always has full access; Moderator/Admin need the explicit grant. */
const assertPermission = async (
  user: { role: string; id: string },
  permission: Permission,
  message: string,
) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some((p) => p.permission === permission);

  if (!hasAccess) {
    throw new AppError(httpStatus.FORBIDDEN, message);
  }
};

const assertBanUsersAccess = (user: { role: string; id: string }) =>
  assertPermission(
    user,
    Permission.ban_users,
    "You do not have permission to ban users",
  );

const assertWarnUsersAccess = (user: { role: string; id: string }) =>
  assertPermission(
    user,
    Permission.warn_users,
    "You do not have permission to warn users",
  );

const assertTimeoutUsersAccess = (user: { role: string; id: string }) =>
  assertPermission(
    user,
    Permission.timeout_users,
    "You do not have permission to timeout users",
  );

const assertViewActivityAccess = (user: { role: string; id: string }) =>
  assertPermission(
    user,
    Permission.view_activity,
    "You do not have permission to view activity logs",
  );

const getAllUsers = catchAsync(async (req, res) => {
  const query = pick(req.query, ["searchTerm", "username", "email", "region"]);
  const options = pick(req.query, PAGINATION_KEYS);
  const result = await adminService.getAllUsersFromDB(options, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const result = await adminService.updateRole(id as string, role as Role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Role updated successfully",
    data: result,
  });
});

const upsertPermissions = catchAsync(async (req, res) => {
  const { id: grantedById } = req.user;
  const { id } = req.params;
  const { permissions } = req.body;
  const result = await adminService.upsertPermissions(
    id as string,
    permissions as Permission[],
    grantedById as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Permissions updated successfully",
    data: result,
  });
});

const banUser = catchAsync(async (req, res) => {
  await assertBanUsersAccess(req.user);
  const { id } = req.params;
  const adminId = req.user.id;
  const result = await adminService.banUserInDB(
    adminId as string,
    id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User banned successfully",
    data: result,
  });
});

const unbanUser = catchAsync(async (req, res) => {
  await assertBanUsersAccess(req.user);
  const { id } = req.params;
  const adminId = req.user.id;
  const result = await adminService.unbanUserInDB(
    adminId as string,
    id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User unbanned successfully",
    data: result,
  });
});

const warnUser = catchAsync(async (req, res) => {
  await assertWarnUsersAccess(req.user);
  const { id } = req.params;
  const adminId = req.user.id;
  const result = await adminService.warnUserInDB(
    adminId as string,
    id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User warned successfully",
    data: result,
  });
});

const timeoutUser = catchAsync(async (req, res) => {
  await assertTimeoutUsersAccess(req.user);
  const { id } = req.params;
  const adminId = req.user.id;
  const result = await adminService.timeoutUserInDB(
    adminId as string,
    id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User timed out successfully",
    data: result,
  });
});

const getActivityLogs = catchAsync(async (req, res) => {
  await assertViewActivityAccess(req.user);
  const query = pick(req.query, ["actorId", "action", "targetType"]);
  const options = pick(req.query, PAGINATION_KEYS);
  const result = await adminService.getActivityLogsFromDB(options, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Activity logs retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const adminController = {
  getAllUsers,
  updateRole,
  upsertPermissions,
  banUser,
  unbanUser,
  warnUser,
  timeoutUser,
  getActivityLogs,
};
