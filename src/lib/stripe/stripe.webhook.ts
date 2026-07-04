import httpStatus from "http-status";
import { TransactionStatus } from "../../../generated/prisma/client";
import AppError from "../../app/error/AppError";
import config from "../../app/config";
import { prisma } from "../../shared/prisma";
import { stripe } from "./stripe.client";
import {
  markTransactionFailed,
  reconcileSuccessfulTransaction,
} from "./stripe.reconciliation";

const handleCheckoutSessionCompleted = async (session: any) => {
  const transactionId = session.metadata?.transactionId;
  console.log("transactionId::", transactionId);
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  await reconcileSuccessfulTransaction({
    transactionId,
    stripePaymentIntentId,
  });
};

const handlePaymentSucceeded = async (intent: any) => {
  const transactionId = intent.metadata?.transactionId;
  console.log("handlePaymentSucceeded::", transactionId);
  const stripeChargeId =
    typeof intent.latest_charge === "string" ? intent.latest_charge : null;

  await reconcileSuccessfulTransaction({
    transactionId,
    stripePaymentIntentId: intent.id,
    stripeChargeId,
  });
};

const handlePaymentFailed = async (intent: any) => {
  await markTransactionFailed({
    transactionId: intent.metadata?.transactionId,
    stripePaymentIntentId: intent.id,
  });
};

const handleCheckoutSessionExpired = async (session: any) => {
  await markTransactionFailed({
    transactionId: session.metadata?.transactionId,
  });
};

const handleTransferCreated = async (transfer: any) => {
  await prisma.transaction.updateMany({
    where: { stripeChargeId: transfer.source_transaction as string },
    data: { stripeTransferId: transfer.id },
  });
};

const handleRefund = async (charge: any) => {
  await prisma.transaction.updateMany({
    where: { stripeChargeId: charge.id },
    data: { status: TransactionStatus.REFUNDED },
  });
};

export const handleStripeWebhook = async (
  payload: Buffer | Uint8Array | string,
  signature: string,
): Promise<void> => {
  let event: any;
  const rawPayload = Buffer.isBuffer(payload)
    ? payload
    : typeof payload === "string"
      ? Buffer.from(payload)
      : Buffer.from(payload);

  if (!signature) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Missing Stripe webhook signature.",
    );
  }

  try {
    console.log("---___------", { signature });
    console.log(
      "stripe_webhook_secret----------->>>>",
      config.stripe.stripe_webhook_secret,
    );
    event = stripe.webhooks.constructEvent(
      rawPayload,
      signature,
      config.stripe.stripe_webhook_secret!,
    );
  } catch (err: any) {
    // console.log("sig___err----", err);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      err?.message || "Invalid webhook signature.",
    );
  }

  console.log("event------------type_____________>", event.type);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object);
      break;

    case "checkout.session.expired":
      await handleCheckoutSessionExpired(event.data.object);
      break;

    case "transfer.created":
      await handleTransferCreated(event.data.object);
      break;

    case "charge.refunded":
      await handleRefund(event.data.object);
      break;

    case "account.updated":
      break;

    default:
      break;
  }
};
