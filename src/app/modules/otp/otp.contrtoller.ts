import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { otpService } from "./otp.service";
import httpStatus from "http-status";

const verifyOtp = catchAsync(async (req, res) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  const otp = req.body?.otp;

  const result = await otpService.verifyOtp(token as string, otp);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP verified successfully",
    data: result,
  });
});

const resendOtp = catchAsync(async (req, res) => {
  const email = req?.body?.email;

  const result = await otpService.resendOtp(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP resent successfully",
    data: result,
  });
});

export const otpController = {
  verifyOtp,
  resendOtp,
};
