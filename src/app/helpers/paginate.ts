// ─── Types ───────────────────────────────────────────────────────────────────

import { Prisma } from "../../../generated/prisma/client";

export const PAGINATION_KEYS = [
  "page",
  "limit",
  "sortBy",
  "sortOrder",
] as const;

export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

// ─── Core Parser ─────────────────────────────────────────────────────────────

export const parsePagination = (
  options: PaginationQuery,
  defaults: Partial<Omit<PaginationParams, "skip">> = {},
): PaginationParams => {
  const page = Math.max(1, Number(options.page) || defaults.page || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(options.limit) || defaults.limit || 10),
  );
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy || defaults.sortBy || "createdAt";
  const sortOrder = (options.sortOrder ?? defaults.sortOrder ?? "desc") as
    | "asc"
    | "desc";

  return { page, limit, skip, sortBy, sortOrder };
};

// ─── Meta Builder ────────────────────────────────────────────────────────────

export const buildMeta = (
  page: number,
  limit: number,
  total: number,
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPage: Math.ceil(total / limit),
});

// ─── Generic Paginator ───────────────────────────────────────────────────────

type PaginateArgs<T extends Record<string, unknown>> = {
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args?: any) => Promise<number>;
  };
  where?: Record<string, unknown>;
  pagination: PaginationQuery;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  defaults?: Partial<Omit<PaginationParams, "skip">>;
};

export const paginate = async <T extends Record<string, unknown>>({
  model,
  where = {},
  pagination,
  include,
  select,
  defaults,
}: PaginateArgs<T>): Promise<PaginatedResult<T>> => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(
    pagination,
    defaults,
  );

  const queryArgs: Record<string, unknown> = {
    where,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    ...(select ? { select } : include ? { include } : {}),
  };

  const [data, total] = await Promise.all([
    model.findMany(queryArgs),
    model.count({ where }),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
};

// ─── Where Condition Builder ──────────────────────────────────────────────────

type SearchField = { field: string; mode?: Prisma.QueryMode };

export const buildWhereClause = (
  searchTerm: string | undefined,
  searchFields: SearchField[],
  filters: Record<string, unknown> = {},
): Record<string, unknown> => {
  const andConditions: Record<string, unknown>[] = [];

  if (searchTerm && searchFields.length) {
    andConditions.push({
      OR: searchFields.map(({ field, mode = "insensitive" }) => ({
        [field]: { contains: searchTerm, mode },
      })),
    });
  }

  const validFilters = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (validFilters.length) {
    andConditions.push({
      AND: validFilters.map(([key, value]) => ({ [key]: { equals: value } })),
    });
  }

  return andConditions.length ? { AND: andConditions } : {};
};
