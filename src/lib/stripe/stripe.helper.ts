import {
  PaymentProvider,
  TransactionStatus,
  TransactionType,
} from "../../../generated/prisma/client";
import config from "../../app/config";
import { prisma } from "../../shared/prisma";
import { stripe } from "./stripe.client";

export const PLATFORM_FEE_PERCENT = 0.1;

export const calculateSplit = (totalAmount: number) => {
  const platformFee = Math.round(totalAmount * PLATFORM_FEE_PERCENT);
  const vendorAmount = totalAmount - platformFee;
  return { platformFee, vendorAmount };
};

// ─── Ensure Stripe Customer exists for user ──────────────────────────────────
export const ensureStripeCustomer = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (!user) throw new Error("User not found.");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
};

// ─── Core: Create PaymentIntent + Transaction record ─────────────────────────
interface CreatePaymentIntentOptions {
  userId: string;
  totalAmount: number; // in dollars (e.g. 100.00)
  vendorStripeAccount: string;
  vendorId: string;
  currency?: string;
  type: TransactionType;
  metadata: Record<string, string>; // bookingId, ticketId, etc.

  // Polymorphic booking reference — pass only one
  ticketPurchaseId?: string;
  eventBookingId?: string;
  venueBookingId?: string;
}

export interface PaymentIntentResult {
  clientSecret: string | null;
  transactionId: string;
  sessionId: string;
  paymentUrl: string;
  url: string;
  amount: number;
  platformFee: number;
  vendorAmount: number;
}

export const createPaymentIntent = async (
  options: CreatePaymentIntentOptions,
): Promise<PaymentIntentResult> => {
  const {
    userId,
    totalAmount,
    vendorStripeAccount,
    vendorId,
    currency = "usd",
    type,
    metadata,
    ticketPurchaseId,
    eventBookingId,
    venueBookingId,
  } = options;

  const stripeCustomerId = await ensureStripeCustomer(userId);

  const totalInCents = Math.round(totalAmount * 100);
  const { platformFee, vendorAmount } = calculateSplit(totalInCents);

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type,
      ticketPurchaseId,
      eventBookingId,
      venueBookingId,
      amount: totalAmount,
      platformFee: Number((platformFee / 100).toFixed(2)),
      vendorAmount: Number((vendorAmount / 100).toFixed(2)),
      currency,
      provider: PaymentProvider.STRIPE,
      vendorId,
      vendorStripeAccount,
      status: TransactionStatus.PENDING,
      metadata,
    },
  });

  const appBaseUrl = config.server_url;
  // const appBaseUrl = config.client_url || config.server_url;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      success_url: `${appBaseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/payment/cancel?transactionId=${transaction.id}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: totalInCents,
            product_data: {
              name: `Adaora ${type.replace(/_/g, " ").toLowerCase()}`,
              description: `Payment for ${type.replace(/_/g, " ").toLowerCase()}`,
            },
          },
        },
      ],
      metadata: {
        ...metadata,
        transactionId: transaction.id,
        userId,
        vendorId,
        type,
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: { destination: vendorStripeAccount },
        metadata: {
          ...metadata,
          transactionId: transaction.id,
          userId,
          vendorId,
          type,
        },
      },
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        metadata: {
          ...metadata,
          checkoutSessionId: session.id,
        },
      },
    });

    return {
      clientSecret: null,
      transactionId: transaction.id,
      sessionId: session.id,
      paymentUrl: session.url!,
      url: session.url!,
      amount: totalAmount,
      platformFee: Number((platformFee / 100).toFixed(2)),
      vendorAmount: Number((vendorAmount / 100).toFixed(2)),
    };
  } catch (error) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.FAILED },
    });

    throw error;
  }
};
