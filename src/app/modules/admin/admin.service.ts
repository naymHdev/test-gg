import { prisma } from "../../../shared/prisma";
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
    include: { profile: true },
  });
};

export const adminService = {
  getAllUsersFromDB,
};
