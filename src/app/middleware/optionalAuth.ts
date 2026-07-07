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

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(
      token,
      config.jwt.access_secret as string,
    ) as JwtPayload;
  } catch (err) {
    // @ts-ignore
    req.user = null;
    return next();
  }

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

  if (!user || user.status === "Banned" || user.status === "Suspended") {
    // @ts-ignore
    req.user = null;
    return next();
  }

  req.user = {
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.email,
  };
  next();
});

export default optionalAuth;
