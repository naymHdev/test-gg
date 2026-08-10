import nodemailer from "nodemailer";
import httpStatus from "http-status";
import AppError from "../error/AppError";
import config from "../config";

const transporter = nodemailer.createTransport({
  host: config.nodemailer.host,
  port: Number(config.nodemailer.port),
  secure: config.nodemailer.secure === "true",
  // requireTLS: true,
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
    console.log(`Email sent: ${info?.envelope?.to?.[0]}`);
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

export const sendAccountBannedEmail = (to: string, reason: string) =>
  sendEmail(
    to,
    "Your FinderQ account has been banned",
    `<p>Your account has been banned for the following reason:</p><p><b>${reason}</b></p><p>If you believe this is a mistake, please contact support.</p>`,
  );

export const sendSubscriptionInvoiceEmail = (
  to: string,
  invoice: {
    planName: string;
    amount: string;
    currency: string;
    invoiceUrl?: string;
    invoicePdf?: string;
  },
) =>
  sendEmail(
    to,
    "Your FinderQ Premium receipt",
    `<p>Thanks for subscribing to <b>${invoice.planName}</b>!</p>
     <p>Amount charged: <b>${invoice.amount} ${invoice.currency}</b></p>
     ${invoice.invoiceUrl ? `<p><a href="${invoice.invoiceUrl}">View your invoice</a></p>` : ""}
     ${invoice.invoicePdf ? `<p><a href="${invoice.invoicePdf}">Download PDF receipt</a></p>` : ""}`,
  );

export const sendPasswordChangedEmail = (to: string) =>
  sendEmail(
    to,
    "Your FinderQ password was changed",
    `<p>Your password was just changed. If this wasn't you, please reset your password immediately and contact support.</p>`,
  );

export const sendTwoFactorToggledEmail = (to: string, enabled: boolean) =>
  sendEmail(
    to,
    `Two-factor authentication ${enabled ? "enabled" : "disabled"}`,
    `<p>Two-factor authentication (login verification code) has been <b>${
      enabled ? "enabled" : "disabled"
    }</b> on your account. If you didn't make this change, please contact support immediately.</p>`,
  );

export const sendAccountDeactivatedEmail = (to: string) =>
  sendEmail(
    to,
    "Your FinderQ account has been deactivated",
    `<p>Your account has been temporarily deactivated. Simply log back in at any time to reactivate it.</p>`,
  );

export const sendAccountDeletedEmail = (to: string) =>
  sendEmail(
    to,
    "Your FinderQ account has been deleted",
    `<p>Your account and associated personal data have been permanently deleted, as requested.</p>`,
  );
