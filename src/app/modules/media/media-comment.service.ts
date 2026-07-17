import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import {
  CreateMediaCommentInput,
  UpdateMediaCommentInput,
} from "./media.validation";
import QueryBuilder from "../../builder/QueryBuilder";
import { userCard } from "../../helpers/select";

const createComment = async (
  userId: string,
  mediaPostId: string,
  data: CreateMediaCommentInput,
) => {
  const post = await prisma.mediaPost.findFirst({
    where: { id: mediaPostId, deletedAt: null },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Media post not found");
  }

  if (data.parentId) {
    const parent = await prisma.mediaComment.findFirst({
      where: { id: data.parentId, mediaPostId, deletedAt: null },
    });
    if (!parent) {
      throw new AppError(httpStatus.NOT_FOUND, "Parent comment not found");
    }
    // enforce single-level reply — reply-er-reply na, root comment-er niche i thread hobe
    if (parent.parentId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Cannot reply to a reply");
    }
  }

  const result = await prisma.mediaComment.create({
    data: {
      content: data.content,
      userId,
      mediaPostId,
      parentId: data.parentId ?? null,
    },
    include: {
      user: { select: userCard },
    },
  });

  return result;
};

// top-level comments only, with reply count + first reply preview (matches the UI: "View 1 reply")
const getComments = async (
  mediaPostId: string,
  query: Record<string, unknown>,
) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["content"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();
  options.where.mediaPostId = mediaPostId;
  options.where.parentId = null;
  options.where.deletedAt = null;
  options.orderBy = options.orderBy || { createdAt: "desc" };

  const data = await prisma.mediaComment.findMany({
    ...options,
    include: {
      user: { select: userCard },
      replies: true,
      _count: { select: { replies: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.mediaComment);

  return { data, meta };
};

const getReplies = async (parentId: string, query: Record<string, unknown>) => {
  const parent = await prisma.mediaComment.findFirst({
    where: { id: parentId, deletedAt: null },
  });
  if (!parent) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
  }

  const queryBuilder = new QueryBuilder(query)
    .search(["content"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();
  options.where.parentId = parentId;
  options.where.deletedAt = null;
  options.orderBy = options.orderBy || { createdAt: "asc" };

  const data = await prisma.mediaComment.findMany({
    ...options,
    include: {
      user: { select: userCard },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.mediaComment);

  return { data, meta };
};

const updateComment = async (
  id: string,
  userId: string,
  data: UpdateMediaCommentInput,
) => {
  const comment = await prisma.mediaComment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
  }
  if (comment.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this comment",
    );
  }

  return prisma.mediaComment.update({
    where: { id },
    data: { content: data.content },
  });
};

const deleteComment = async (id: string, userId: string) => {
  const comment = await prisma.mediaComment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
  }
  if (comment.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this comment",
    );
  }

  // soft-delete comment + all its replies (self-relation cascade NoAction thakar karone manual)
  await prisma.$transaction([
    prisma.mediaComment.updateMany({
      where: { OR: [{ id }, { parentId: id }] },
      data: { deletedAt: new Date() },
    }),
  ]);

  return { id };
};

export const mediaCommentService = {
  createComment,
  getComments,
  getReplies,
  updateComment,
  deleteComment,
};
