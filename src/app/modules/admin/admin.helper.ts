import { Prisma } from "../../../../generated/prisma/client";

/**
 * Writes one ActivityLog row for an admin/moderator action.
 * Call from inside the same $transaction as the mutation it's logging
 * (pass `tx`), never from the controller — keeps controllers uniform.
 */
export const logActivity = (
  tx: Prisma.TransactionClient,
  params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: any;
  },
) =>
  tx.activityLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
    },
  });
