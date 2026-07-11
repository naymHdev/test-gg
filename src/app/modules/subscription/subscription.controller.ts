import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { subscriptionService } from "./subscription.service";
import { prisma } from "../../../shared/prisma";
import { Permission } from "../../../../generated/prisma/client";
import AppError from "../../error/AppError";
import config from "../../config";

/** Owner always has full access; Moderator/Admin need the explicit grant.
 *  Reuses manage_settings — there's no dedicated permission for pricing,
 *  same call made in legal.controller.ts for legal documents. */
const assertManageSubscriptionsAccess = async (user: {
  role: string;
  id: string;
}) => {
  if (user.role === "Owner") return;

  const grantedPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true },
  });

  const hasAccess = grantedPermissions.some(
    (p) => p.permission === Permission.manage_settings,
  );

  if (!hasAccess) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to manage subscription plans",
    );
  }
};

// ─── Admin: Plan CRUD ────────────────────────────────────────────────────────

const createPlan = catchAsync(async (req, res) => {
  await assertManageSubscriptionsAccess(req.user);
  const result = await subscriptionService.createPlanIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Subscription plan created successfully",
    data: result,
  });
});

const updatePlan = catchAsync(async (req, res) => {
  await assertManageSubscriptionsAccess(req.user);
  const { id } = req.params;
  const result = await subscriptionService.updatePlanInDB(
    id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription plan updated successfully",
    data: result,
  });
});

const togglePlanActive = catchAsync(async (req, res) => {
  await assertManageSubscriptionsAccess(req.user);
  const { id } = req.params;
  const result = await subscriptionService.togglePlanActiveInDB(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isActive
      ? "Subscription plan activated successfully"
      : "Subscription plan deactivated successfully",
    data: result,
  });
});

const getAllPlans = catchAsync(async (req, res) => {
  await assertManageSubscriptionsAccess(req.user);
  const result = await subscriptionService.getAllPlansFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription plans retrieved successfully",
    data: result,
  });
});

// ─── Public: active plans ────────────────────────────────────────────────────

const getActivePlans = catchAsync(async (req, res) => {
  const result = await subscriptionService.getActivePlansFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription plans retrieved successfully",
    data: result,
  });
});

// ─── User: checkout / cancel / my subscription ──────────────────────────────

const createCheckout = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const { planId } = req.body;
  const result = await subscriptionService.createCheckoutSessionForUser(
    userId,
    planId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result,
  });
});

const cancelMySubscription = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await subscriptionService.cancelMySubscriptionInDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      "Subscription will be cancelled at the end of the current billing period",
    data: result,
  });
});

const getMySubscription = catchAsync(async (req, res) => {
  const userId = req.user.id as string;
  const result = await subscriptionService.getMySubscriptionFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription retrieved successfully",
    data: result,
  });
});

// ─── Backend-rendered Stripe redirect landing pages ─────────────────────────

const landingPage = (opts: {
  title: string;
  message: string;
  accent: string;
}) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0f1115; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .card { background: #1a1d24; border-radius: 16px; padding: 48px 40px; max-width: 420px;
    text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.4); }
  .icon { width: 64px; height: 64px; border-radius: 50%; background: ${opts.accent}22;
    display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
  h1 { color: #fff; font-size: 22px; margin: 0 0 12px; }
  p { color: #9aa0ac; font-size: 15px; line-height: 1.5; margin: 0 0 28px; }
  a.btn { display: inline-block; background: ${opts.accent}; color: #fff; text-decoration: none;
    padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${opts.accent === "#22c55e" ? "✓" : "✕"}</div>
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    <a class="btn" href="${config.client_url}/profile">Back to Profile</a>
  </div>
</body>
</html>`;

const renderCheckoutSuccess = catchAsync(async (req, res) => {
  const { session_id } = req.query as { session_id?: string };

  let message = "Your premium subscription is now active. Enjoy the perks!";

  if (session_id) {
    const summary =
      await subscriptionService.getCheckoutSessionSummary(session_id);
    if (summary.isPaid) {
      message = `You're subscribed to ${summary.planName}. A receipt has been sent to your email.`;
    }
  }

  res.send(
    landingPage({
      title: "Payment successful",
      message,
      accent: "#22c55e",
    }),
  );
});

const renderCheckoutCancel = catchAsync(async (req, res) => {
  res.send(
    landingPage({
      title: "Checkout cancelled",
      message:
        "No worries — you can subscribe to premium any time from your profile.",
      accent: "#ef4444",
    }),
  );
});

export const subscriptionController = {
  createPlan,
  updatePlan,
  togglePlanActive,
  getAllPlans,
  getActivePlans,
  createCheckout,
  cancelMySubscription,
  getMySubscription,
  renderCheckoutSuccess,
  renderCheckoutCancel,
};
