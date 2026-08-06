import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import { CreateMediaPostInput, UpdateMediaPostInput } from "./media.validation";
import AppError from "../../error/AppError";
import { userCard } from "../../helpers/select";
import QueryBuilder from "../../builder/QueryBuilder";

const createMedia = async (userId: string, data: CreateMediaPostInput) => {
  const { images, mediaVideos, ...rest } = data;

  if (
    (!images || images.length === 0) &&
    (!mediaVideos || mediaVideos.length === 0)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "At least one image or video is required",
    );
  }

  const result = await prisma.mediaPost.create({
    data: {
      ...rest,
      userId,
      images: {
        create: (images ?? []).map((url, index) => ({ url, order: index })),
      },
      mediaVideos: {
        create: (mediaVideos ?? []).map((url, index) => ({
          url,
          order: index,
        })),
      },
    },
    include: {
      images: { orderBy: { order: "asc" } },
      mediaVideos: { orderBy: { order: "asc" } },
      user: { select: userCard },
    },
  });

  return result;
};

const getAllMedia = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["language", "category", "title", "description"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();
  options.orderBy = [
    { isPremium: "desc" },
    ...(Array.isArray(options.orderBy)
      ? options.orderBy
      : [options.orderBy || { createdAt: "desc" }]),
  ];
  options.where.deletedAt = null;

  const posts = await prisma.mediaPost.findMany({
    ...options,
    include: {
      user: { select: userCard },
      images: true,
      mediaVideos: true,
      reactions: { select: { type: true } },
    },
  });

  const data = posts.map((post) => {
    const reactionSummary = post.reactions.reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.type] = (acc[r.type] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const { reactions, ...rest } = post;

    return { ...rest, reactionSummary };
  });

  const meta = await queryBuilder.countTotal(prisma.mediaPost);

  return { data, meta };
};

const getSingleMedia = async (id: string) => {
  const post = await prisma.mediaPost.findFirst({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: { order: "asc" } },
      mediaVideos: { orderBy: { order: "asc" } },
      user: { select: userCard },
      reactions: { select: { type: true } },
      _count: { select: { comments: true } },
    },
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Media post not found");
  }

  await prisma.mediaPost.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  const reactionSummary = post.reactions.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const { reactions, ...rest } = post;

  return { ...rest, reactionSummary };
};

const updateMedia = async (
  id: string,
  userId: string,
  data: UpdateMediaPostInput,
) => {
  // @ts-ignore
  const { images, ...rest } = data;

  const post = await prisma.mediaPost.findFirst({
    where: { id, deletedAt: null },
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Media post not found");
  }
  if (post.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this post",
    );
  }

  const result = await prisma.mediaPost.update({
    where: { id },
    data: {
      ...rest,
      ...(images && images.length > 0
        ? {
            images: {
              deleteMany: {},
              create: images.map((url: string, index: number) => ({
                url,
                order: index,
              })),
            },
          }
        : {}),
    },
    include: { images: { orderBy: { order: "asc" } } },
  });

  return result;
};

const deleteMedia = async (id: string, userId: string) => {
  const post = await prisma.mediaPost.findFirst({
    where: { id, deletedAt: null },
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Media post not found");
  }
  if (post.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this post",
    );
  }

  const result = await prisma.mediaPost.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return result;
};

export const mediaService = {
  createMedia,
  getAllMedia,
  getSingleMedia,
  updateMedia,
  deleteMedia,
};
