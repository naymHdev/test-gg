import path from "path";
import { Request, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../app/utils/sendResponse";
import { prisma } from "../../shared/prisma";
import { stripe } from "./stripe.client";
import {
  markTransactionFailed,
  reconcileSuccessfulTransaction,
} from "./stripe.reconciliation";


export const handleStripePaymentSuccess = async (
  req: Request,
  res: Response,
) => {
  // ── Browser redirect হলে HTML serve করো ──────────────────
  const acceptsHtml = req.headers["accept"]?.includes("text/html");
  if (acceptsHtml) {
    return res.sendFile(path.join(__dirname, "payment-callback.html"));
  }

  const sessionId = String(req.query.session_id || "");

  if (!sessionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Missing Stripe session id.",
      data: null,
    });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const transactionId = session.metadata?.transactionId;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const isPaid = session.payment_status === "paid";
  const transaction = isPaid
    ? await reconcileSuccessfulTransaction({
        transactionId,
        stripePaymentIntentId: paymentIntentId,
      })
    : transactionId
      ? await prisma.transaction.findUnique({
          where: { id: transactionId },
        })
      : paymentIntentId
        ? await prisma.transaction.findFirst({
            where: { stripePaymentIntentId: paymentIntentId },
          })
        : null;

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: isPaid,
    message: isPaid
      ? "Payment completed successfully."
      : "Payment is still processing.",
    data: {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      paymentIntentId,
      customerEmail: session.customer_details?.email || null,
      transaction,
    },
  });
};

export const handleStripePaymentCancel = async (
  req: Request,
  res: Response,
) => {
  // ── Browser redirect হলে HTML serve করো ──────────────────
  const acceptsHtml = req.headers["accept"]?.includes("text/html");
  if (acceptsHtml) {
    return res.sendFile(path.join(__dirname, "payment-callback.html"));
  }

  const transactionId = String(req.query.transactionId || "");

  await markTransactionFailed({ transactionId });

  const transaction = transactionId
    ? await prisma.transaction.findUnique({
        where: { id: transactionId },
      })
    : null;

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment was cancelled.",
    data: {
      transactionId: transactionId || null,
      transaction,
    },
  });
};
