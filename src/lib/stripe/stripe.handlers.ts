import path from "path";
import { Request, Response } from "express";
import { stripe } from "./stripe.client";
import { prisma } from "../../shared/prisma";

// Absolute path to the shared HTML file
const PAYMENT_HTML = path.join(__dirname, "payment-callback.html");

// ─── Helper: wants JSON? ──────────────────────────────────────────────────────
const wantsJson = (req: Request) =>
  req.headers["accept"]?.includes("application/json") ?? false;

// ─── GET /payment/success?session_id=xxx ─────────────────────────────────────
export const handleStripePaymentSuccess = async (
  req: Request,
  res: Response,
) => {
  const { session_id } = req.query as { session_id?: string };

  // Serve the HTML shell for browser navigation
  if (!wantsJson(req)) {
    return res.sendFile(PAYMENT_HTML);
  }

  // JSON response for the in-page fetch()
  if (!session_id) {
    return res
      .status(400)
      .json({ success: false, message: "Missing session_id." });
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (session.payment_status !== "paid") {
    return res.status(402).json({
      success: false,
      message: "Payment not completed.",
      paymentStatus: session.payment_status,
    });
  }

  const transactionId = session.metadata?.transactionId;
  if (!transactionId) {
    return res
      .status(404)
      .json({ success: false, message: "Transaction not found in session." });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return res
      .status(404)
      .json({ success: false, message: "Transaction record not found." });
  }

  return res.json({
    success: true,
    message: "Payment completed successfully.",
    data: {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent as string,
      customerEmail: session.customer_details?.email ?? null,
      transaction,
    },
  });
};

// ─── GET /payment/cancel?transactionId=xxx ───────────────────────────────────
export const handleStripePaymentCancel = async (
  req: Request,
  res: Response,
) => {
  const { transactionId } = req.query as { transactionId?: string };

  // Always serve HTML for the browser redirect from Stripe
  if (!wantsJson(req)) {
    return res.sendFile(PAYMENT_HTML);
  }

  // JSON path (optional — cancel page reads transactionId from URL itself)
  if (transactionId) {
    await prisma.transaction
      .update({
        where: { id: transactionId },
        data: { status: "CANCELLED" as any },
      })
      .catch(() => null); // ignore if already updated / not found
  }

  return res.json({
    success: false,
    message: "Payment was cancelled.",
    transactionId: transactionId ?? null,
  });
};
