import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { postService } from "./post.service";
import { Permission } from "../../../../generated/prisma/enums";

const createPost = catchAsync(async (req, res) => {
  // @ts-ignore
  const userId = req.user.id;
  const result = await postService.createPostIntoDB(userId, req.body);
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
  // @ts-ignore
  const userId = req.user.id;
  const result = await postService.updatePostInDB(req.params.id, userId, req.body);
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
    req.params.id,
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
