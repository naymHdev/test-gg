import nodemailer from "nodemailer";
import httpStatus from "http-status";
import AppError from "../error/AppError";
import config from "../config";

// Singleton transporter — reused across calls instead of reconnecting to SMTP
// every time (same reasoning as the prisma/redis singleton clients).
const transporter = nodemailer.createTransport({
  host: config.nodemailer.host,
  port: Number(config.nodemailer.port),
  secure: Boolean(config.nodemailer.secure), // true for port 465, false for 587/STARTTLS
  auth: {
    user: config.nodemailer.auth.user,
    pass: config.nodemailer.auth.pass,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: config.nodemailer.from,
      to,
      subject,
      html,
    });

    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    // AppError thrown intentionally elsewhere shouldn't be swallowed/re-wrapped
    if (error instanceof AppError) throw error;

    console.error("Error sending email:", error);
    throw new AppError(httpStatus.BAD_REQUEST, "Error sending email");
  }
};

export const sendOtpEmail = (to: string, otp: string) =>
  sendEmail(
    to,
    "Your FinderQ verification code",
    `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
  );

export const sendResetPasswordEmail = (to: string, token: string) =>
  sendEmail(
    to,
    "Reset your FinderQ password",
    `<p>Click <a href="${config.client_url}/reset-password?token=${token}">here</a> to reset your password. This link expires in 30 minutes.</p>`,
  );
