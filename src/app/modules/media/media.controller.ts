import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import pick from "../../utils/pick";
import { uploadManyToS3 } from "../../utils/s3";
import sendResponse from "../../utils/sendResponse";
import { mediaService } from "./media.service";
import { mediaReactionService } from "./reaction/media-reaction.service";
import { mediaCommentService } from "./media-comment.service";

const createMedia = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const body = req.body;
  const files = req.files as { images?: Express.Multer.File[] };

  const imageFiles = files?.images ?? [];
  let uploadedImages: string[] = [];
  if (imageFiles.length > 0) {
    const formattedFiles = imageFiles.map((file) => ({
      file,
      path: "media",
    }));

    const uploadResults = await uploadManyToS3(formattedFiles);
    uploadedImages = uploadResults.map((item) => item.url);
  }

  body.images = uploadedImages;
  const result = await mediaService.createMedia(userId, body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

const getAllMedia = catchAsync(async (req, res) => {
  const result = await mediaService.getAllMedia(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Posts retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleMedia = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await mediaService.getSingleMedia(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post retrieved successfully",
    data: result,
  });
});

const updateMedia = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const body = req.body;
  const files = req.files as { images?: Express.Multer.File[] };

  const imageFiles = files?.images ?? [];
  if (imageFiles.length > 0) {
    const formattedFiles = imageFiles.map((file) => ({
      file,
      path: "media",
    }));

    const uploadResults = await uploadManyToS3(formattedFiles);
    body.images = uploadResults.map((item) => item.url);
  }

  const result = await mediaService.updateMedia(id as string, userId, body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

const deleteMedia = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await mediaService.deleteMedia(id as string, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: result,
  });
});

// -------- Media Reactions ------------------------
const reactToPost = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  const result = await mediaReactionService.reactToPost(
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
  const result = await mediaReactionService.getReactionSummary(
    postId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reaction summary retrieved successfully",
    data: result,
  });
});

// ------------ Media Comments --------------------------------------------------
const createComment = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  const result = await mediaCommentService.createComment(
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
  const options = pick(req.query, ["page", "limit"]);

  const result = await mediaCommentService.getComments(postId as string, {
    page: Number(options.page) || 1,
    limit: Number(options.limit) || 20,
  });

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
  const options = pick(req.query, ["page", "limit"]);

  const result = await mediaCommentService.getReplies(commentId as string, {
    page: Number(options.page) || 1,
    limit: Number(options.limit) || 20,
  });

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

  const result = await mediaCommentService.updateComment(
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

  const result = await mediaCommentService.deleteComment(
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

export const mediaController = {
  createMedia,
  getAllMedia,
  getSingleMedia,
  updateMedia,
  deleteMedia,

  reactToPost,
  getReactionSummary,

  createComment,
  getComments,
  getReplies,
  updateComment,
  deleteComment,
};
