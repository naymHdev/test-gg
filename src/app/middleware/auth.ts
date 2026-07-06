import httpStatus from "http-status";
import AppError from "../error/AppError";
import { prisma } from "../../shared/prisma";
import catchAsync from "../utils/catchAsync";
import { authUtils } from "../modules/auth/auth.utils";
import { Role } from "../../../generated/prisma/enums";

const auth = (...allowedRoles: Role[]) => {
  return catchAsync(async (req, res, next) => {
    const tokenFromHeader = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
    if (!tokenFromHeader) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const decoded = authUtils.verifyAccessToken(tokenFromHeader);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        status: true,
        username: true,
        email: true,
      },
    });
    // console.log("user____", user);

    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists");
    }
    if (user.status === "Banned" || user.status === "Suspended") {
      throw new AppError(httpStatus.FORBIDDEN, "Account is not active");
    }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      throw new AppError(httpStatus.FORBIDDEN, "You do not have permission");
    }

    req.user = {
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
    };
    next();
  });
};

export default auth;
