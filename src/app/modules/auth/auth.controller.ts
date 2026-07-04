import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { authService } from "./auth.service";
import { otpService } from "../otp/otp.service";
import AppError from "../../error/AppError";

const createAccount = catchAsync(async (req, res) => {
  // console.log(req.body);
  const result = await authService.createAccountIntoDB(req.body);

  let otpToken;
  if (!result?.auth?.isVerified) {
    otpToken = await otpService.resendOtp(result?.email!);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account created successfully",
    data: { otpToken },
  });
});

const accountLogin = catchAsync(async (req, res) => {
  const result = await authService.accountLoginFromDB(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "You are logged in successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const result = await authService.changePasswordFromDB(
    // @ts-ignore
    req.user?.id!,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: result,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset link sent successfully",
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const token = req?.headers?.authorization?.split(" ")[1];

  const result = await authService.resetPassword(token as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.["refresh-token"] || req.body?.refreshToken;
  console.log("token____", token);

  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, "Refresh token is required");
  }

  const result = await authService.refreshToken(token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Token refresh successfully",
    data: result,
  });
});

const socialLogin = catchAsync(async (req, res) => {
  const result = await authService.socialLogin(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Social login successfully",
    data: result,
  });
});

const switchAccount = catchAsync(async (req, res) => {
  // @ts-ignore
  const userId = req.user?.id!;
  const { targetRole } = req.body;

  const result = await authService.switchAccount(userId, targetRole);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Switched to ${targetRole} account successfully`,
    data: result,
  });
});

const upgradeToVendor = catchAsync(async (req, res) => {
  // @ts-ignore
  const userId = req.user?.id!;

  const result = await authService.upgradeToVendor(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor access granted successfully",
    data: result,
  });
});

export const authController = {
  createAccount,
  accountLogin,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  socialLogin,

  switchAccount,
  upgradeToVendor,
};
