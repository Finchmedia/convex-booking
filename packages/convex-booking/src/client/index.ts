import { queryGeneric as query, mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { type ComponentApi } from "../component/_generated/component";

/**
 * Creates a client API for the booking component.
 * This allows the main app to easily mount the component's functionality.
 *
 * @param component - The component API object (from components.booking)
 * @returns An object containing the public queries and mutations
 */
export function makeBookingAPI(component: ComponentApi) {
  return {
    // ============================================
    // EVENT TYPES
    // ============================================
    getEventType: query({
      args: { eventTypeId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getEventType, args);
      },
    }),

    getEventTypeBySlug: query({
      args: { slug: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getEventTypeBySlug, args);
      },
    }),

    listEventTypes: query({
      args: {
        organizationId: v.optional(v.string()),
        activeOnly: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.listEventTypes, args);
      },
    }),

    createEventType: mutation({
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
        return await ctx.runMutation(component.public.createEventType, args);
      },
    }),

    updateEventType: mutation({
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
        return await ctx.runMutation(component.public.updateEventType, args);
      },
    }),

    deleteEventType: mutation({
      args: { id: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.deleteEventType, args);
      },
    }),

    toggleEventTypeActive: mutation({
      args: { id: v.string(), isActive: v.boolean() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.toggleEventTypeActive, args);
      },
    }),

    // ============================================
    // AVAILABILITY
    // ============================================
    getAvailability: query({
      args: {
        resourceId: v.string(),
        start: v.number(),
        end: v.number(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getAvailability, args);
      },
    }),

    getMonthAvailability: query({
      args: {
        resourceId: v.string(),
        dateFrom: v.string(),
        dateTo: v.string(),
        eventLength: v.number(),
        slotInterval: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getMonthAvailability, args);
      },
    }),

    getDaySlots: query({
      args: {
        resourceId: v.string(),
        date: v.string(),
        eventLength: v.number(),
        slotInterval: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getDaySlots, args);
      },
    }),

    // ============================================
    // BOOKINGS
    // ============================================
    createReservation: mutation({
      args: {
        resourceId: v.string(),
        actorId: v.string(),
        start: v.number(),
        end: v.number(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.createReservation, args);
      },
    }),

    createBooking: mutation({
      args: {
        eventTypeId: v.string(),
        resourceId: v.string(),
        start: v.number(),
        end: v.number(),
        timezone: v.string(),
        booker: v.object({
          name: v.string(),
          email: v.string(),
          phone: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
        location: v.object({
          type: v.string(),
          value: v.optional(v.string()),
        }),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.createBooking, args);
      },
    }),

    getBooking: query({
      args: { bookingId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getBooking, {
          bookingId: args.bookingId as any,
        });
      },
    }),

    getBookingByUid: query({
      args: { uid: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getBookingByUid, args);
      },
    }),

    listBookings: query({
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
        return await ctx.runQuery(component.public.listBookings, args);
      },
    }),

    cancelReservation: mutation({
      args: { reservationId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.cancelReservation, {
          reservationId: args.reservationId as any,
        });
      },
    }),

    // ============================================
    // RESOURCES
    // ============================================
    getResource: query({
      args: { id: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resources.getResource, args);
      },
    }),

    listResources: query({
      args: {
        organizationId: v.string(),
        type: v.optional(v.string()),
        activeOnly: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resources.listResources, args);
      },
    }),

    createResource: mutation({
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
        return await ctx.runMutation(component.resources.createResource, args);
      },
    }),

    updateResource: mutation({
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
        return await ctx.runMutation(component.resources.updateResource, args);
      },
    }),

    deleteResource: mutation({
      args: { id: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resources.deleteResource, args);
      },
    }),

    toggleResourceActive: mutation({
      args: { id: v.string(), isActive: v.boolean() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resources.toggleResourceActive, args);
      },
    }),

    // ============================================
    // RESOURCE ↔ EVENT TYPE MAPPING
    // ============================================
    getEventTypesForResource: query({
      args: { resourceId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resource_event_types.getEventTypesForResource, args);
      },
    }),

    getResourcesForEventType: query({
      args: { eventTypeId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resource_event_types.getResourcesForEventType, args);
      },
    }),

    getResourceIdsForEventType: query({
      args: { eventTypeId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resource_event_types.getResourceIdsForEventType, args);
      },
    }),

    getEventTypeIdsForResource: query({
      args: { resourceId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resource_event_types.getEventTypeIdsForResource, args);
      },
    }),

    hasResourceEventTypeLink: query({
      args: {
        resourceId: v.string(),
        eventTypeId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.resource_event_types.hasLink, args);
      },
    }),

    linkResourceToEventType: mutation({
      args: {
        resourceId: v.string(),
        eventTypeId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resource_event_types.linkResourceToEventType, args);
      },
    }),

    unlinkResourceFromEventType: mutation({
      args: {
        resourceId: v.string(),
        eventTypeId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resource_event_types.unlinkResourceFromEventType, args);
      },
    }),

    setResourcesForEventType: mutation({
      args: {
        eventTypeId: v.string(),
        resourceIds: v.array(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resource_event_types.setResourcesForEventType, args);
      },
    }),

    setEventTypesForResource: mutation({
      args: {
        resourceId: v.string(),
        eventTypeIds: v.array(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.resource_event_types.setEventTypesForResource, args);
      },
    }),

    // ============================================
    // SCHEDULES
    // ============================================
    getSchedule: query({
      args: { id: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.schedules.getSchedule, args);
      },
    }),

    listSchedules: query({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.schedules.listSchedules, args);
      },
    }),

    getDefaultSchedule: query({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.schedules.getDefaultSchedule, args);
      },
    }),

    createSchedule: mutation({
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
        return await ctx.runMutation(component.schedules.createSchedule, args);
      },
    }),

    updateSchedule: mutation({
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
        return await ctx.runMutation(component.schedules.updateSchedule, args);
      },
    }),

    deleteSchedule: mutation({
      args: { id: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.schedules.deleteSchedule, args);
      },
    }),

    getEffectiveAvailability: query({
      args: { scheduleId: v.string(), date: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.schedules.getEffectiveAvailability, args);
      },
    }),

    // Date Overrides
    listDateOverrides: query({
      args: {
        scheduleId: v.string(),
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.schedules.listDateOverrides, {
          scheduleId: args.scheduleId as any,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        });
      },
    }),

    createDateOverride: mutation({
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
        return await ctx.runMutation(component.schedules.createDateOverride, {
          scheduleId: args.scheduleId as any,
          date: args.date,
          type: args.type,
          customHours: args.customHours,
        });
      },
    }),

    deleteDateOverride: mutation({
      args: { overrideId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.schedules.deleteDateOverride, {
          overrideId: args.overrideId as any,
        });
      },
    }),

    // ============================================
    // MULTI-RESOURCE BOOKING
    // ============================================
    checkMultiResourceAvailability: query({
      args: {
        resources: v.array(
          v.object({
            resourceId: v.string(),
            quantity: v.optional(v.number()),
          })
        ),
        start: v.number(),
        end: v.number(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.multi_resource.checkMultiResourceAvailability, args);
      },
    }),

    createMultiResourceBooking: mutation({
      args: {
        eventTypeId: v.string(),
        organizationId: v.optional(v.string()),
        resources: v.array(
          v.object({
            resourceId: v.string(),
            quantity: v.optional(v.number()),
          })
        ),
        start: v.number(),
        end: v.number(),
        timezone: v.string(),
        booker: v.object({
          name: v.string(),
          email: v.string(),
          phone: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
        location: v.optional(
          v.object({
            type: v.string(),
            value: v.optional(v.string()),
          })
        ),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.multi_resource.createMultiResourceBooking, args);
      },
    }),

    getBookingWithItems: query({
      args: { bookingId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.multi_resource.getBookingWithItems, {
          bookingId: args.bookingId as any,
        });
      },
    }),

    cancelMultiResourceBooking: mutation({
      args: {
        bookingId: v.string(),
        reason: v.optional(v.string()),
        cancelledBy: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.multi_resource.cancelMultiResourceBooking, {
          bookingId: args.bookingId as any,
          reason: args.reason,
          cancelledBy: args.cancelledBy,
        });
      },
    }),

    // ============================================
    // HOOKS
    // ============================================
    registerHook: mutation({
      args: {
        eventType: v.string(),
        functionHandle: v.string(),
        organizationId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.hooks.registerHook, args);
      },
    }),

    unregisterHook: mutation({
      args: { hookId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.hooks.unregisterHook, {
          hookId: args.hookId as any,
        });
      },
    }),

    transitionBookingState: mutation({
      args: {
        bookingId: v.string(),
        toStatus: v.string(),
        reason: v.optional(v.string()),
        changedBy: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.hooks.transitionBookingState, {
          bookingId: args.bookingId as any,
          toStatus: args.toStatus,
          reason: args.reason,
          changedBy: args.changedBy,
        });
      },
    }),

    getBookingHistory: query({
      args: { bookingId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.hooks.getBookingHistory, {
          bookingId: args.bookingId as any,
        });
      },
    }),

    // ============================================
    // PRESENCE (Real-time slot locking)
    // ============================================
    heartbeat: mutation({
      args: {
        resourceId: v.string(),
        slots: v.array(v.string()),
        user: v.string(),
        data: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.heartbeat, args);
      },
    }),

    leave: mutation({
      args: {
        resourceId: v.string(),
        slots: v.array(v.string()),
        user: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.leave, args);
      },
    }),

    getPresence: query({
      args: {
        resourceId: v.string(),
        slot: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.presence.list, args);
      },
    }),

    getDatePresence: query({
      args: {
        resourceId: v.string(),
        date: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.presence.getDatePresence, args);
      },
    }),
  };
}
