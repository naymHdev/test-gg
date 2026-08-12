import httpStatus from "http-status";
import { SubscriptionStatus } from "../../../generated/prisma/client";
import { prisma } from "../../shared/prisma";
import AppError from "../error/AppError";
import catchAsync from "../utils/catchAsync";

const requireActivePremium = catchAsync(async (req, _res, next) => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId: req.user.id as string, status: SubscriptionStatus.Active },
    select: { id: true },
  });

  if (!subscription) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "An active premium subscription is required for this feature",
    );
  }

  next();
});

export default requireActivePremium;
