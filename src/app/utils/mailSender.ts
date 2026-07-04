import axios from "axios";
import httpStatus from "http-status";
import AppError from "../error/AppError";
import config from "../config";

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const emailData = {
      to,
      from: config.nodemailer.from,
      subject,
      html,
      host: config.nodemailer.host,
      port: Number(config.nodemailer.port),
      secure: Boolean(config.nodemailer.secure),
      userEmail: config.nodemailer.auth.user,
      appPassword: config.nodemailer.auth.pass,
    };

    const res = await axios.post(
      "https://nodemailer-mail-sender.vercel.app",
      emailData,
    );
    const result = res?.data;
    if (!result.success) {
      throw new AppError(httpStatus.BAD_REQUEST, result.message);
    }
    console.log("  Email sent successfully");
    return result;
  } catch (error) {
    console.log("Error sending email________", error);
    throw new AppError(httpStatus.BAD_REQUEST, "Error sending email");
  }
};
