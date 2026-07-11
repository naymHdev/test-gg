import httpStatus from "http-status";
import Stripe from "stripe";
import {
  BillingInterval,
  NotificationType,
  SubscriptionStatus,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import config from "../../config";
import { stripe } from "../../../lib/stripe/stripe.client";
import { sendSubscriptionInvoiceEmail } from "../../utils/mailSender";
import { CreatePlanInput, UpdatePlanInput } from "./subscription.validation";

// ─── Admin: Plan CRUD (creates/keeps a matching Stripe Product + Price) ─────

const stripeIntervalFor = (interval: BillingInterval): "month" | "year" =>
  interval === BillingInterval.Yearly ? "year" : "month";

const createPlanIntoDB = async (payload: CreatePlanInput) => {
  const product = await stripe.products.create({
    name: payload.name,
    description: payload.description,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(payload.price * 100),
    currency: payload.currency,
    recurring: { interval: stripeIntervalFor(payload.interval) },
  });

  try {
    return await prisma.subscriptionPlan.create({
      data: {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        currency: payload.currency,
        interval: payload.interval,
        stripeProductId: product.id,
        stripePriceId: price.id,
        features: {
          createMany: {
            data: payload.features.map((f, idx) => ({
              title: f.title,
              description: f.description,
              order: f.order ?? idx,
            })),
          },
        },
      },
      include: { features: { orderBy: { order: "asc" } } },
    });
  } catch (error) {
    // Roll back the Stripe side if the DB write fails, so we don't leak
    // orphaned products/prices that don't back any real plan.
    await stripe.products
      .update(product.id, { active: false })
      .catch(() => null);
    throw error;
  }
};

const updatePlanInDB = async (planId: string, payload: UpdatePlanInput) => {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });

  if (payload.name || payload.description !== undefined) {
    await stripe.products.update(plan.stripeProductId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
    });
  }

  return prisma.$transaction(async (tx) => {
    if (payload.features) {
      await tx.planFeature.deleteMany({ where: { planId } });
      await tx.planFeature.createMany({
        data: payload.features.map((f, idx) => ({
          planId,
          title: f.title,
          description: f.description,
          order: f.order ?? idx,
        })),
      });
    }

    return tx.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: payload.name,
        description: payload.description,
      },
      include: { features: { orderBy: { order: "asc" } } },
    });
  });
};

const togglePlanActiveInDB = async (planId: string) => {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });

  const nextActive = !plan.isActive;

  // Deactivating on Stripe stops it from being selectable in *new* Checkout
  // Sessions — existing subscribers on this price are unaffected.
  await stripe.prices.update(plan.stripePriceId, { active: nextActive });

  return prisma.subscriptionPlan.update({
    where: { id: planId },
    data: { isActive: nextActive },
  });
};

const getAllPlansFromDB = async () => {
  return prisma.subscriptionPlan.findMany({
    include: { features: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
};

const getActivePlansFromDB = async () => {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: { features: { orderBy: { order: "asc" } } },
    orderBy: { price: "asc" },
  });
};

// ─── User: Checkout / Cancel / My subscription ──────────────────────────────

const ensureStripeCustomer = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.username,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
};

const createCheckoutSessionForUser = async (userId: string, planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan || !plan.isActive) {
    throw new AppError(httpStatus.NOT_FOUND, "Plan not found or inactive");
  }

  const existingSub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSub && existingSub.status === SubscriptionStatus.Active) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have an active subscription",
    );
  }

  const stripeCustomerId = await ensureStripeCustomer(userId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${config.server_url}/api/premium/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.server_url}/api/premium/cancel`,
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId } },
  });

  return { url: session.url, sessionId: session.id };
};

const cancelMySubscriptionInDB = async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new AppError(httpStatus.NOT_FOUND, "No active subscription found");
  }

  if (subscription.cancelAtPeriodEnd) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Subscription is already scheduled to cancel",
    );
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
  });
};

const getMySubscriptionFromDB = async (userId: string) => {
  return prisma.subscription.findUnique({
    where: { userId },
    include: { plan: { include: { features: { orderBy: { order: "asc" } } } } },
  });
};

// Used by the GET /premium/success landing page — reads straight from Stripe
// (not our DB) so the page works even if the webhook hasn't landed yet.
const getCheckoutSessionSummary = async (sessionId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const planId = session.metadata?.planId;

  const plan = planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    : null;

  return {
    isPaid: session.payment_status === "paid",
    planName: plan?.name ?? "Premium",
    price: plan?.price,
    currency: plan?.currency,
  };
};

// ─── Webhook-driven lifecycle (auto-renew / cancel / payment failure) ──────
// Stripe subscriptions renew automatically on their own — we only mirror
// whatever Stripe reports here, we never drive renewal ourselves.

const mapStripeStatus = (
  status: Stripe.Subscription.Status,
): SubscriptionStatus => {
  switch (status) {
    case "active":
    case "trialing":
      return SubscriptionStatus.Active;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PastDue;
    case "canceled":
      return SubscriptionStatus.Expired;
    default:
      return SubscriptionStatus.Cancelled;
  }
};

const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !planId || !stripeSubscriptionId) return;

  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: mapStripeStatus(stripeSub.status),
        stripeSubscriptionId,
        currentPeriodStart: new Date(
          stripeSub.items.data[0].current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSub.items.data[0].current_period_end * 1000,
        ),
      },
      update: {
        planId,
        status: mapStripeStatus(stripeSub.status),
        stripeSubscriptionId,
        currentPeriodStart: new Date(
          stripeSub.items.data[0].current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSub.items.data[0].current_period_end * 1000,
        ),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    await tx.user.update({ where: { id: userId }, data: { isPremium: true } });

    await tx.notification.create({
      data: {
        userId,
        type: NotificationType.subscription_activated,
        title: "Premium activated",
        body: "Your premium subscription is now active. Enjoy the perks!",
        data: { planId },
      },
    });
  });

  // fire-and-forget after commit, same reasoning as the ban email
  if (user?.email && typeof session.invoice === "string" && plan) {
    stripe.invoices
      .retrieve(session.invoice)
      .then((invoice) =>
        sendSubscriptionInvoiceEmail(user.email, {
          planName: plan.name,
          amount: (invoice.amount_paid / 100).toFixed(2),
          currency: invoice.currency.toUpperCase(),
          invoiceUrl: invoice.hosted_invoice_url ?? undefined,
          invoicePdf: invoice.invoice_pdf ?? undefined,
        }),
      )
      .catch(() => null);
  }
};

const handleSubscriptionUpdated = async (stripeSub: Stripe.Subscription) => {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
  });
  if (!existing) return;

  const status = mapStripeStatus(stripeSub.status);

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      status,
      currentPeriodStart: new Date(
        stripeSub.items.data[0].current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(
        stripeSub.items.data[0].current_period_end * 1000,
      ),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    },
  });

  if (status === SubscriptionStatus.PastDue) {
    await prisma.notification.create({
      data: {
        userId: existing.userId,
        type: NotificationType.subscription_payment_failed,
        title: "Payment failed",
        body: "We couldn't renew your premium subscription. Please update your payment method.",
        data: {},
      },
    });
  }
};

const handleSubscriptionDeleted = async (stripeSub: Stripe.Subscription) => {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
  });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: existing.id },
      data: { status: SubscriptionStatus.Expired },
    });

    await tx.user.update({
      where: { id: existing.userId },
      data: { isPremium: false },
    });

    await tx.notification.create({
      data: {
        userId: existing.userId,
        type: NotificationType.subscription_cancelled,
        title: "Premium subscription ended",
        body: "Your premium subscription has ended.",
        data: {},
      },
    });
  });
};

export const subscriptionService = {
  createPlanIntoDB,
  updatePlanInDB,
  togglePlanActiveInDB,
  getAllPlansFromDB,
  getActivePlansFromDB,
  createCheckoutSessionForUser,
  getCheckoutSessionSummary,
  cancelMySubscriptionInDB,
  getMySubscriptionFromDB,
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
};
