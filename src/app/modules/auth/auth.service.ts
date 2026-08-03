import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import AppError from "../../error/AppError";
import config from "../../config";
import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";
import { otpService } from "../otp/otp.service";
import { authUtils } from "./auth.utils";
import { sendResetPasswordEmail } from "../../utils/mailSender";
import { TLoginInput, TRegisterInput } from "./auth.interface";
import { TDeviceMeta } from "../../helpers/deviceMeta";

const pendingRegKey = (email: string) => `pending_registration:${email}`;
const resetTokenKey = (token: string) => `reset_token:${token}`;

// ---------------------------------------------------------------- Register
const registerIntoDB = async (payload: TRegisterInput) => {
  const [usernameTaken, emailTaken] = await Promise.all([
    prisma.user.findFirst({
      where: { username: { equals: payload.username, mode: "insensitive" } },
    }),
    prisma.user.findUnique({ where: { email: payload.email } }),
  ]);

  if (usernameTaken) {
    throw new AppError(httpStatus.CONFLICT, "USERNAME_TAKEN");
  }
  if (emailTaken) {
    throw new AppError(httpStatus.CONFLICT, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(
    payload.password,
    config.jwt.bcrypt_salt_rounds,
  );

  // Stash the not-yet-persisted account in Redis until OTP is confirmed —
  // avoids creating a half-verified User row (mirrors the seedAdmin-style
  // "don't write to DB until state is final" habit).
  await redis.set(
    pendingRegKey(payload.email),
    JSON.stringify({ ...payload, passwordHash }),
    "EX",
    900, // 15 min, matches pendingToken TTL
  );

  await otpService.sendOtp(payload.email);
  const pendingToken = authUtils.signPendingToken({ email: payload.email });

  return { pendingToken };
};

// ------------------------------------------------------- Verify Register OTP
const verifyRegisterOtp = async (
  pendingToken: string,
  otp: string,
  deviceMeta: TDeviceMeta,
) => {
  const { email } = authUtils.verifyPendingToken(pendingToken);

  await otpService.verifyOtp(email, otp);

  const raw = await redis.get(pendingRegKey(email));
  if (!raw) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Registration session expired, please register again",
    );
  }
  const pending = JSON.parse(raw);

  const user = await prisma.$transaction(async (tx: any) => {
    const created = await tx.user.create({
      data: {
        username: pending.username,
        email: pending.email,
        passwordHash: pending.passwordHash,
        region: pending.region,
        accountLanguage: pending.language,
        agreedToTerms: pending.agreedToTerms,
        agreedToPrivacy: pending.agreedToPrivacy,
        profile: { create: {} },
        wallet: { create: {} },
        userPoints: { create: {} },
      },
    });
    return created;
  });

  await redis.del(pendingRegKey(email));
  return issueTokenPair(user.id, user.role, false, deviceMeta);
};

// ------------------------------------------------------------------- Login
const loginWithCredentials = async (payload: TLoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "AUTH_INVALID_CREDENTIALS");
  }

  if (user.status === "Banned") {
    throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_BANNED");
  }
  if (user.status === "Suspended") {
    throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_SUSPENDED");
  }

  const passwordMatches = await bcrypt.compare(
    payload.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    throw new AppError(httpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
  }

  await otpService.sendOtp(user.email);
  const pendingToken = authUtils.signPendingToken({ email: user.email });

  return { pendingToken, stayLoggedIn: !!payload.stayLoggedIn };
};

// -------------------------------------------------------- Verify Login OTP
const verifyLoginOtp = async (
  pendingToken: string,
  otp: string,
  stayLoggedIn: boolean,
  deviceMeta: TDeviceMeta,
) => {
  const { email } = authUtils.verifyPendingToken(pendingToken);
  await otpService.verifyOtp(email, otp);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return issueTokenPair(user.id, user.role, stayLoggedIn, deviceMeta);
};

// --------------------------------------------------------- Token issuance
const issueTokenPair = async (
  userId: string,
  role: string,
  stayLoggedIn: boolean,
  deviceMeta: TDeviceMeta,
) => {
  const accessToken = authUtils.signAccessToken({ userId, role });
  const refreshToken = authUtils.signRefreshToken(
    { userId, role },
    stayLoggedIn,
  );

  // one row per device/login — this IS the "active sessions" list (see getActiveSessions below)
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(
        Date.now() + (stayLoggedIn ? 30 : 1) * 24 * 60 * 60 * 1000,
      ),
      ipAddress: deviceMeta.ipAddress,
      userAgent: deviceMeta.userAgent,
      deviceName: deviceMeta.deviceName,
      deviceType: deviceMeta.deviceType,
    },
  });

  // bump user.lastActiveAt + lastLoginIp snapshot on the User row itself,
  // useful for admin panel "last seen from" without joining refresh_tokens
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });

  return { accessToken, refreshToken };
};

// ------------------------------------------------------------------ Refresh
const refreshAccessToken = async (token: string, deviceMeta: TDeviceMeta) => {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
  }

  const decoded = authUtils.verifyRefreshToken(token);

  // rotate: revoke old row, issue a new one carrying the same device identity forward
  // (IP can shift slightly on mobile networks — we just re-capture the latest one)
  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(decoded.userId, decoded.role, true, deviceMeta);
};

// ------------------------------------------------------- Active sessions list
// GET /api/auth/sessions — "which devices am I logged in on"
const getActiveSessions = async (userId: string) => {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      ipAddress: true,
      deviceName: true,
      deviceType: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { lastUsedAt: "desc" },
  });
};

// DELETE /api/auth/sessions/:id — force-logout one specific device
const revokeSession = async (userId: string, sessionId: string) => {
  const session = await prisma.refreshToken.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (session.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "Not your session");
  }

  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
};

// -------------------------------------------------------------------- Logout
const logout = async (token: string) => {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revokedAt: new Date() },
  });
};

// ---------------------------------------------------------- Forgot / Reset
const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // don't leak account existence

  const token = uuidv4();
  await redis.set(
    resetTokenKey(token),
    user.id,
    "EX",
    config.redis.reset_token_ttl_seconds,
  );
  await sendResetPasswordEmail(email, token);
};

const resetPassword = async (token: string, newPassword: string) => {
  const userId = await redis.get(resetTokenKey(token));
  if (!userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Reset token invalid or expired",
    );
  }

  const passwordHash = await bcrypt.hash(
    newPassword,
    config.jwt.bcrypt_salt_rounds,
  );

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // invalidate all sessions on password change
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await redis.del(resetTokenKey(token));
};

export const authService = {
  registerIntoDB,
  verifyRegisterOtp,
  loginWithCredentials,
  verifyLoginOtp,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getActiveSessions,
  revokeSession,
};
