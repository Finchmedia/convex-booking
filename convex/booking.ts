import { components } from "./_generated/api";
import { makeBookingAPI } from "../packages/convex-booking/src/client";

export const {
  // ============================================
  // EVENT TYPES
  // ============================================
  getEventType,
  getEventTypeBySlug,
  listEventTypes,
  createEventType,
  updateEventType,
  deleteEventType,
  toggleEventTypeActive,

  // ============================================
  // AVAILABILITY
  // ============================================
  getAvailability,
  getMonthAvailability,
  getDaySlots,

  // ============================================
  // BOOKINGS
  // ============================================
  createReservation,
  createBooking,
  getBooking,
  getBookingByUid,
  listBookings,
  cancelReservation,

  // ============================================
  // RESOURCES
  // ============================================
  getResource,
  listResources,
  createResource,
  updateResource,
  deleteResource,
  toggleResourceActive,

  // ============================================
  // RESOURCE ↔ EVENT TYPE MAPPING
  // ============================================
  getEventTypesForResource,
  getResourcesForEventType,
  getResourceIdsForEventType,
  getEventTypeIdsForResource,
  hasResourceEventTypeLink,
  linkResourceToEventType,
  unlinkResourceFromEventType,
  setResourcesForEventType,
  setEventTypesForResource,

  // ============================================
  // SCHEDULES
  // ============================================
  getSchedule,
  listSchedules,
  getDefaultSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,

  // ============================================
  // DATE OVERRIDES
  // ============================================
  listDateOverrides,
  createDateOverride,
  deleteDateOverride,
  getEffectiveAvailability,

  // ============================================
  // MULTI-RESOURCE BOOKING
  // ============================================
  checkMultiResourceAvailability,
  createMultiResourceBooking,
  getBookingWithItems,
  cancelMultiResourceBooking,

  // ============================================
  // HOOKS
  // ============================================
  registerHook,
  unregisterHook,
  transitionBookingState,
  getBookingHistory,

  // ============================================
  // PRESENCE
  // ============================================
  heartbeat,
  leave,
  getPresence,
  getDatePresence,
  getActivePresenceCount,
} = makeBookingAPI(components.booking);
