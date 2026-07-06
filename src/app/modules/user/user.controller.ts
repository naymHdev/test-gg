import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserService } from "./user.service";

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

  body.username = username;
  const result = await UserService.updateProfile(body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

export const UserController = {
  getUserProfile,
  updateProfile,
};
