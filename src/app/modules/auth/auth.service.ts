import httpStatus from "http-status";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import bcrypt from "bcrypt";
import config from "../../config";
import { Role, User } from "../../../../generated/prisma/client";
import { createToken, verifyToken } from "./auth.utils";
import { generateOtp } from "../../utils/otpGenerator";
import moment from "moment";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { sendEmail } from "../../utils/mailSender";
import { SocialLoginPayload } from "./auth.interface";

const createAccountIntoDB = async (
  payload: Omit<User, "id" | "createdAt" | "updatedAt"> & {
    password: string;
    role: Role;
  },
) => {
  const { name, email, password, role } = payload;
  const existAccount = await prisma.user.findFirst({
    where: { email },
    include: { auth: true },
  });

  if (existAccount && existAccount.auth?.isVerified) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Account already exists with this email",
    );
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.jwt.bcrypt_slot_rounds!),
  );

  const account = await prisma.user.upsert({
    where: { email: email! },

    update: {
      name,
      email,
      auth: {
        upsert: {
          update: {
            email: email!,
            password: hashedPassword,
          },
          create: {
            role,
            email: email!,
            password: hashedPassword,
          },
        },
      },
    },

    create: {
      name,
      email,
      auth: {
        create: {
          role,
          email: email!,
          password: hashedPassword,
        },
      },
    },

    include: {
      auth: true,
    },
  });

  return account;
};

const accountLoginFromDB = async (payload: {
  email: string;
  password: string;
  fcmToken?: string;
}) => {
  const user = await prisma.user.findFirst({
    where: {
      email: payload?.email,
      isGuest: false,
    },
    include: { auth: true },
  });

  if (!user) {
    // If user not found, throw error
    throw new AppError(httpStatus.NOT_FOUND, "Account not found");
  } else {
    if (!user?.auth?.isActive) {
      throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
    }

    if (user?.auth?.isDeleted) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account is deleted, contact admin",
      );
    }

    if (!user?.auth?.isVerified) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Your account is not verified",
      );
    }

    // Handle verify password
    const passwordMatched = await bcrypt.compare(
      payload?.password,
      user?.auth?.password,
    );

    if (!passwordMatched) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Please check your credentials and try again",
      );
    }

    // Update FCM token if provided
    let updatedUser = user as User;
    if (payload?.fcmToken) {
      updatedUser = await prisma.user.update({
        where: { email: payload?.email },
        data: { fcmToken: payload.fcmToken },
      });
    }
  }

  //update last login time
  await prisma.auth.update({
    where: { userId: user?.id },
    data: { last_login: new Date() },
  });

  const jwtPayload: { userId: string; role: Role; email: string } = {
    userId: user?.id as string,
    role: user?.auth?.role,
    email: user.email,
  };

  const role = user?.auth?.role;
  const roles = user?.auth?.roles;
  // console.log({ roles });

  const userDoc = user as any;
  delete userDoc.auth;

  const accessToken = createToken(
    jwtPayload,
    config.jwt.access_secret as string,
    60 * 60 * 24 * 7, //7 days
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt.refresh_secret as string,
    60 * 60 * 24 * 30, // 30 days
  );

  return {
    user: { ...userDoc, role, roles },
    accessToken,
    refreshToken,
  };
};

// Change password
const changePasswordFromDB = async (
  id: string,
  payload: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
) => {
  const user = await prisma.user.findFirst({
    where: { id },
    include: { auth: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const passwordMatched = await bcrypt.compare(
    payload?.oldPassword,
    user?.auth?.password as string,
  );

  if (!passwordMatched) {
    throw new AppError(httpStatus.FORBIDDEN, "Old password does not match");
  }
  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password and confirm password do not match",
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.jwt.bcrypt_slot_rounds!),
  );

  const result = await prisma.user.update({
    where: { id },
    data: {
      auth: {
        update: {
          data: {
            password: hashedPassword,
            passwordChangedAt: new Date(),
          },
        },
      },
    },
  });

  return result;
};

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email },
    include: { auth: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const jwtPayload = {
    userId: user?.id,
    role: user?.auth?.role,
  };

  const token = jwt.sign(jwtPayload, config.jwt.access_secret as Secret, {
    expiresIn: "5m",
  });

  const currentTime = new Date();
  const otp = generateOtp();
  const expiresAt = moment(currentTime).add(5, "minute").toDate();

  await prisma.user.update({
    where: { id: user?.id },
    data: {
      auth: {
        update: {
          otp,
          expiredAt: expiresAt,
          otp_status: false,
        },
      },
    },
  });

  // ---------- Send Forgot Password OTP ----------
  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
      <h2 style="color: #e53935;">Reset Your Password</h2>

      <p>Hello ${user.name || "User"},</p>

      <p>We received a request to reset your password.</p>

      <p>Please use the OTP below to continue:</p>

      <div style="margin: 20px 0; text-align: center;">
        <span style="
          display: inline-block;
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 6px;
          padding: 14px 24px;
          background: #f5f5f5;
          border-radius: 8px;
          color: #e53935;
        ">
          ${otp}
        </span>
      </div>

      <p>This OTP is valid for <strong>5 minutes</strong>.</p>

      <p>If you did not request a password reset, please ignore this email. Your account remains secure.</p>

      <br />

      <p>Regards,<br /><strong>Your Makachi Connect App</strong></p>
    </div>
  `;
  await sendEmail(user.email!, "Forgot Password OTP Code", emailTemplate);

  return { email, token };
};

const resetPassword = async (
  token: string,
  payload: { newPassword: string; confirmPassword: string },
) => {
  let decode;
  try {
    decode = jwt.verify(
      token,
      config.jwt.access_secret as string,
    ) as JwtPayload;
  } catch (err) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Session has expired. Please try again",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: decode?.userId },
    select: {
      auth: true,
    },
  });

  if (!user || !user?.auth) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const passwordMatched = await bcrypt.compare(
    payload?.newPassword,
    user?.auth?.password as string,
  );

  if (passwordMatched) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The password already exists in your account",
    );
  }

  if (payload?.newPassword !== payload?.confirmPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password and confirm password do not match",
    );
  }

  if (new Date() > user?.auth?.expiredAt) {
    throw new AppError(httpStatus.FORBIDDEN, "Session has expired");
  }
  if (!user?.auth?.otp_status) {
    throw new AppError(httpStatus.FORBIDDEN, "OTP is not verified yet");
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.jwt.bcrypt_slot_rounds!),
  );

  const result = await prisma.user.update({
    where: { id: decode?.userId },
    data: {
      auth: {
        update: {
          password: hashedPassword,
          otp: "0",
          otp_status: true,
        },
      },
    },
  });

  return result;
};

const refreshToken = async (token: string) => {
  // Checking if the given token is valid
  const decoded = verifyToken(token, config.jwt.refresh_secret as string);
  const { userId } = decoded;
  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: { auth: true },
  });

  if (!user || !user?.auth) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const isDeleted = user?.auth?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "This user is deleted");
  }

  const jwtPayload = {
    userId: user?.id,
    role: user.auth?.role,
    email: user.email,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt.access_secret as string,
    60 * 60 * 24 * 7, //7 days
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt.refresh_secret as string,
    60 * 60 * 24 * 30, //30 days
  );

  return {
    accessToken,
    refreshToken,
  };
};

const socialLogin = async (data: SocialLoginPayload) => {
  const { provider, providerId, email, name, profileImg } = data;

  // ─── 1. Find existing user by email ──────────────────────────────────────
  let user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isDeleted: true,
      isGuest: true,
      auth: {
        select: {
          id: true,
          role: true,
          isActive: true,
          isDeleted: true,
          isVerified: true,
        },
      },
      picture: {
        select: { url: true },
      },
    },
  });

  // ─── 2. If user exists but is deleted/banned ──────────────────────────────
  if (user?.isDeleted || user?.auth?.isDeleted) {
    throw new Error(
      "Your account has been deactivated. Please contact support.",
    );
  }

  if (user?.auth && !user.auth.isActive) {
    throw new Error("Your account is suspended. Please contact support.");
  }

  // ─── 3. Create new user if not found ─────────────────────────────────────
  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          socialLogin: true,
          auth: {
            create: {
              email,
              password: `${provider}_${providerId}_social`, // non-usable password
              role: Role.User,
              isVerified: true, // social = pre-verified
              isActive: true,
            },
          },
          ...(profileImg && {
            picture: {
              create: {
                url: profileImg,
                key: `social_${provider}_${providerId}`,
              },
            },
          }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          isDeleted: true,
          isGuest: true,
          auth: {
            select: {
              id: true,
              role: true,
              isActive: true,
              isDeleted: true,
              isVerified: true,
            },
          },
          picture: {
            select: { url: true },
          },
        },
      });

      return newUser;
    });
  } else {
    // ─── 4. Existing user — update profile pic if missing & mark socialLogin ─
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user!.id },
        data: { socialLogin: true },
      });

      if (profileImg && !user!.picture) {
        await tx.profilePicture.create({
          data: {
            url: profileImg,
            key: `social_${provider}_${providerId}`,
            userId: user!.id,
          },
        });
      }

      // Update last_login
      await tx.auth.update({
        where: { userId: user!.id },
        data: { last_login: new Date() },
      });
    });
  }

  // ─── 5. Generate tokens ───────────────────────────────────────────────────
  const jwtPayload = {
    userId: user.id,
    role: user.auth!.role,
    email: user.email,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt.access_secret as string,
    60 * 60 * 24 * 7, //7 days
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt.refresh_secret as string,
    60 * 60 * 24 * 30, // 30 days
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.auth!.role,
      isVerified: user.auth!.isVerified,
      profileImg: user.picture?.url ?? profileImg ?? null,
    },
  };
};

const switchAccount = async (userId: string, targetRole: Role) => {
  const auth = await prisma.auth.findUnique({
    where: { userId },
  });
  // console.log("auth__", auth);

  if (!auth) {
    throw new AppError(httpStatus.NOT_FOUND, "Auth not found");
  }

  // এই user এর ঐ role exist or not exist check
  if (!auth.roles.includes(targetRole)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this account type",
    );
  }

  // active role update
  await prisma.auth.update({
    where: { userId },
    data: { role: targetRole },
  });

  // new token issue
  const jwtPayload = { userId, role: targetRole, email: auth.email };

  const accessToken = createToken(
    jwtPayload,
    config.jwt.access_secret as string,
    60 * 60 * 24 * 7,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt.refresh_secret as string,
    60 * 60 * 24 * 30,
  );

  return {
    activeRole: targetRole,
    accessToken,
    refreshToken,
  };
};

// Vendor upgrade request (User → Vendor upgrade)
const upgradeToVendor = async (userId: string) => {
  const auth = await prisma.auth.findUnique({
    where: { userId },
  });

  if (!auth) {
    throw new AppError(httpStatus.NOT_FOUND, "Auth not found");
  }

  if (auth.roles.includes(Role.Vendor)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You are Already a vendor, no need to upgrade.",
    );
  }

  await prisma.auth.update({
    where: { userId },
    data: {
      roles: { push: Role.Vendor },
    },
  });

  return { message: "Vendor access granted" };
};

export const authService = {
  createAccountIntoDB,
  accountLoginFromDB,
  changePasswordFromDB,
  forgotPassword,
  resetPassword,
  refreshToken,
  socialLogin,

  switchAccount,
  upgradeToVendor,
};
