import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { adminService } from "./admin.service";
import pick from "../../utils/pick";
import { PAGINATION_KEYS } from "../../helpers/paginate";
import { Permission, Role } from "../../../../generated/prisma/client";

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

export const adminController = {
  getAllUsers,
  updateRole,
  upsertPermissions,
};
