import { ConvexError } from "convex/values";

/**
 * Fallback copy per error code thrown by convex/public.ts. The server already
 * sends a readable `data.message` with every code; this map only covers the
 * case where a code arrives without one.
 */
const CODE_MESSAGES: Record<string, string> = {
  SLOT_NOT_AVAILABLE: "This time slot is no longer available — please pick another one.",
  SLOT_NOT_ALIGNED: "Please pick one of the offered start times.",
  IN_PAST: "That time has already passed — please pick a later slot.",
  TOO_SOON: "That slot is too close to now — please pick a later one.",
  TOO_FAR_AHEAD: "That date is beyond the booking horizon.",
  ALREADY_STARTED: "This booking has already started and can no longer be changed.",
  INVALID_DURATION: "This duration is not offered for this event type.",
  INVALID_RANGE: "End time must be after start time.",
  INVALID_TIME: "Invalid time.",
  INVALID_TIMEZONE: "Invalid timezone.",
  INVALID_EMAIL: "Please enter a valid email address.",
  NAME_REQUIRED: "Please enter your name.",
  NAME_TOO_LONG: "Name is too long.",
  PHONE_TOO_LONG: "Phone number is too long.",
  NOTES_TOO_LONG: "Notes are too long.",
  RESERVED_REASON: "That cancellation reason is reserved.",
  RATE_LIMITED: "Too many bookings for this email — please try again in a few minutes.",
  SAME_SLOT: "The booking is already at that time.",
  INVALID_STATE: "This booking can no longer be changed.",
  INVALID_TOKEN: "Invalid booking link.",
  NOT_FOUND: "Booking not found.",
  EVENT_TYPE_NOT_FOUND: "This event type no longer exists.",
  EVENT_TYPE_INACTIVE: "This event type is no longer available for booking.",
  RESOURCE_NOT_FOUND: "This resource no longer exists.",
  RESOURCE_INACTIVE: "This resource is no longer available.",
  RESOURCE_NOT_STANDALONE: "This resource can only be booked as an add-on.",
  NOT_LINKED: "This resource is not available for this event type.",
  TOO_MANY_SLOTS: "Too many slots selected.",
  UNAUTHENTICATED: "Sign in as guest admin to use the dashboard.",
  BOOKING_FAILED: "Booking failed — please try again.",
};

/**
 * Readable message for an error thrown by a Convex function.
 *
 * `ConvexError.message` is the wrapped "[CONVEX M(...)] Uncaught ConvexError: {…}"
 * string, and plain server errors arrive as "Server Error" in production, so
 * UI code should never show `error.message` directly. This reads
 * `error.data.message` / `error.data.code` instead and falls back to `fallback`.
 */
export function convexErrorMessage(
  error: unknown,
  fallback = "Something went wrong — please try again."
): string {
  if (error instanceof ConvexError) {
    const data = error.data as
      | { code?: string; message?: string }
      | string
      | undefined;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message;
      }
      if (typeof data.code === "string" && CODE_MESSAGES[data.code]) {
        return CODE_MESSAGES[data.code];
      }
    }
  }
  return fallback;
}

/** The `code` of a ConvexError, or null for any other error. */
export function convexErrorCode(error: unknown): string | null {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: string } | undefined;
    if (data && typeof data === "object" && typeof data.code === "string") {
      return data.code;
    }
  }
  return null;
}
