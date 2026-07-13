import {
  NotificationType,
  Prisma,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import { sendMulticastPush } from "../../../utils/fcm.helper";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// FCM's `data` payload must be flat string key/value pairs — this repo's
// Notification.data is a free-form Json column, so stringify on the way out.
const toStringData = (
  data: Record<string, unknown> | undefined,
): Record<string, string> | undefined => {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
};

// ─── DB write — always call this from inside the $transaction that performs
// the state change it's documenting (ban, warn, prize payout, etc.), the
// same way every module already does. This is a drop-in replacement for the
// repeated `tx.notification.create({ data: {...} })` pattern — same shape,
// just centralized so future changes (e.g. adding a field) happen once.
const createNotification = (
  tx: Prisma.TransactionClient,
  input: NotificationInput,
) =>
  tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as Prisma.InputJsonValue,
    },
  });

// ─── Push — call this AFTER the transaction that called createNotification
// has committed, same "fire-and-forget after commit" pattern already used
// for the ban email and the subscription invoice email. Never throws —
// a missing/misconfigured Firebase Admin or a network blip should never
// take down the request that triggered it.
const queuePush = async (
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> => {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (devices.length === 0) return;

    const results = await sendMulticastPush({
      tokens: devices.map((d) => d.token),
      title: payload.title,
      body: payload.body,
      data: toStringData(payload.data),
    });

    // Prune tokens Firebase reports as dead so the multicast list stays
    // clean without needing a separate background job.
    const deadTokens = results
      .filter(
        (r) =>
          !r.success &&
          (r.error?.includes("registration-token-not-registered") ||
            r.error?.includes("invalid-registration-token")),
      )
      .map((r) => r.token);

    if (deadTokens.length > 0) {
      await prisma.deviceToken
        .deleteMany({ where: { token: { in: deadTokens } } })
        .catch(() => null);
    }
  } catch {
    // Firebase not configured / transient failure — push is best-effort,
    // never let it affect the caller.
  }
};

// ─── Convenience wrapper for call sites that aren't already inside a
// $transaction (e.g. admin broadcast, anything outside an existing mutation).
// For call sites already inside a $transaction, use createNotification(tx, ...)
// for the DB write and call queuePush(...) yourself once the transaction commits.
const notifyUser = async (input: NotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as Prisma.InputJsonValue,
    },
  });

  queuePush(input.userId, {
    title: input.title,
    body: input.body,
    data: input.data,
  }).catch(() => null);

  return notification;
};

export const notificationHelper = {
  createNotification,
  queuePush,
  notifyUser,
};
