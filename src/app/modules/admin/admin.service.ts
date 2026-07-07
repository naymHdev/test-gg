import httpStatus from "http-status";
import { Permission, Role } from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import {
  buildWhereClause,
  paginate,
  PaginationQuery,
} from "../../helpers/paginate";
import { UserFilterQuery } from "../../interface/contents.interface";

const getAllUsersFromDB = async (
  options: PaginationQuery,
  query: UserFilterQuery,
) => {
  const { searchTerm, ...filters } = query;

  const where = buildWhereClause(
    searchTerm,
    [{ field: "username" }, { field: "email" }],
    filters,
    [
      { query: "username", operator: "contains" },
      { query: "email", operator: "contains" },
      { query: "region", operator: "equals" },
    ],
  );

  return paginate({
    model: prisma.user,
    where,
    pagination: options,
    include: { profile: true, permissions: true },
  });
};

const updateRole = async (id: string, role: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (user?.role === role) {
    throw new AppError(httpStatus.BAD_REQUEST, "Role is already same");
  }

  const res = await prisma.user.update({
    where: { id },
    data: {
      role: role as Role,
    },
  });

  return res;
};

const upsertPermissions = async (
  id: string,
  permissions: Permission[],
  grantedById: string,
) => {
  return await prisma.$transaction([
    prisma.userPermission.deleteMany({
      where: {
        userId: id,
      },
    }),

    prisma.userPermission.createMany({
      data: permissions.map((permission) => ({
        userId: id,
        permission,
        grantedById,
      })),
    }),
  ]);
};

export const adminService = {
  getAllUsersFromDB,
  updateRole,
  upsertPermissions,
};
