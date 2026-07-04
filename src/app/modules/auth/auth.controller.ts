import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import AppError from "../../error/AppError";
import { authService } from "./auth.service";
import { extractDeviceMeta } from "../../helpers/deviceMeta";

const register = catchAsync(async (req, res) => {
  const result = await authService.registerIntoDB(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

const verifyOtp = catchAsync(async (req, res) => {
  // purpose distinguishes register-flow vs login-flow OTP verification
  const { pendingToken, otp, purpose, stayLoggedIn } = req.body;
  const deviceMeta = extractDeviceMeta(req);

  const result =
    purpose === "login"
      ? await authService.verifyLoginOtp(
          pendingToken,
          otp,
          !!stayLoggedIn,
          deviceMeta,
        )
      : await authService.verifyRegisterOtp(pendingToken, otp, deviceMeta);

  setRefreshCookie(res, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Verified successfully",
    data: { accessToken: result.accessToken },
  });
});

const login = catchAsync(async (req, res) => {
  const result = await authService.loginWithCredentials(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.["refresh-token"] || req.body?.refreshToken;
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, "Refresh token is required");
  }
  const deviceMeta = extractDeviceMeta(req);
  const result = await authService.refreshAccessToken(token, deviceMeta);
  setRefreshCookie(res, result.refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Token refreshed",
    data: { accessToken: result.accessToken },
  });
});

const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.["refresh-token"] || req.body?.refreshToken;
  if (token) await authService.logout(token);
  res.clearCookie("refresh-token");
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out",
    data: null,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "If the email exists, a reset link has been sent",
    data: null,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});

// HttpOnly cookie, matches the `refresh-token` cookie name already used in refreshToken()
function setRefreshCookie(res: any, token: string) {
  res.cookie("refresh-token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
}

const getSessions = catchAsync(async (req, res) => {
  // @ts-ignore
  const userId = req.user.id;
  const result = await authService.getActiveSessions(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Active sessions retrieved",
    data: result,
  });
});

const revokeSession = catchAsync(async (req, res) => {
  // @ts-ignore
  const userId = req.user.id;
  await authService.revokeSession(userId, req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Session logged out",
    data: null,
  });
});

export const authController = {
  register,
  verifyOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getSessions,
  revokeSession,
};
