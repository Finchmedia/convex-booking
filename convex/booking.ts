import { query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

/**
 * Wrapper functions that delegate to the booking component
 * These allow React hooks (useQuery/useMutation) to call component functions
 * via the main app's API
 */

export const getAvailableSlots = query({
  args: {
    resourceId: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    eventLength: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.public.getAvailableSlots,
      args
    );
  },
});

export const getMonthAvailability = query({
  args: {
    resourceId: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    eventLength: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.public.getMonthAvailability,
      args
    );
  },
});

export const getDaySlots = query({
  args: {
    resourceId: v.string(),
    date: v.string(),
    eventLength: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getDaySlots, args);
  },
});

export const getAvailability = query({
  args: {
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getAvailability, args);
  },
});

export const createReservation = mutation({
  args: {
    resourceId: v.string(),
    actorId: v.string(),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.createReservation,
      args
    );
  },
});

export const cancelReservation = mutation({
  args: {
    reservationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.booking.public.cancelReservation,
      args
    );
  },
});
