import jwt, { JwtPayload } from "jsonwebtoken";
import { Role } from "../../../../generated/prisma/enums";

export const createToken = (
  jwtPayload: { userId: string; role: Role, email: string },
  secret: string,
  expiresIn: number,
) => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn: expiresIn,
  });
};

export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret) as JwtPayload;
};
