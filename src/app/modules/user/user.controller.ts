import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserService } from "./user.service";
import { uploadToS3 } from "../../utils/s3";

const getUserProfile = catchAsync(async (req, res) => {
  const { username } = req.params;
  const result = await UserService.getUserProfileFromDB(username as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile retrieved successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const { username } = req.user;
  const body = req.body;

  console.log(req.user, { username });
  body.username = username;
  const result = await UserService.updateProfile(body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

const updateProfileAvatar = catchAsync(async (req, res) => {
  const { id } = req.user;
  const body = req.body;
  const file = req.file;

  let url;
  if (file) {
    const upload = await uploadToS3({
      file,
      fileName: `${Date.now()}-${file.originalname}`,
    });
    url = upload;
  }
  body.userId = id;
  body.avatar = url;
  const result = await UserService.updateProfileAvatar(body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile avatar updated successfully",
    data: result,
  });
});

const updateProfileBanner = catchAsync(async (req, res) => {
  const { id } = req.user;
  const body = req.body;
  const file = req.file;

  let url;
  if (file) {
    const upload = await uploadToS3({
      file,
      fileName: `${Date.now()}-${file.originalname}`,
    });
    url = upload;
  }
  body.userId = id;
  body.banner = url;
  const result = await UserService.updateProfileBanner(body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile banner updated successfully",
    data: result,
  });
});

export const UserController = {
  getUserProfile,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
};
