import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import AppError from "../error/AppError";
import config from "../config/index";
import { prisma } from "../../shared/prisma";

const auth = (...userRoles: string[]) => {
  return catchAsync(async (req, res, next) => {
    const token = req?.headers?.authorization?.split(" ")[1];

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "you are not authorized!");
    }
    let decode: JwtPayload;
    try {
      decode = jwt.verify(
        token,
        config.jwt.access_secret as string,
      ) as JwtPayload;
    } catch (err) {
      throw new AppError(httpStatus.UNAUTHORIZED, "unauthorized");
    }
    const { role, userId, email } = decode;
    const existAccount = await prisma.user.findFirst({
      where: { id: userId, isGuest: false },
      include: { auth: true },
    });

    if (!existAccount) {
      throw new AppError(httpStatus.NOT_FOUND, "user not found");
    }

    if (!existAccount?.auth?.isVerified) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Your account is not verified",
      );
    }

    if (existAccount?.auth?.isDeleted) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account is deleted contact admin",
      );
    }

    if (!existAccount?.auth?.isActive) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account is blocked! Contact admin",
      );
    }

    if (userRoles && !userRoles.includes(existAccount?.auth?.role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    req.user = { id: userId, role, email };
    next();
  });
};
export default auth;
