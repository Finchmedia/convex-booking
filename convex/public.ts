/**
 * Public Booking API
 *
 * This module exposes functions for the public booking flow:
 * - Anonymous browsing: availability, resources, event types
 * - Authenticated booking: requires sign-in to confirm booking
 *
 * Auth Gate Pattern:
 * - Queries: No auth required (anonymous allowed)
 * - createBooking: Auth required (booker auto-filled from user)
 * - Presence: Session-based (no strict auth, uses client-generated user ID)
 */
import { v } from "convex/values";
import { components } from "./_generated/api";
import { publicQuery, publicMutation } from "./functions";
import { query, mutation } from "./_generated/server";
import { authKit } from "./authClient";

// ============================================
// RESOURCES (Public Read)
// ============================================

/**
 * List available resources for public booking
 * Only shows active, standalone resources
 */
export const listResources = publicQuery({
  args: {
    organizationId: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.listResources, {
      organizationId: args.organizationId,
      type: args.type,
      activeOnly: true, // Always filter to active for public
    });
  },
});

/**
 * Get a single resource by ID
 */
export const getResource = publicQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.getResource, args);
  },
});

// ============================================
// EVENT TYPES (Public Read)
// ============================================

/**
 * List event types for a resource
 * Only shows active event types
 */
export const getEventTypesForResource = publicQuery({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.getEventTypesForResource,
      args
    );
  },
});

/**
 * Check if a resource is linked to an event type
 * Used by Booker to validate the booking is still valid
 */
export const hasResourceEventTypeLink = publicQuery({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.hasResourceEventTypeLink,
      args
    );
  },
});

/**
 * Get a single event type by ID
 */
export const getEventType = publicQuery({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getEventType, args);
  },
});

/**
 * Get event type by slug (for booking URLs)
 */
export const getEventTypeBySlug = publicQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getEventTypeBySlug, args);
  },
});

/**
 * List all active event types
 */
export const listEventTypes = publicQuery({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.listEventTypes, {
      organizationId: args.organizationId,
      activeOnly: true, // Always filter to active for public
    });
  },
});

// ============================================
// AVAILABILITY (Public Read)
// ============================================

/**
 * Get month availability map for calendar view
 * Returns Record<date, boolean> for the date range
 */
export const getMonthAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.public.getMonthAvailability,
      args
    );
  },
});

/**
 * Get detailed slots for a specific day
 */
export const getDaySlots = publicQuery({
  args: {
    resourceId: v.string(),
    date: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getDaySlots, args);
  },
});

/**
 * Check availability for a specific time range
 */
export const getAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getAvailability, args);
  },
});

// ============================================
// PRESENCE (Session-based, no strict auth)
// ============================================

/**
 * Get all active presence holds for a date
 * Used by frontend to filter out reserved slots
 */
export const getDatePresence = publicQuery({
  args: {
    resourceId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.presence.getDatePresence,
      args
    );
  },
});

/**
 * Get presence for a specific slot
 */
export const getPresence = publicQuery({
  args: {
    resourceId: v.string(),
    slot: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.presence.list, args);
  },
});

/**
 * Heartbeat to maintain slot hold
 * Uses client-generated session ID (no auth required)
 * Called every 5 seconds while user is selecting a slot
 */
export const heartbeat = mutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(), // Client-generated session ID
    eventTypeId: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.presence.heartbeat, args);
  },
});

/**
 * Release slot hold
 * Called when user navigates away or cancels selection
 */
export const leave = mutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.presence.leave, args);
  },
});

// ============================================
// BOOKING (Auth Required)
// ============================================

/**
 * Create a booking
 * Requires authentication - booker info auto-filled from user
 */
export const createBooking = publicMutation({
  args: {
    eventTypeId: v.string(),
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
    timezone: v.string(),
    booker: v.optional(
      v.object({
        name: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
    location: v.object({
      type: v.string(),
      value: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { user } = ctx;

    // Auto-fill booker from authenticated user if not provided
    const booker = args.booker ?? {
      name: user.name ?? user.email.split("@")[0],
      email: user.email,
    };

    return await ctx.runMutation(components.booking.public.createBooking, {
      eventTypeId: args.eventTypeId,
      resourceId: args.resourceId,
      start: args.start,
      end: args.end,
      timezone: args.timezone,
      booker,
      location: args.location,
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
 * Get booking by ID
 * Public access (booking ID is effectively a secret)
 */
export const getBooking = publicQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBooking, {
      bookingId: args.bookingId as any,
    });
  },
});

/**
 * Get booking by UID (confirmation code)
 */
export const getBookingByUid = publicQuery({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBookingByUid, args);
  },
});

/**
 * Get booking by token (for public management)
 * Requires both UID and management token for access
 */
export const getBookingByToken = publicQuery({
  args: { uid: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBookingByToken, args);
  },
});

/**
 * Cancel booking by token (for public management)
 * Allows booker to cancel their booking via email link
 */
export const cancelBookingByToken = publicMutation({
  args: {
    uid: v.string(),
    token: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.public.cancelBookingByToken, {
      uid: args.uid,
      token: args.token,
      reason: args.reason,
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
 * Reschedule booking by token (for public management)
 * Allows booker to reschedule their booking to a new time
 */
export const rescheduleBookingByToken = publicMutation({
  args: {
    uid: v.string(),
    token: v.string(),
    newStart: v.number(),
    newEnd: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.public.rescheduleBookingByToken, {
      uid: args.uid,
      token: args.token,
      newStart: args.newStart,
      newEnd: args.newEnd,
      resendOptions: process.env.RESEND_API_KEY
        ? {
            apiKey: process.env.RESEND_API_KEY,
            fromEmail: process.env.RESEND_FROM_EMAIL,
          }
        : undefined,
    });
  },
});

// ============================================
// SCHEDULES (Public Read - for availability display)
// ============================================

/**
 * Get effective availability for a schedule on a date
 * Used to display business hours
 */
export const getEffectiveAvailability = publicQuery({
  args: {
    scheduleId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.schedules.getEffectiveAvailability,
      args
    );
  },
});

// ============================================
// USER (WorkOS AuthKit Integration)
// ============================================

/**
 * Get the current authenticated user's profile
 * Returns synced user data from WorkOS AuthKit component
 * Returns null if not authenticated
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authKit.getAuthUser(ctx);
  },
});
