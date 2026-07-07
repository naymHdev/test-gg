import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import { CreatePostInput, UpdatePostPayload } from "./post.validation";

const createPostIntoDB = async (userId: string, payload: CreatePostInput) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const { images = [], ...postData } = payload;

  return prisma.post.create({
    data: {
      ...postData,
      userId,
      language: user.accountLanguage,
      isVerified: user.isRiotVerified,
      isPremium: user.isPremium,

      images: {
        create: images.map((url: string, index: number) => ({
          url,
          order: index,
        })),
      },
    },
    include: {
      images: true,
    },
  });
};

const getPostsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["content", "region"])
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

  const posts = await prisma.post.findMany({
    ...options,
    include: {
      user: {
        select: {
          username: true,
          profile: { select: { avatarUrl: true, rank: true } },
        },
      },
      images: true,
    },
  });

  const meta = await queryBuilder.countTotal(prisma.post);
  return { posts, meta };
};

const updatePostInDB = async (
  postId: string,
  userId: string,
  payload: Partial<UpdatePostPayload>,
) => {
  const post = await prisma.post.findUniqueOrThrow({
    where: {
      id: postId,
    },
    include: {
      images: true,
    },
  });

  if (post.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You can only edit your own post");
  }

  const { images = [], ...postData } = payload;

  return prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: {
        id: postId,
      },
      data: postData,
    });

    await tx.postImage.deleteMany({
      where: {
        postId,
      },
    });

    if (images.length > 0) {
      await tx.postImage.createMany({
        data: images.map((url: string, index: number) => ({
          postId,
          url,
          order: index,
        })),
      });
    }

    return tx.post.findUniqueOrThrow({
      where: {
        id: postId,
      },
      include: {
        images: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });
  });
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
