import httpStatus from "http-status";
import Stripe from "stripe";
import AppError from "../../error/AppError";
import { stripe } from "../../../lib/stripe/stripe.client";
import config from "../../config";
import { subscriptionService } from "./subscription.service";
import { walletService } from "../wallet/wallet.service";

// Mirrors what Stripe reports — never drives renewal/cancellation itself.
// Configure this URL (`/api/webhooks/stripe/subscription`) in the Stripe
// dashboard for: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.
export const handleSubscriptionWebhook = async (
  payload: Buffer,
  signature: string,
): Promise<void> => {
  if (!signature) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Missing Stripe webhook signature.",
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.subscription_webhook_secret!,
    );
  } catch (err: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      err?.message || "Invalid webhook signature.",
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await subscriptionService.handleCheckoutSessionCompleted(session);
      } else if (
        session.mode === "payment" &&
        session.metadata?.purpose === "wallet_deposit"
      ) {
        await walletService.handleDepositCheckoutCompleted(session);
      }
      break;
    }

    case "customer.subscription.updated": {
      await subscriptionService.handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription,
      );
      break;
    }

    case "customer.subscription.deleted": {
      await subscriptionService.handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
      );
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("invoice.payment_failed", invoice);
      const subId =
        //   @ts-ignore
        typeof invoice.subscription === "string"
          ? //   @ts-ignore
            invoice.subscription
          : //   @ts-ignore
            invoice.subscription?.id;
      if (subId) {
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        await subscriptionService.handleSubscriptionUpdated(stripeSub);
      }
      break;
    }

    default:
      break;
  }
};
