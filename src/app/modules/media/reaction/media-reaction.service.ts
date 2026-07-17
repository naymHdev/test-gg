import httpStatus from "http-status";
import { ReactToMediaInput } from "../media.validation";
import { prisma } from "../../../../shared/prisma";
import AppError from "../../../error/AppError";

const reactToPost = async (
  userId: string,
  mediaPostId: string,
  data: ReactToMediaInput,
) => {
  const post = await prisma.mediaPost.findFirst({
    where: { id: mediaPostId, deletedAt: null },
  });
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Media post not found");
  }

  const existing = await prisma.mediaReaction.findUnique({
    where: { userId_mediaPostId: { userId, mediaPostId } },
  });

  // same reaction again -> toggle off (remove)
  if (existing && existing.type === data.type) {
    await prisma.$transaction([
      prisma.mediaReaction.delete({
        where: { userId_mediaPostId: { userId, mediaPostId } },
      }),
      prisma.mediaPost.update({
        where: { id: mediaPostId },
        data: { reactionsCount: { decrement: 1 } },
      }),
    ]);
    return { reacted: false };
  }

  // no reaction yet -> create, count +1
  if (!existing) {
    await prisma.$transaction([
      prisma.mediaReaction.create({
        data: { userId, mediaPostId, type: data.type },
      }),
      prisma.mediaPost.update({
        where: { id: mediaPostId },
        data: { reactionsCount: { increment: 1 } },
      }),
    ]);
    return { reacted: true, type: data.type };
  }

  // different reaction type -> just switch, count unchanged
  await prisma.mediaReaction.update({
    where: { userId_mediaPostId: { userId, mediaPostId } },
    data: { type: data.type },
  });
  return { reacted: true, type: data.type };
};

const getReactionSummary = async (mediaPostId: string) => {
  const breakdown = await prisma.mediaReaction.groupBy({
    by: ["type"],
    where: { mediaPostId },
    _count: { type: true },
  });

  return breakdown.map((b) => ({ type: b.type, count: b._count.type }));
};

export const mediaReactionService = {
  reactToPost,
  getReactionSummary,
};
