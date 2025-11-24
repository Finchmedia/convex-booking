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
    getEventType: query({
      args: {
        eventTypeId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getEventType, args);
      },
    }),
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
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.public.getDaySlots, args);
      },
    }),
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
    
    // NEW: Expose createBooking
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
       args: { bookingId: v.id("bookings") },
       handler: async (ctx, args) => {
         return await ctx.runQuery(component.public.getBooking, args);
       }
    }),

    cancelReservation: mutation({
      args: {
        reservationId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.cancelReservation, args);
      },
    }),

    // Presence: Real-time slot locking
    heartbeat: mutation({
      args: {
        room: v.string(), // The Slot ID
        user: v.string(), // The User/Session ID
        data: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.heartbeat, args);
      },
    }),
    
    leave: mutation({
      args: {
        room: v.string(),
        user: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.leave, args);
      },
    }),

    getPresence: query({
      args: { room: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.presence.list, args);
      },
    }),
  };
}
