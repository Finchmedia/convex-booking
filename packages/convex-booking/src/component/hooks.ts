import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { FunctionHandle } from "convex/server";

// ============================================
// HOOK EVENT TYPES
// ============================================

export const HOOK_EVENTS = [
  "booking.created",
  "booking.confirmed",
  "booking.cancelled",
  "booking.completed",
  "presence.timeout",
] as const;

export type HookEventType = (typeof HOOK_EVENTS)[number];

// ============================================
// HOOK QUERIES
// ============================================

export const listHooks = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let hooks = await ctx.db.query("hooks").collect();

    if (args.organizationId) {
      hooks = hooks.filter(
        (h) => h.organizationId === args.organizationId || !h.organizationId
      );
    }

    if (args.eventType) {
      hooks = hooks.filter((h) => h.eventType === args.eventType);
    }

    return hooks;
  },
});

export const getHook = query({
  args: { hookId: v.id("hooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.hookId);
  },
});

// ============================================
// HOOK MUTATIONS
// ============================================

export const registerHook = mutation({
  args: {
    eventType: v.string(),
    functionHandle: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Validate event type
    if (!HOOK_EVENTS.includes(args.eventType as HookEventType)) {
      throw new Error(
        `Invalid hook event type: ${args.eventType}. Valid types: ${HOOK_EVENTS.join(", ")}`
      );
    }

    return await ctx.db.insert("hooks", {
      eventType: args.eventType,
      functionHandle: args.functionHandle,
      organizationId: args.organizationId,
      enabled: true,
      createdAt: Date.now(),
    });
  },
});

export const updateHook = mutation({
  args: {
    hookId: v.id("hooks"),
    enabled: v.optional(v.boolean()),
    functionHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.hookId);
    if (!hook) {
      throw new Error("Hook not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.enabled !== undefined) updates.enabled = args.enabled;
    if (args.functionHandle !== undefined)
      updates.functionHandle = args.functionHandle;

    await ctx.db.patch(args.hookId, updates);
    return args.hookId;
  },
});

export const unregisterHook = mutation({
  args: { hookId: v.id("hooks") },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.hookId);
    if (!hook) {
      throw new Error("Hook not found");
    }

    await ctx.db.delete(args.hookId);
    return { success: true };
  },
});

// ============================================
// INTERNAL: TRIGGER HOOKS
// ============================================

export const triggerHooks = internalMutation({
  args: {
    eventType: v.string(),
    organizationId: v.optional(v.id("organizations")),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // Find all enabled hooks for this event type
    const allHooks = await ctx.db
      .query("hooks")
      .withIndex("by_event", (q) =>
        q.eq("eventType", args.eventType).eq("enabled", true)
      )
      .collect();

    // Filter by organization if specified
    const hooks = allHooks.filter((h) => {
      // Global hooks (no organizationId) apply to all
      if (!h.organizationId) return true;
      // Organization-specific hooks only apply to that org
      if (args.organizationId) return h.organizationId === args.organizationId;
      return false;
    });

    // Trigger each hook
    for (const hook of hooks) {
      try {
        const handle = hook.functionHandle as FunctionHandle<"mutation">;
        await ctx.scheduler.runAfter(0, handle, args.payload);
      } catch (error) {
        // Log error but don't fail the main operation
        console.error(`Failed to trigger hook ${hook._id}:`, error);
      }
    }

    return { triggeredCount: hooks.length };
  },
});

// ============================================
// BOOKING STATE TRANSITIONS
// ============================================

const STATE_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed"],
  cancelled: [], // Terminal state
  completed: [], // Terminal state
};

export const transitionBookingState = mutation({
  args: {
    bookingId: v.id("bookings"),
    toStatus: v.string(),
    reason: v.optional(v.string()),
    changedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    const currentStatus = booking.status;
    const allowedTransitions = STATE_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTransitions.includes(args.toStatus)) {
      throw new Error(
        `Invalid state transition: ${currentStatus} -> ${args.toStatus}. Allowed: ${allowedTransitions.join(", ") || "none"}`
      );
    }

    const now = Date.now();

    // Record history
    await ctx.db.insert("booking_history", {
      bookingId: args.bookingId,
      fromStatus: currentStatus,
      toStatus: args.toStatus,
      changedBy: args.changedBy,
      reason: args.reason,
      timestamp: now,
    });

    // Update booking
    const updates: Record<string, unknown> = {
      status: args.toStatus,
      updatedAt: now,
    };

    if (args.toStatus === "cancelled") {
      updates.cancelledAt = now;
      updates.cancellationReason = args.reason;
    }

    await ctx.db.patch(args.bookingId, updates);

    // Trigger hooks for the transition
    const hookEventType = `booking.${args.toStatus}` as string;
    if (HOOK_EVENTS.includes(hookEventType as HookEventType)) {
      await ctx.scheduler.runAfter(0, triggerHooks, {
        eventType: hookEventType,
        organizationId: booking.organizationId,
        payload: {
          bookingId: args.bookingId,
          booking: { ...booking, status: args.toStatus },
          previousStatus: currentStatus,
          reason: args.reason,
        },
      });
    }

    return { success: true };
  },
});

// ============================================
// GET BOOKING HISTORY
// ============================================

export const getBookingHistory = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("booking_history")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});
