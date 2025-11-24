import { components } from "./_generated/api";
import { makeBookingAPI } from "../packages/convex-booking/src/client";

export const {
  getEventType,
  getAvailability,
  getMonthAvailability,
  getDaySlots,
  createReservation,
  createBooking, // New
  getBooking,    // New
  cancelReservation,
  createEventType, // Admin/Seed
  heartbeat,     // Presence
  leave,         // Presence
  getPresence,   // Presence
  getDatePresence, // Presence (NEW: Date-based presence query)
} = makeBookingAPI(components.booking);
