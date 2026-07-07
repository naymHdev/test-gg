import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { postService } from "./post.service";
import { Permission } from "../../../../generated/prisma/enums";
import { uploadManyToS3 } from "../../utils/s3";

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
  // @ts-ignore
  const { id: userId, role, permissions = [] } = req.user;
  const hasDeletePermission =
    role === "Owner" || permissions.includes(Permission.delete_content);

  const result = await postService.deletePostFromDB(
    req.params.id as string,
    { id: userId, role },
    hasDeletePermission,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: result,
  });
});

export const postController = { createPost, getPosts, updatePost, deletePost };
