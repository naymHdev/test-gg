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
  const { id } = req.user;
  const result = await UserService.updateProfile(id, req.body);

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

const getPresence = catchAsync(async (req, res) => {
  const userIds = (req.query.userIds as string)?.split(",");
  const result = await UserService.getPresenceBatch(userIds);
  sendResponse(res, { statusCode: 200, success: true, data: result });
});

const updateNotificationSettings = catchAsync(async (req, res) => {
  const { id } = req.user;
  const result = await UserService.updateNotificationSettings(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification settings updated successfully",
    data: result,
  });
});

const deactivateAccount = catchAsync(async (req, res) => {
  const { id } = req.user;
  const result = await UserService.deactivateAccount(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deactivated successfully",
    data: result,
  });
});

const deleteAccount = catchAsync(async (req, res) => {
  const { id } = req.user;
  await UserService.deleteAccount(id, req.body.password);

  res.clearCookie("refresh-token");
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted successfully",
    data: null,
  });
});

export const UserController = {
  getUserProfile,
  updateProfile,
  updateProfileAvatar,
  updateProfileBanner,
  getPresence,
  updateNotificationSettings,
  deactivateAccount,
  deleteAccount,
};
