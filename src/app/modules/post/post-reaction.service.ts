import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import { ReactToPostInput } from "./post.validation";
import AppError from "../../error/AppError";

const reactToPost = async (
  userId: string,
  postId: string,
  data: ReactToPostInput,
) => {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const existing = await prisma.postReaction.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing && existing.type === data.type) {
    await prisma.$transaction([
      prisma.postReaction.delete({
        where: { userId_postId: { userId, postId } },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { reactionsCount: { decrement: 1 } },
      }),
    ]);
    return { reacted: false };
  }

  if (!existing) {
    await prisma.$transaction([
      prisma.postReaction.create({ data: { userId, postId, type: data.type } }),
      prisma.post.update({
        where: { id: postId },
        data: { reactionsCount: { increment: 1 } },
      }),
    ]);
    return { reacted: true, type: data.type };
  }

  await prisma.postReaction.update({
    where: { userId_postId: { userId, postId } },
    data: { type: data.type },
  });
  return { reacted: true, type: data.type };
};

const getReactionSummary = async (postId: string) => {
  const breakdown = await prisma.postReaction.groupBy({
    by: ["type"],
    where: { postId },
    _count: { type: true },
  });

  return breakdown.map((b) => ({ type: b.type, count: b._count.type }));
};

export const postReactionService = {
  reactToPost,
  getReactionSummary,
};
