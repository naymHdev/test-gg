import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import { CreatePostCommentInput, UpdatePostCommentInput } from "./post.validation";
import AppError from "../../error/AppError";
import QueryBuilder from "../../builder/QueryBuilder";
import { userCard } from "../../helpers/select";

const createComment = async (
  userId: string,
  postId: string,
  data: CreatePostCommentInput,
) => {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  let finalParentId: string | null = null;
  let replyToUserId: string | null = null;

  if (data.parentId) {
    const clickedComment = await prisma.postComment.findFirst({
      where: { id: data.parentId, postId, deletedAt: null },
    });
    if (!clickedComment) {
      throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
    }

    // flatten: reply-to-a-reply attaches to the root comment, tags the clicked user
    finalParentId = clickedComment.parentId ?? clickedComment.id;
    replyToUserId = clickedComment.userId;
  }

  const result = await prisma.postComment.create({
    data: {
      content: data.content,
      userId,
      postId,
      parentId: finalParentId,
      replyToUserId,
    },
    include: {
      user: { select: userCard },
      replyToUser: { select: userCard },
    },
  });

  return result;
};

const getComments = async (postId: string, query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["content"])
    .filter()
    .sort()
    .paginate();

  const options = queryBuilder.build();
  options.where.postId = postId;
  options.where.parentId = null;
  options.where.deletedAt = null;
  options.orderBy = options.orderBy || { createdAt: "desc" };

  const data = await prisma.postComment.findMany({
    ...options,
    include: {
      user: { select: userCard },
      replies: true,
      _count: { select: { replies: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.postComment);

  return { data, meta };
};

const getReplies = async (parentId: string, query: Record<string, unknown>) => {
  const parent = await prisma.postComment.findFirst({
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

  const data = await prisma.postComment.findMany({
    ...options,
    include: {
      user: { select: userCard },
      replyToUser: { select: { id: true, name: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.postComment);

  return { data, meta };
};

const updateComment = async (
  id: string,
  userId: string,
  data: UpdatePostCommentInput,
) => {
  const comment = await prisma.postComment.findFirst({
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

  return prisma.postComment.update({
    where: { id },
    data: { content: data.content },
  });
};

const deleteComment = async (id: string, userId: string) => {
  const comment = await prisma.postComment.findFirst({
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

  // flat structure — one level of children max, no BFS needed
  await prisma.postComment.updateMany({
    where: { OR: [{ id }, { parentId: id }] },
    data: { deletedAt: new Date() },
  });

  return { id };
};

export const postCommentService = {
  createComment,
  getComments,
  getReplies,
  updateComment,
  deleteComment,
};
