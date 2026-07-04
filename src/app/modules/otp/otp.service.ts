import httpStatus from "http-status";
import otpGenerator from "otp-generator";
import AppError from "../../error/AppError";
import config from "../../config";
import { redis } from "../../../shared/redis";
import { sendOtpEmail } from "../../utils/mailSender";

const otpKey = (email: string) => `otp:${email}`;
const attemptsKey = (email: string) => `otp:attempts:${email}`;
const lockKey = (email: string) => `otp:lock:${email}`;

/** Generates a 6-digit OTP, stores it in Redis (10min TTL), emails it. */
const sendOtp = async (email: string) => {
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  await redis.set(otpKey(email), otp, "EX", config.redis.otp_ttl_seconds);
  await redis.del(attemptsKey(email)); // fresh attempt counter per new OTP
  await sendOtpEmail(email, otp);

  return { sentTo: email, expiresInSeconds: config.redis.otp_ttl_seconds };
};

/** Re-issues an OTP, invalidating whatever was previously stored (SRS §4.1 edge case). */
const resendOtp = async (email: string) => {
  const locked = await redis.get(lockKey(email));
  if (locked) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many failed attempts. Try again after 15 minutes.",
    );
  }
  return sendOtp(email);
};

/** Verifies OTP, tracks failed attempts, applies 15-min lockout after 5 failures. */
const verifyOtp = async (email: string, submittedOtp: string) => {
  const locked = await redis.get(lockKey(email));
  if (locked) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many failed attempts. Try again after 15 minutes.",
    );
  }

  const storedOtp = await redis.get(otpKey(email));
  if (!storedOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or not found");
  }

  if (storedOtp !== submittedOtp) {
    const attempts = await redis.incr(attemptsKey(email));
    if (attempts >= 5) {
      await redis.set(lockKey(email), "1", "EX", 15 * 60);
      await redis.del(attemptsKey(email));
    }
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  }

  await redis.del(otpKey(email));
  await redis.del(attemptsKey(email));
  return true;
};

export const otpService = { sendOtp, resendOtp, verifyOtp };
