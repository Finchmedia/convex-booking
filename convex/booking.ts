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
  // ORGANIZATIONS
  // ============================================
  getOrganization,
  getOrganizationBySlug,
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,

  // ============================================
  // TEAMS
  // ============================================
  listTeams,
  createTeam,

  // ============================================
  // MEMBERS
  // ============================================
  listMembers,
  addMember,

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
} = makeBookingAPI(components.booking);
