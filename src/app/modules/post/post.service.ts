import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";

const createPostIntoDB = async (userId: string, payload: any) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // language snapshot is taken from the author's account language, never from
  // client input (SRS §5.1 — language column is immutable per post)
  return prisma.post.create({
    data: {
      ...payload,
      userId,
      language: user.accountLanguage,
      isVerified: user.isRiotVerified,
      isPremium: user.isPremium,
    },
  });
};

// GET /api/posts?region=euw&language=ro&types[]=Clash&ranks[]=Gold&page=1&limit=20
const getPostsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["content"])
    .filter()
    .sort()
    .paginate();

  // Premium posts surface first within the same page (SRS §13.5 "priority in search")
  const options = queryBuilder.build();
  options.orderBy = [{ isPremium: "desc" }, ...(
    Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy || { createdAt: "desc" }]
  )];
  options.where.deletedAt = null;

  const posts = await prisma.post.findMany({
    ...options,
    include: {
      user: {
        select: {
          username: true,
          profile: { select: { avatarUrl: true, rank: true } },
        },
      },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.post);
  return { posts, meta };
};

const updatePostInDB = async (postId: string, userId: string, payload: any) => {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });

  if (post.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only edit your own post");
  }

  return prisma.post.update({ where: { id: postId }, data: payload });
};

const deletePostFromDB = async (
  postId: string,
  requester: { id: string; role: string },
  hasDeletePermission: boolean,
) => {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });

  const isOwner = post.userId === requester.id;
  if (!isOwner && !hasDeletePermission) {
    throw new AppError(httpStatus.FORBIDDEN, "Not allowed to delete this post");
  }

  // soft delete, matching deletedAt pattern used across the schema
  return prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
};

export const postService = {
  createPostIntoDB,
  getPostsFromDB,
  updatePostInDB,
  deletePostFromDB,
};
