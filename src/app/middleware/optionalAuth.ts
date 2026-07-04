import { JwtPayload } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import config from "../config/index";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/prisma";

const optionalAuth = catchAsync(async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];

  if (!token) {
    // @ts-ignore
    req.user = null;
    return next();
  }

  let decode: JwtPayload;
  try {
    decode = jwt.verify(
      token,
      config.jwt.access_secret as string,
    ) as JwtPayload;
  } catch (err) {
    // @ts-ignore
    req.user = null;
    return next();
  }

  const { role, userId, email } = decode;
  const existAccount = await prisma.user.findFirst({
    where: { id: userId, isGuest: false },
    include: { auth: true },
  });

  if (
    !existAccount ||
    !existAccount?.auth?.isVerified ||
    existAccount?.auth?.isDeleted ||
    !existAccount?.auth?.isActive
  ) {
    // @ts-ignore
    req.user = null;
    return next();
  }

  req.user = { id: userId, role, email };
  next();
});

export default optionalAuth;
