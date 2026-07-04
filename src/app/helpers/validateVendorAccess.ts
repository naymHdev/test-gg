import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import { Role, User, Auth } from "../../../generated/prisma/client";
import { vendorServices } from "../modules/vendor/vendor.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type StripeOnboardingStage =
  | "NO_ACCOUNT"
  | "DETAILS_INCOMPLETE"
  | "CHARGES_DISABLED"
  | "PAYOUTS_DISABLED"
  | "FULLY_ACTIVE";

interface StripeAccountStatus {
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  isFullyOnboarded: boolean;
}

interface ValidatedVendor {
  vendor: User & { auth: Auth | null };
  stripeStatus: StripeAccountStatus;
  onboardingStage: StripeOnboardingStage;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const resolveOnboardingStage = (
  stripeAccountId: string | null,
  status: StripeAccountStatus | null,
): StripeOnboardingStage => {
  if (!stripeAccountId) return "NO_ACCOUNT";
  if (!status?.detailsSubmitted) return "DETAILS_INCOMPLETE";
  if (!status?.chargesEnabled) return "CHARGES_DISABLED";
  if (!status?.payoutsEnabled) return "PAYOUTS_DISABLED";
  return "FULLY_ACTIVE";
};

type InactiveStage = Exclude<StripeOnboardingStage, "FULLY_ACTIVE">;

const STAGE_ERRORS: {
  [K in InactiveStage]: { status: number; message: string };
} = {
  NO_ACCOUNT: {
    status: httpStatus.FORBIDDEN,
    message:
      "No Stripe account connected. Please connect your Stripe account to continue.",
  },
  DETAILS_INCOMPLETE: {
    status: httpStatus.FORBIDDEN,
    message:
      "Stripe onboarding is incomplete. Please finish submitting your account details.",
  },
  CHARGES_DISABLED: {
    status: httpStatus.FORBIDDEN,
    message:
      "Your Stripe account cannot accept payments yet. This is usually resolved within 24 hours or may require additional verification.",
  },
  PAYOUTS_DISABLED: {
    status: httpStatus.FORBIDDEN,
    message:
      "Your Stripe account cannot receive payouts yet. Please check your Stripe dashboard for any pending requirements.",
  },
};

// ─── Main Validator ───────────────────────────────────────────────────────────

export const validateVendorAccess = async (
  userId: string,
): Promise<ValidatedVendor> => {
  // 1. Fetch vendor
  const vendor = await prisma.user.findUnique({
    where: { id: userId },
    include: { auth: true },
  });

  if (!vendor) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Vendor account not found. Please register as a vendor first.",
    );
  }

  // 2. Role check
  if (vendor.auth?.role !== Role.Vendor) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Access denied. Only vendor accounts can perform this action.",
    );
  }

  // 3. Fetch Stripe status (only if account exists)
  const stripeStatus = vendor.stripeAccountId
    ? await vendorServices.getStripeAccountStatus(vendor.id)
    : null;

  // 4. Resolve onboarding stage
  const onboardingStage = resolveOnboardingStage(
    vendor.stripeAccountId,
    stripeStatus,
  );

  // 5. Block if not fully active
  if (onboardingStage !== "FULLY_ACTIVE") {
    const { status, message } = STAGE_ERRORS[onboardingStage];
    throw new AppError(status, message);
  }

  return {
    vendor,
    stripeStatus: stripeStatus!,
    onboardingStage,
  };
};
