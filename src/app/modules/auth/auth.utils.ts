import jwt from "jsonwebtoken";
import config from "../../config";
import { TJwtPayload } from "./auth.interface";

const signPendingToken = (payload: { email: string }) =>
  jwt.sign(payload, config.jwt.pending_secret as string, { expiresIn: "15m" });

const verifyPendingToken = (token: string) =>
  jwt.verify(token, config.jwt.pending_secret as string) as { email: string };

const signAccessToken = (payload: TJwtPayload) =>
  jwt.sign(payload, config.jwt.access_secret as string, {
    // @ts-ignore
    expiresIn: config.jwt.access_expires_in,
  });

const signRefreshToken = (payload: TJwtPayload, stayLoggedIn: boolean) =>
  jwt.sign(payload, config.jwt.refresh_secret as string, {
    // @ts-ignore
    expiresIn: stayLoggedIn
      ? config.jwt.refresh_expires_in_extended
      : config.jwt.refresh_expires_in_default,
  });

const verifyRefreshToken = (token: string) =>
  jwt.verify(token, config.jwt.refresh_secret as string) as TJwtPayload;

export const authUtils = {
  signPendingToken,
  verifyPendingToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
