import { components } from "./_generated/api";
import { makeBookingAPI } from "../packages/convex-booking/src/client";

// The destructure pattern works because makeBookingAPI uses direct queryGeneric/mutationGeneric
// (following the ProseMirror sync component pattern)
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
  getEffectiveAvailability,

  // ============================================
  // DATE OVERRIDES
  // ============================================
  listDateOverrides,
  createDateOverride,
  deleteDateOverride,

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
