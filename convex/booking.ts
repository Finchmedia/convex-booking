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
  heartbeat,     // Presence
  leave,         // Presence
  getPresence,   // Presence
} = makeBookingAPI(components.booking);
