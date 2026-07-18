import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { postService } from "./post.service";
import { Permission } from "../../../../generated/prisma/enums";
import { uploadManyToS3 } from "../../utils/s3";
import { prisma } from "../../../shared/prisma";
import { postReactionService } from "./post-reaction.service";
import { postCommentService } from "./post-comment.service";

const createPost = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const body = req.body;
  const files = req.files as {
    images?: Express.Multer.File[];
  };

  const imageFiles = files?.images ?? [];
  let uploadedImages: string[] = [];
  if (imageFiles.length > 0) {
    const formattedFiles = imageFiles.map((file) => ({
      file,
      path: "posts",
    }));

    const uploadResults = await uploadManyToS3(formattedFiles);
    uploadedImages = uploadResults.map((item) => item.url);
  }

  body.images = uploadedImages;
  const result = await postService.createPostIntoDB(userId, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

const getPosts = catchAsync(async (req, res) => {
  const { posts, meta } = await postService.getPostsFromDB(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Posts retrieved successfully",
    meta,
    data: posts,
  });
});

const updatePost = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const body = req.body;

  const files = req.files as {
    images?: Express.Multer.File[];
  };
  const imageFiles = files?.images ?? [];

  let uploadedImages: string[] = [];
  if (imageFiles.length > 0) {
    const formattedFiles = imageFiles.map((file) => ({
      file,
      path: "posts",
    }));
    const uploadResults = await uploadManyToS3(formattedFiles);
    uploadedImages = uploadResults.map((item) => item.url);
  }

  let keepImages: string[] = [];
  if (body.keepImages) {
    keepImages =
      typeof body.keepImages === "string"
        ? JSON.parse(body.keepImages)
        : body.keepImages;
  }

  body.images = [...keepImages, ...uploadedImages];
  delete body.keepImages;
  const result = await postService.updatePostInDB(
    req.params.id as string,
    userId,
    body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

const deletePost = catchAsync(async (req, res) => {
  const { id: userId, role } = req.user;

  let hasDeletePermission = role === "Owner";
  if (!hasDeletePermission) {
    const grantedPermissions = await prisma.userPermission.findMany({
      where: { userId: userId as string },
      select: { permission: true },
    });
    hasDeletePermission = grantedPermissions.some(
      (p) => p.permission === Permission.delete_content,
    );
  }

  const result = await postService.deletePostFromDB(
    req.params.id as string,
    { id: userId as string, role },
    hasDeletePermission,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: result,
  });
});

// ------ post-reaction ------------------------------------------
const reactToPost = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  const result = await postReactionService.reactToPost(
    userId,
    postId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.reacted ? "Reaction added" : "Reaction removed",
    data: result,
  });
});

const getReactionSummary = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const result = await postReactionService.getReactionSummary(postId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reaction summary retrieved successfully",
    data: result,
  });
});

// ------ post-comment ------------------------------------------

const createComment = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  const result = await postCommentService.createComment(
    userId,
    postId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: req.body.parentId
      ? "Reply added successfully"
      : "Comment added successfully",
    data: result,
  });
});

const getComments = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const result = await postCommentService.getComments(
    postId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comments retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getReplies = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const result = await postCommentService.getReplies(
    commentId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Replies retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateComment = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;

  const result = await postCommentService.updateComment(
    commentId as string,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment updated successfully",
    data: result,
  });
});

const deleteComment = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;

  const result = await postCommentService.deleteComment(
    commentId as string,
    userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment deleted successfully",
    data: result,
  });
});

export const postController = {
  createPost,
  getPosts,
  updatePost,
  deletePost,
  reactToPost,
  getReactionSummary,

  createComment,
  getComments,
  getReplies,
  updateComment,
  deleteComment,
};
