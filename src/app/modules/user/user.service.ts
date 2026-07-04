import httpStatus from "http-status";
import {
  BookingStatus,
  ProfilePicture,
  User,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../shared/prisma";
import AppError from "../../error/AppError";
import {
  buildMeta,
  PaginatedResult,
  PaginationQuery,
  parsePagination,
} from "../../helpers/paginate";
import { ExploreContent } from "../../interface/contents.interface";
import { formatBookingsForCard } from "../../helpers/formatBookingsForCard";

const myAccount = async (myId: string) => {
  const [profileImg, user] = await Promise.all([
    prisma.profilePicture.findUnique({
      where: { userId: myId },
      select: {
        id: true,
        url: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: myId },
      include: {
        auth: true,
        subscription: true,
      },
    }),
  ]);

  if (!user) return null;

  return {
    ...user,
    profile: profileImg || null,
  };
};

const updateMyProfile = async (myId: string, data: Partial<User>) => {
  const result = await prisma.user.update({
    where: { id: myId },
    data,
  });
  return result;
};

const updateProfileImg = async (data: ProfilePicture) => {
  const result = await prisma.profilePicture.upsert({
    where: {
      userId: data.userId,
    },
    update: {
      url: data.url,
      key: data.key,
    },
    create: {
      userId: data.userId,
      url: data.url,
      key: data.key,
    },
  });

  return result;
};

const updateMyLocation = async (data: Partial<User>, userId: string) => {
  const { latitude, longitude, address, locationType } = data;

  if (!latitude || !longitude || !address) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "latitude, longitude and address are required together",
    );
  }

  const payload = {
    latitude: parseFloat(latitude as any),
    longitude: parseFloat(longitude as any),
    address,
    locationType,
  };

  const result = await prisma.user.update({
    where: { id: userId },
    data: payload,
  });

  return result;
};

const exploreAllContentsFromDB = async (
  userId: string,
  options: PaginationQuery,
): Promise<PaginatedResult<ExploreContent>> => {
  const { page, limit, skip } = parsePagination(options);

  const baseWhere = { isDeleted: false, isActive: true };

  const [venues, events, tickets] = await Promise.all([
    prisma.venue.findMany({ where: baseWhere }),
    prisma.event.findMany({ where: baseWhere }),
    prisma.ticket.findMany({ where: baseWhere }),
  ]);

  const allContents: ExploreContent[] = [
    ...venues.map((item) => ({ ...item, contentType: "venue" as const })),
    ...events.map((item) => ({ ...item, contentType: "event" as const })),
    ...tickets.map((item) => ({ ...item, contentType: "ticket" as const })),
  ];

  const total = allContents.length;
  const data = allContents.slice(skip, skip + limit);

  return {
    data,
    meta: buildMeta(page, limit, total),
  };
};

const myRecentBookings = async (userId: string, status?: BookingStatus) => {
  const statusFilter = status ? { status } : {};

  const [venueBookings, eventBookings, ticketPurchases] = await Promise.all([
    prisma.venueBooking.findMany({
      where: { userId, ...statusFilter },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            price: true,
            location: true,
            images: true,
            feedbacks: {
              where: { isDeleted: false, isActive: true },
              select: { rating: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.eventBooking.findMany({
      where: { userId, ...statusFilter },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
            location: true,
            images: true,
            feedbacks: {
              where: { isDeleted: false, isActive: true },
              select: { rating: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.ticketPurchase.findMany({
      where: { userId, ...statusFilter },
      include: { ticket: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const merged = [...venueBookings, ...eventBookings];
  const formatted = formatBookingsForCard(merged);

  return formatted;
};

const cancelBooking = async (
  bookingId: string,
  userId: string,
  reason: string,
  note?: string,
) => {
  const [eventBooking, venueBooking] = await Promise.all([
    prisma.eventBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true },
    }),
    prisma.venueBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true },
    }),
  ]);

  const booking = eventBooking ?? venueBooking;
  const model = eventBooking ? prisma.eventBooking : prisma.venueBooking;

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, "Booking not found");
  }

  if (booking.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to cancel this booking",
    );
  }

  if (
    [BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(
      // @ts-ignore
      booking.status as BookingStatus,
    )
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Booking is already ${booking.status.toLowerCase()}`,
    );
  }

  // Transaction — cancel + cancellation record both get created
  const [updated] = await prisma.$transaction([
    (model as any).update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    }),
    prisma.bookingCancellation.create({
      data: {
        userId,
        reason,
        note: note || null,
        isActive: true,
        isDeleted: false,
        ...(eventBooking
          ? { eventBookingId: bookingId }
          : { venueBookingId: bookingId }),
      },
    }),
  ]);

  return updated;
};

export const userService = {
  myAccount,
  updateMyProfile,
  updateProfileImg,
  updateMyLocation,
  exploreAllContentsFromDB,
  myRecentBookings,
  cancelBooking,
};
