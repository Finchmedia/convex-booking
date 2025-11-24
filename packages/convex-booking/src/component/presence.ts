import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const TIMEOUT_MS = 10_000; // Users are considered "gone" after 10 seconds

/**
 * signals that a user is present in one or more slots (time slots).
 * Updates their timestamp and ensures a cleanup job is scheduled for each slot.
 * Accepts an array of slots to batch multiple heartbeats into a single transaction.
 */
export const heartbeat = mutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Process each slot in the batch
    for (const slot of args.slots) {
      // 1. Update or create the presence record
      const existingPresence = await ctx.db
        .query("presence")
        .withIndex("by_user_slot", (q) =>
          q.eq("user", args.user).eq("slot", slot)
        )
        .first();

      if (existingPresence) {
        await ctx.db.patch(existingPresence._id, {
          updated: now,
          data: args.data ?? existingPresence.data,
        });
      } else {
        await ctx.db.insert("presence", {
          resourceId: args.resourceId,
          user: args.user,
          slot: slot,
          updated: now,
          data: args.data,
        });
      }

      // 2. Ensure a cleanup job is scheduled
      const existingHeartbeat = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_slot", (q) =>
          q.eq("user", args.user).eq("slot", slot)
        )
        .first();

      // If we don't have a cleanup job, or (edge case) the previous one might have failed/finished
      // without cleaning up, we schedule one.
      if (!existingHeartbeat) {
        const scheduledId = await ctx.scheduler.runAfter(
          TIMEOUT_MS,
          "presence:cleanup",
          {
            resourceId: args.resourceId,
            slot: slot,
            user: args.user,
          }
        );
        await ctx.db.insert("presence_heartbeats", {
          resourceId: args.resourceId,
          user: args.user,
          slot: slot,
          markAsGone: scheduledId,
        });
      }
    }
  },
});

/**
 * Explicitly removes a user from one or more slots.
 * Called when a user navigates away or unmounts.
 * Accepts an array of slots to batch multiple leave operations into a single transaction.
 */
export const leave = mutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    // Process each slot in the batch
    for (const slot of args.slots) {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user_slot", (q) =>
          q.eq("user", args.user).eq("slot", slot)
        )
        .first();

      const heartbeatDoc = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_slot", (q) =>
          q.eq("user", args.user).eq("slot", slot)
        )
        .first();

      if (presence) await ctx.db.delete(presence._id);

      // We can also delete the heartbeat doc immediately, but we might want to
      // cancel the scheduled job if possible. For now, deleting the doc is enough
      // because the cleanup job checks for the doc before doing anything.
      if (heartbeatDoc) {
        // Optional: cancel the scheduled job if we had the ID available easily
        // await ctx.scheduler.cancel(heartbeatDoc.markAsGone);
        await ctx.db.delete(heartbeatDoc._id);
      }
    }
  },
});

/**
 * Returns a list of users currently present in a slot.
 * filters out stale entries just in case cleanup hasn't run yet.
 */
export const list = query({
  args: {
    resourceId: v.string(),
    slot: v.string(),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_resource_slot_updated", (q) =>
        q.eq("resourceId", args.resourceId).eq("slot", args.slot)
      )
      .order("desc") // Most recently active first
      .take(20);

    // Filter out stale users (older than timeout) immediately for snappy UI
    // even if the backend job hasn't cleaned them up yet.
    const now = Date.now();
    return presence.filter((p) => now - p.updated <= TIMEOUT_MS);
  },
});

/**
 * Returns all active presence holds for a specific resource on a given date.
 * Uses range query optimization to efficiently fetch all slots with a date prefix.
 *
 * @param resourceId - The resource ID (e.g., "studio-a")
 * @param date - The date prefix in ISO format (e.g., "2025-11-28")
 * @returns Array of active presence records for that resource+date
 */
export const getDatePresence = query({
  args: {
    resourceId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Range query on compound index: efficiently fetch all slots starting with date prefix
    // Example: date="2025-11-28" matches "2025-11-28T10:00:00.000Z", "2025-11-28T14:30:00.000Z", etc.
    // Using \u{FFFF} (char 65535) as upper bound ensures we capture all timestamps on that date
    const allPresence = await ctx.db
      .query("presence")
      .withIndex("by_resource_slot_updated", (q) =>
        q
          .eq("resourceId", args.resourceId)
          .gte("slot", args.date)
          .lt("slot", args.date + "\u{FFFF}")
      )
      .collect();

    // Filter out stale presence (only return active holds)
    const activePresence = allPresence.filter(
      (p) => now - p.updated <= TIMEOUT_MS
    );

    // Return simplified data (no internal IDs)
    return activePresence.map((p) => ({
      slot: p.slot,
      user: p.user,
      updated: p.updated,
    }));
  },
});

/**
 * Internal mutation run by the scheduler.
 * Checks if a user has timed out. If so, deletes them.
 * If they are still active, reschedules itself.
 */
export const cleanup = mutation({
  args: {
    resourceId: v.string(),
    slot: v.string(),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user_slot", (q) =>
        q.eq("user", args.user).eq("slot", args.slot)
      )
      .first();

    const heartbeatDoc = await ctx.db
      .query("presence_heartbeats")
      .withIndex("by_user_slot", (q) =>
        q.eq("user", args.user).eq("slot", args.slot)
      )
      .first();

    if (!presence || !heartbeatDoc) {
      // Data missing, clean up whatever remains
      if (presence) await ctx.db.delete(presence._id);
      if (heartbeatDoc) await ctx.db.delete(heartbeatDoc._id);
      return;
    }

    const now = Date.now();
    if (now - presence.updated > TIMEOUT_MS) {
      // User is truly gone. Delete everything.
      await ctx.db.delete(presence._id);
      await ctx.db.delete(heartbeatDoc._id);
    } else {
      // User is still here! They must have updated their presence recently.
      // Reschedule the check.
      const scheduledId = await ctx.scheduler.runAfter(
        TIMEOUT_MS,
        "presence:cleanup",
        args
      );
      await ctx.db.patch(heartbeatDoc._id, { markAsGone: scheduledId });
    }
  },
});
