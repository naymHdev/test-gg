import httpStatus from "http-status";
import AppError from "../error/AppError";
import { prisma } from "../../shared/prisma";
import catchAsync from "../utils/catchAsync";
import { Permission, Role } from "../../../generated/prisma/enums";

const authorize = (...requiredPermissions: Permission[]) => {
  return catchAsync(async (req, res, next) => {
    const user = req.user;
    console.log("authorize______", user);

    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    if (user.role === Role.Owner) {
      return next();
    }

    const grants = await prisma.userPermission.findMany({
      where: { userId: user.id, permission: { in: requiredPermissions } },
      select: { permission: true },
    });

    const grantedSet = new Set(grants.map((g) => g.permission));
    const hasAll = requiredPermissions.every((p) => grantedSet.has(p));

    if (!hasAll) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to perform this action",
      );
    }

    next();
  });
};

export default authorize;
