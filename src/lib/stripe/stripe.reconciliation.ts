import httpStatus from "http-status";
import {
  BookingStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "../../../generated/prisma/client";
import AppError from "../../app/error/AppError";
import { prisma } from "../../shared/prisma";

type TransactionSummary = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  ticketPurchaseId: string | null;
  eventBookingId: string | null;
  venueBookingId: string | null;
};

const transactionSelect = {
  id: true,
  type: true,
  status: true,
  ticketPurchaseId: true,
  eventBookingId: true,
  venueBookingId: true,
} satisfies Prisma.TransactionSelect;

const markBookingCompleted = async (
  tx: Prisma.TransactionClient,
  transaction: TransactionSummary,
) => {
  switch (transaction.type) {
    case TransactionType.TICKET_PURCHASE: {
      if (!transaction.ticketPurchaseId) return;

      const purchase = await tx.ticketPurchase.findUnique({
        where: { id: transaction.ticketPurchaseId },
        select: {
          id: true,
          status: true,
          isDeleted: true,
          isActive: true,
          quantity: true,
          ticketId: true,
        },
      });

      if (
        !purchase ||
        purchase.isDeleted ||
        !purchase.isActive ||
        purchase.status === BookingStatus.CANCELLED ||
        purchase.status === BookingStatus.COMPLETED
      ) {
        return;
      }

      const ticket = await tx.ticket.findUnique({
        where: { id: purchase.ticketId },
        select: {
          id: true,
          totalSeats: true,
          soldSeats: true,
          isDeleted: true,
          isActive: true,
        },
      });

      if (!ticket || ticket.isDeleted || !ticket.isActive) {
        return;
      }

      const remainingSeats = ticket.totalSeats - ticket.soldSeats;
      if (purchase.quantity > remainingSeats) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Ticket seats are no longer available for this payment.",
        );
      }

      await tx.ticketPurchase.update({
        where: { id: purchase.id },
        data: {
          status: BookingStatus.COMPLETED,
          isActive: false,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          soldSeats: { increment: purchase.quantity },
          bookingsCount: { increment: 1 },
        },
      });

      return;
    }

    case TransactionType.EVENT_BOOKING: {
      if (!transaction.eventBookingId) return;

      await tx.eventBooking.updateMany({
        where: {
          id: transaction.eventBookingId,
          status: { not: BookingStatus.COMPLETED },
        },
        data: { status: BookingStatus.COMPLETED },
      });

      return;
    }

    case TransactionType.VENUE_BOOKING: {
      if (!transaction.venueBookingId) return;

      await tx.venueBooking.updateMany({
        where: {
          id: transaction.venueBookingId,
          status: { not: BookingStatus.COMPLETED },
        },
        data: { status: BookingStatus.COMPLETED },
      });

      return;
    }

    default:
      return;
  }
};

const findTransactionForReconciliation = async (params: {
  transactionId?: string | null;
  stripePaymentIntentId?: string | null;
}) => {
  const { transactionId, stripePaymentIntentId } = params;

  if (transactionId) {
    return prisma.transaction.findUnique({
      where: { id: transactionId },
      select: transactionSelect,
    });
  }

  if (stripePaymentIntentId) {
    return prisma.transaction.findFirst({
      where: { stripePaymentIntentId },
      select: transactionSelect,
    });
  }

  return null;
};

export const reconcileSuccessfulTransaction = async (params: {
  transactionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
}) => {
  const { transactionId, stripePaymentIntentId, stripeChargeId } = params;

  const existingTransaction = await findTransactionForReconciliation({
    transactionId,
    stripePaymentIntentId,
  });

  if (!existingTransaction) return null;

  await prisma.$transaction(async (tx) => {
    const transactionUpdate: Prisma.TransactionUpdateInput = {
      status: TransactionStatus.SUCCEEDED,
    };

    if (stripePaymentIntentId) {
      transactionUpdate.stripePaymentIntentId = stripePaymentIntentId;
    }

    if (stripeChargeId) {
      transactionUpdate.stripeChargeId = stripeChargeId;
    }

    await tx.transaction.update({
      where: { id: existingTransaction.id },
      data: transactionUpdate,
    });

    await markBookingCompleted(tx, existingTransaction);
  });

  return prisma.transaction.findUnique({
    where: { id: existingTransaction.id },
  });
};

export const markTransactionFailed = async (params: {
  transactionId?: string | null;
  stripePaymentIntentId?: string | null;
}) => {
  const { transactionId, stripePaymentIntentId } = params;

  if (transactionId) {
    await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.FAILED,
        ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
      },
    });

    return;
  }

  if (stripePaymentIntentId) {
    await prisma.transaction.updateMany({
      where: {
        stripePaymentIntentId,
        status: TransactionStatus.PENDING,
      },
      data: { status: TransactionStatus.FAILED },
    });
  }
};
