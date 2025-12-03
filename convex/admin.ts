/**
 * Admin API
 *
 * All operations in this module require authentication and admin role.
 * This is the "Authorized" (yellow) zone from Ian's article.
 *
 * Pattern:
 * - adminQuery: Auth + role check for reads
 * - adminMutation: Auth + admin role for writes
 */
import { v } from "convex/values";
import { components } from "./_generated/api";
import { adminQuery, adminMutation } from "./functions";

// ============================================
// RESOURCES (Admin CRUD)
// ============================================

/**
 * List all resources (including inactive)
 */
export const listResources = adminQuery({
  args: {
    organizationId: v.string(),
    type: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.listResources, args);
  },
});

/**
 * Get a single resource
 */
export const getResource = adminQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.getResource, args);
  },
});

/**
 * Create a new resource
 */
export const createResource = adminMutation({
  args: {
    id: v.string(),
    organizationId: v.string(),
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    timezone: v.string(),
    quantity: v.optional(v.number()),
    isFungible: v.optional(v.boolean()),
    isStandalone: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resources.createResource,
      args
    );
  },
});

/**
 * Update an existing resource
 */
export const updateResource = adminMutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    timezone: v.optional(v.string()),
    quantity: v.optional(v.number()),
    isFungible: v.optional(v.boolean()),
    isStandalone: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resources.updateResource,
      args
    );
  },
});

/**
 * Delete a resource
 */
export const deleteResource = adminMutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resources.deleteResource,
      args
    );
  },
});

/**
 * Toggle resource active status
 */
export const toggleResourceActive = adminMutation({
  args: { id: v.string(), isActive: v.boolean() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resources.toggleResourceActive,
      args
    );
  },
});

// ============================================
// EVENT TYPES (Admin CRUD)
// ============================================

/**
 * List all event types (including inactive)
 */
export const listEventTypes = adminQuery({
  args: {
    organizationId: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.listEventTypes, args);
  },
});

/**
 * Get event type by ID
 */
export const getEventType = adminQuery({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getEventType, args);
  },
});

/**
 * Create a new event type
 */
export const createEventType = adminMutation({
  args: {
    id: v.string(),
    slug: v.string(),
    title: v.string(),
    lengthInMinutes: v.number(),
    lengthInMinutesOptions: v.optional(v.array(v.number())),
    slotInterval: v.optional(v.number()),
    description: v.optional(v.string()),
    timezone: v.string(),
    lockTimeZoneToggle: v.boolean(),
    locations: v.array(
      v.object({
        type: v.string(),
        address: v.optional(v.string()),
        public: v.optional(v.boolean()),
      })
    ),
    organizationId: v.optional(v.string()),
    scheduleId: v.optional(v.string()),
    bufferBefore: v.optional(v.number()),
    bufferAfter: v.optional(v.number()),
    minNoticeMinutes: v.optional(v.number()),
    maxFutureMinutes: v.optional(v.number()),
    requiresConfirmation: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.createEventType,
      args
    );
  },
});

/**
 * Update an existing event type
 */
export const updateEventType = adminMutation({
  args: {
    id: v.string(),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    lengthInMinutes: v.optional(v.number()),
    lengthInMinutesOptions: v.optional(v.array(v.number())),
    slotInterval: v.optional(v.number()),
    description: v.optional(v.string()),
    timezone: v.optional(v.string()),
    lockTimeZoneToggle: v.optional(v.boolean()),
    locations: v.optional(
      v.array(
        v.object({
          type: v.string(),
          address: v.optional(v.string()),
          public: v.optional(v.boolean()),
        })
      )
    ),
    scheduleId: v.optional(v.string()),
    bufferBefore: v.optional(v.number()),
    bufferAfter: v.optional(v.number()),
    minNoticeMinutes: v.optional(v.number()),
    maxFutureMinutes: v.optional(v.number()),
    requiresConfirmation: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.updateEventType,
      args
    );
  },
});

/**
 * Delete an event type
 */
export const deleteEventType = adminMutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.deleteEventType,
      args
    );
  },
});

/**
 * Toggle event type active status
 */
export const toggleEventTypeActive = adminMutation({
  args: { id: v.string(), isActive: v.boolean() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.toggleEventTypeActive,
      args
    );
  },
});

// ============================================
// RESOURCE ↔ EVENT TYPE MAPPING (Admin)
// ============================================

/**
 * Get resources linked to an event type
 */
export const getResourcesForEventType = adminQuery({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.getResourcesForEventType,
      args
    );
  },
});

/**
 * Get resource IDs for an event type
 */
export const getResourceIdsForEventType = adminQuery({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.getResourceIdsForEventType,
      args
    );
  },
});

/**
 * Get event types linked to a resource
 */
export const getEventTypesForResource = adminQuery({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.getEventTypesForResource,
      args
    );
  },
});

/**
 * Set resources for an event type (bulk update)
 */
export const setResourcesForEventType = adminMutation({
  args: {
    eventTypeId: v.string(),
    resourceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resource_event_types.setResourcesForEventType,
      args
    );
  },
});

/**
 * Link a resource to an event type
 */
export const linkResourceToEventType = adminMutation({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resource_event_types.linkResourceToEventType,
      args
    );
  },
});

/**
 * Unlink a resource from an event type
 */
export const unlinkResourceFromEventType = adminMutation({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.resource_event_types.unlinkResourceFromEventType,
      args
    );
  },
});

// ============================================
// SCHEDULES (Admin CRUD)
// ============================================

/**
 * List all schedules
 */
export const listSchedules = adminQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.schedules.listSchedules,
      args
    );
  },
});

/**
 * Get a schedule by ID
 */
export const getSchedule = adminQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.schedules.getSchedule, args);
  },
});

/**
 * Get the default schedule for an organization
 */
export const getDefaultSchedule = adminQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.schedules.getDefaultSchedule,
      args
    );
  },
});

/**
 * Create a new schedule
 */
export const createSchedule = adminMutation({
  args: {
    id: v.string(),
    organizationId: v.string(),
    name: v.string(),
    timezone: v.string(),
    isDefault: v.optional(v.boolean()),
    weeklyHours: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.schedules.createSchedule,
      args
    );
  },
});

/**
 * Update a schedule
 */
export const updateSchedule = adminMutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    weeklyHours: v.optional(
      v.array(
        v.object({
          dayOfWeek: v.number(),
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.schedules.updateSchedule,
      args
    );
  },
});

/**
 * Delete a schedule
 */
export const deleteSchedule = adminMutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.schedules.deleteSchedule,
      args
    );
  },
});

// ============================================
// DATE OVERRIDES (Admin)
// ============================================

/**
 * List date overrides for a schedule
 */
export const listDateOverrides = adminQuery({
  args: {
    scheduleId: v.string(),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.schedules.listDateOverrides, {
      scheduleId: args.scheduleId as any,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    });
  },
});

/**
 * Create a date override
 */
export const createDateOverride = adminMutation({
  args: {
    scheduleId: v.string(),
    date: v.string(),
    type: v.string(),
    customHours: v.optional(
      v.array(
        v.object({
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.schedules.createDateOverride,
      {
        scheduleId: args.scheduleId as any,
        date: args.date,
        type: args.type,
        customHours: args.customHours,
      }
    );
  },
});

/**
 * Delete a date override
 */
export const deleteDateOverride = adminMutation({
  args: { overrideId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.schedules.deleteDateOverride,
      {
        overrideId: args.overrideId as any,
      }
    );
  },
});

// ============================================
// BOOKINGS (Admin Management)
// ============================================

/**
 * List all bookings (admin view)
 */
export const listBookings = adminQuery({
  args: {
    organizationId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    status: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    eventTypeId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.listBookings, args);
  },
});

/**
 * Get booking details
 */
export const getBooking = adminQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBooking, {
      bookingId: args.bookingId as any,
    });
  },
});

/**
 * Transition booking state (confirm, cancel, complete)
 */
export const transitionBookingState = adminMutation({
  args: {
    bookingId: v.string(),
    toStatus: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = ctx;
    return await ctx.runMutation(
      components.booking.hooks.transitionBookingState,
      {
        bookingId: args.bookingId as any,
        toStatus: args.toStatus,
        reason: args.reason,
        changedBy: user.userId, // Track who made the change
        resendOptions: process.env.RESEND_API_KEY
          ? {
              apiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.RESEND_FROM_EMAIL,
            }
          : undefined,
      }
    );
  },
});

/**
 * Confirm a pending booking (admin approves the request)
 */
export const confirmBooking = adminMutation({
  args: {
    bookingId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = ctx;
    return await ctx.runMutation(
      components.booking.hooks.transitionBookingState,
      {
        bookingId: args.bookingId as any,
        toStatus: "confirmed",
        reason: args.reason,
        changedBy: user.userId,
        resendOptions: process.env.RESEND_API_KEY
          ? {
              apiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.RESEND_FROM_EMAIL,
            }
          : undefined,
      }
    );
  },
});

/**
 * Decline a pending booking (admin rejects the request)
 */
export const declineBooking = adminMutation({
  args: {
    bookingId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = ctx;
    return await ctx.runMutation(
      components.booking.hooks.transitionBookingState,
      {
        bookingId: args.bookingId as any,
        toStatus: "declined",
        reason: args.reason,
        changedBy: user.userId,
        resendOptions: process.env.RESEND_API_KEY
          ? {
              apiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.RESEND_FROM_EMAIL,
            }
          : undefined,
      }
    );
  },
});

/**
 * Cancel a reservation
 */
export const cancelReservation = adminMutation({
  args: { reservationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.public.cancelReservation, {
      reservationId: args.reservationId as any,
      resendOptions: process.env.RESEND_API_KEY
        ? {
            apiKey: process.env.RESEND_API_KEY,
            fromEmail: process.env.RESEND_FROM_EMAIL,
          }
        : undefined,
    });
  },
});

/**
 * Reschedule a booking to a new time
 */
export const rescheduleBooking = adminMutation({
  args: {
    bookingId: v.string(),
    newStart: v.number(),
    newEnd: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.rescheduleBooking,
      {
        bookingId: args.bookingId as any,
        newStart: args.newStart,
        newEnd: args.newEnd,
        reason: args.reason,
        resendOptions: process.env.RESEND_API_KEY
          ? {
              apiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.RESEND_FROM_EMAIL,
            }
          : undefined,
      }
    );
  },
});

/**
 * Get booking history (state transitions)
 */
export const getBookingHistory = adminQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.hooks.getBookingHistory, {
      bookingId: args.bookingId as any,
    });
  },
});

// ============================================
// PRESENCE (Admin Monitoring)
// ============================================

/**
 * Get active presence count
 * Used to warn admin before deactivating resources/event types
 */
export const getActivePresenceCount = adminQuery({
  args: {
    resourceId: v.optional(v.string()),
    eventTypeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.presence.getActivePresenceCount,
      args
    );
  },
});

// ============================================
// HOOKS (Admin)
// ============================================

/**
 * Register a webhook for booking events
 */
export const registerHook = adminMutation({
  args: {
    eventType: v.string(),
    functionHandle: v.string(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.hooks.registerHook, args);
  },
});

/**
 * Unregister a webhook
 */
export const unregisterHook = adminMutation({
  args: { hookId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.hooks.unregisterHook, {
      hookId: args.hookId as any,
    });
  },
});

// ============================================
// MULTI-RESOURCE BOOKING (Admin)
// ============================================

/**
 * Cancel a multi-resource booking
 */
export const cancelMultiResourceBooking = adminMutation({
  args: {
    bookingId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = ctx;
    return await ctx.runMutation(
      components.booking.multi_resource.cancelMultiResourceBooking,
      {
        bookingId: args.bookingId as any,
        reason: args.reason,
        cancelledBy: user.userId,
        resendOptions: process.env.RESEND_API_KEY
          ? {
              apiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.RESEND_FROM_EMAIL,
            }
          : undefined,
      }
    );
  },
});
