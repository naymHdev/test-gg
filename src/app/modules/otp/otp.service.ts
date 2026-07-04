import { JwtPayload } from "jsonwebtoken";
import jwt, { Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import config from "../../config";
import moment from "moment";
import { generateOtp } from "../../utils/otpGenerator";
import { sendEmail } from "../../utils/mailSender";

const verifyOtp = async (token: string, otp: string | number) => {
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized");
  }
  let decode;

  try {
    decode = jwt.verify(
      token,
      config.jwt.access_secret as Secret,
    ) as JwtPayload;
  } catch (err) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Session has expired. Please try to submit OTP within 5 minute",
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: decode?.userId },
    include: { auth: true },
  });

  if (!user || !user?.auth) {
    throw new AppError(httpStatus.BAD_REQUEST, "User not found");
  }
  if (new Date() > user?.auth?.expiredAt) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "OTP has expired. Please resend it",
    );
  }

  if (user?.auth?.otp_status) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You already verified, need to login",
    );
  }

  if (otp !== user?.auth?.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP did not match");
  }

  const updateUser = await prisma.user.update({
    where: { id: user?.id },
    data: {
      auth: {
        update: {
          data: {
            otp: "0",
            expiredAt: moment().add(5, "minute").toDate(),
            otp_status: true,
            isVerified: true,
          },
        },
      },
    },
  });

  const jwtPayload = {
    role: user?.auth?.role,
    userId: updateUser?.id,
  };

  const accessToken = jwt.sign(jwtPayload, config.jwt.access_secret as Secret, {
    expiresIn: "7d", //7 days
  });

  return { user: user, accessToken: accessToken };
};

const resendOtp = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email },
    include: { auth: true },
  });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User not found");
  }

  const otp = generateOtp();
  const expiresAt = moment().add(5, "minute").toDate();

  const updateOtp = await prisma.user.update({
    where: { id: user?.id },
    data: {
      auth: {
        update: {
          data: {
            otp,
            expiredAt: expiresAt,
            otp_status: false,
          },
        },
      },
    },
  });

  if (!updateOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Failed to resend OTP. Please try again later",
    );
  }

  const jwtPayload = {
    userId: user?.id,
    role: user?.auth?.role,
  };
  const token = jwt.sign(jwtPayload, config.jwt.access_secret as Secret, {
    expiresIn: "3m",
  });

  if (user) {
    const emailTemplate = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #1a73e8;">Email Verification</h2>
      <p>Hi ${user.name || "there"},</p>
      <p>Your One-Time Password (OTP) is:</p>
      <p style="font-size: 24px; font-weight: bold; color: #1a73e8;">{{otp}}</p>
      <p>This OTP will expire in 5 minutes. Do not share it with anyone.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <br>
      <p>Best regards,<br>Your Company Name</p>
    </div>
  `;

    await sendEmail(
      user.email,
      "Your One-Time OTP",
      emailTemplate.replace("{{otp}}", otp),
    );
  }

  return token;
};

export const otpService = {
  verifyOtp,
  resendOtp,
};
