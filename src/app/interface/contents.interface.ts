import { Event, Ticket, Venue } from "../../../generated/prisma/client";

export type VenueQuery = {
  searchTerm?: string;
  featured?: string; // "true"
  trending?: string; // "true"
  popular?: string; // "true"
  location?: string;
  priceRange?: string; // "0-100"
  dateRange?: string; // "2022-01-01-2022-12-31"
  venueId?: string;
};

export type FeedbackEntityType = "eventId" | "venueId" | "ticketId";

export type TicketQuery = {
  searchTerm?: string;
  today?: string; // "true" → date === today
  upcoming?: string; // "true" → date > today
  free?: string; // "true" → price === 0
  vip?: string; // "true" → type === VIP
  premium?: string; // "true" → type === PREMIUM
  location?: string;
  dateRange?: string; // "2022-01-01-2022-12-31"
  priceRange?: string; // "0-100"
  ticketId?: string;
};

export type EventQuery = {
  searchTerm?: string;
  popular?: string; // "true" → sort by bookingsCount desc
  trending?: string; // "true" → sort by views desc
  location?: string;
  eventId?: string;
  priceRange?: string; // "0-100"
  dateRange?: string; // "2022-01-01-2022-12-31"
};

export type ContentType = "venue" | "event" | "ticket";

export type ExploreContent = (Venue | Event | Ticket) & {
  contentType: ContentType;
};

export type BookingFilterType =
  | "VENUE_BOOKING"
  | "EVENT_BOOKING"
  | "TICKET_PURCHASE"
  | "ALL";
