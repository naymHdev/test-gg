import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import AppError from "../../error/AppError";
import config from "../../config";
import { prisma } from "../../../shared/prisma";
import { redis } from "../../../shared/redis";
import { otpService } from "../otp/otp.service";
import { authUtils } from "./auth.utils";
import {
  sendResetPasswordEmail,
  sendPasswordChangedEmail,
  sendTwoFactorToggledEmail,
} from "../../utils/mailSender";
import { TLoginInput, TRegisterInput } from "./auth.interface";
import { TDeviceMeta } from "../../helpers/deviceMeta";
import { paginate, PaginationQuery } from "../../helpers/paginate";
import { OAuth2Client } from "google-auth-library";

const pendingRegKey = (email: string) => `pending_registration:${email}`;
const resetTokenKey = (token: string) => `reset_token:${token}`;

const googleClient = new OAuth2Client(config.google.client_id);

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

  await redis.set(
    pendingRegKey(payload.email),
    JSON.stringify({ ...payload, passwordHash }),
    "EX",
    900,
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
const loginWithCredentials = async (
  payload: TLoginInput,
  deviceMeta: TDeviceMeta,
) => {
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
  if (user.status === "Deleted") {
    throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_DELETED");
  }

  const passwordMatches = await bcrypt.compare(
    payload.password,
    user.passwordHash as string,
  );
  if (!passwordMatches) {
    throw new AppError(httpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
  }

  // "Deactivate Account" is meant to be temporary — logging back in with the
  // correct credentials is treated as the reactivation action, same idea as
  // most consumer apps (no separate "reactivate" endpoint needed)
  if (user.status === "Deactivated") {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "Active" },
    });
  }

  // Login already requires an emailed OTP by default; twoFactorEnabled just
  // controls whether that step can be skipped once credentials are verified
  if (!user.twoFactorEnabled) {
    const tokens = await issueTokenPair(
      user.id,
      user.role,
      !!payload.stayLoggedIn,
      deviceMeta,
    );
    return { twoFactorRequired: false as const, ...tokens };
  }

  await otpService.sendOtp(user.email);
  const pendingToken = authUtils.signPendingToken({ email: user.email });

  return {
    twoFactorRequired: true as const,
    pendingToken,
    stayLoggedIn: !!payload.stayLoggedIn,
  };
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

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });

  // reuse ActivityLog (actorId = the user themselves) as the "Login History"
  // list instead of adding a dedicated table — same row shape admin actions
  // already use, just self-targeted
  await prisma.activityLog.create({
    data: {
      actorId: userId,
      action: "login",
      targetType: "User",
      targetId: userId,
      metadata: {
        ipAddress: deviceMeta.ipAddress,
        deviceName: deviceMeta.deviceName,
        deviceType: deviceMeta.deviceType,
      },
    },
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

  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(decoded.userId, decoded.role, true, deviceMeta);
};

// ------------------------------------------------------- Active sessions list
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
  if (!user) return;

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
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await redis.del(resetTokenKey(token));
};

// ------------------------------------------------------ Change password
const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const passwordMatches = await bcrypt.compare(
    currentPassword,
    user.passwordHash as string,
  );
  if (!passwordMatches) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Current password is incorrect",
    );
  }

  const passwordHash = await bcrypt.hash(
    newPassword,
    config.jwt.bcrypt_salt_rounds,
  );

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  sendPasswordChangedEmail(user.email).catch(() => null);
};

// ------------------------------------------------------ Two-factor toggle
const toggleTwoFactor = async (userId: string, enabled: boolean) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: enabled },
  });

  sendTwoFactorToggledEmail(user.email, enabled).catch(() => null);
  return { twoFactorEnabled: user.twoFactorEnabled };
};

// ------------------------------------------------------- Login history
const getLoginHistory = async (userId: string, options: PaginationQuery) => {
  return paginate({
    model: prisma.activityLog,
    where: { actorId: userId, action: "login" },
    pagination: options,
    defaults: { sortBy: "createdAt", sortOrder: "desc" },
  });
};

const loginWithGoogle = async (
  payload: {
    idToken: string;
    region?: string;
    language?: string;
    agreedToTerms?: boolean;
    agreedToPrivacy?: boolean;
    stayLoggedIn?: boolean;
  },
  deviceMeta: TDeviceMeta,
) => {

  const ticket = await googleClient.verifyIdToken({
    idToken: payload.idToken,
    audience: config.google.client_id,
  });

  const googlePayload = ticket.getPayload();
  if (!googlePayload?.email) {
    throw new AppError(httpStatus.UNAUTHORIZED, "AUTH_INVALID_GOOGLE_TOKEN");
  }
  if (!googlePayload.email_verified) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "AUTH_GOOGLE_EMAIL_NOT_VERIFIED",
    );
  }

  const { sub: googleId, email, name } = googlePayload;

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  if (user) {
    if (user.status === "Banned") {
      throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_BANNED");
    }
    if (user.status === "Suspended") {
      throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_SUSPENDED");
    }
    if (user.status === "Deleted") {
      throw new AppError(httpStatus.FORBIDDEN, "AUTH_ACCOUNT_DELETED");
    }

    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, authProvider: "Google" },
      });
    }

    if (user.status === "Deactivated") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: "Active" },
      });
    }
  } else {
    if (!payload.region || !payload.language) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "AUTH_GOOGLE_SIGNUP_REQUIRES_REGION_LANGUAGE",
      );
    }
    if (!payload.agreedToTerms || !payload.agreedToPrivacy) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "AUTH_MUST_AGREE_TERMS_PRIVACY",
      );
    }

    const username = await authUtils.generateUniqueUsername(
      name || email.split("@")[0],
    );

    user = await prisma.$transaction(async (tx: any) => {
      return tx.user.create({
        data: {
          username,
          email,
          googleId,
          authProvider: "Google",
          region: payload.region,
          accountLanguage: payload.language,
          agreedToTerms: payload.agreedToTerms,
          agreedToPrivacy: payload.agreedToPrivacy,
          profile: { create: {} },
          wallet: { create: {} },
          userPoints: { create: {} },
        },
      });
    });
  }

  return issueTokenPair(
    user?.id!,
    user?.role!,
    !!payload.stayLoggedIn,
    deviceMeta,
  );
};

export const authService = {
  registerIntoDB,
  verifyRegisterOtp,
  loginWithCredentials,
  loginWithGoogle,
  verifyLoginOtp,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getActiveSessions,
  revokeSession,
  changePassword,
  toggleTwoFactor,
  getLoginHistory,
};
