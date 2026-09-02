/**
 * App-side user records for Convex Auth v2.
 *
 * The auth core only stores the id this callback returns; the `users` table is
 * ours. Every anonymous sign-in creates a fresh row, so the table is purged of
 * rows older than an hour by internal.seed.cleanupGuestUsers.
 */
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/core";

export const createUser = internalMutation({
  args: {
    provider: v.literal("anonymous"),
    providerAccountId: v.string(),
    profile: v.object({}),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", {});
  },
});

/**
 * The signed-in guest admin, or null. Handy for "signed in as guest" copy.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ userId: v.id("users"), signedInAt: v.number() })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { userId: user._id, signedInAt: user._creationTime };
  },
});
