import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const TIMEOUT_MS = 10_000; // Users are considered "gone" after 10 seconds

/**
 * signals that a user is present in one or more "rooms" (time slots).
 * Updates their timestamp and ensures a cleanup job is scheduled for each room.
 * Accepts an array of rooms to batch multiple heartbeats into a single transaction.
 */
export const heartbeat = mutation({
  args: {
    rooms: v.array(v.string()),
    user: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Process each room in the batch
    for (const room of args.rooms) {
      // 1. Update or create the presence record
      const existingPresence = await ctx.db
        .query("presence")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      if (existingPresence) {
        await ctx.db.patch(existingPresence._id, {
          updated: now,
          data: args.data ?? existingPresence.data,
        });
      } else {
        await ctx.db.insert("presence", {
          user: args.user,
          room: room,
          updated: now,
          data: args.data,
        });
      }

      // 2. Ensure a cleanup job is scheduled
      const existingHeartbeat = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      // If we don't have a cleanup job, or (edge case) the previous one might have failed/finished
      // without cleaning up, we schedule one.
      if (!existingHeartbeat) {
        const scheduledId = await ctx.scheduler.runAfter(
          TIMEOUT_MS,
          "presence:cleanup",
          {
            room: room,
            user: args.user,
          }
        );
        await ctx.db.insert("presence_heartbeats", {
          user: args.user,
          room: room,
          markAsGone: scheduledId,
        });
      }
    }
  },
});

/**
 * Explicitly removes a user from one or more rooms.
 * Called when a user navigates away or unmounts.
 * Accepts an array of rooms to batch multiple leave operations into a single transaction.
 */
export const leave = mutation({
  args: {
    rooms: v.array(v.string()),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    // Process each room in the batch
    for (const room of args.rooms) {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      const heartbeatDoc = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
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
 * Returns a list of users currently present in a room.
 * filters out stale entries just in case cleanup hasn't run yet.
 */
export const list = query({
  args: {
    room: v.string(),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room_updated", (q) => q.eq("room", args.room))
      .order("desc") // Most recently active first
      .take(20);

    // Filter out stale users (older than timeout) immediately for snappy UI
    // even if the backend job hasn't cleaned them up yet.
    const now = Date.now();
    return presence.filter((p) => now - p.updated <= TIMEOUT_MS);
  },
});

/**
 * Internal mutation run by the scheduler.
 * Checks if a user has timed out. If so, deletes them.
 * If they are still active, reschedules itself.
 */
export const cleanup = mutation({
  args: {
    room: v.string(),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user_room", (q) =>
        q.eq("user", args.user).eq("room", args.room)
      )
      .first();

    const heartbeatDoc = await ctx.db
      .query("presence_heartbeats")
      .withIndex("by_user_room", (q) =>
        q.eq("user", args.user).eq("room", args.room)
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
