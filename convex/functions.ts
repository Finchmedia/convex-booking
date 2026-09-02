/**
 * Custom Function Builders — guest-admin model
 *
 * convexbooking.dev is a public sandbox. Two trust zones:
 *
 * - publicQuery / publicMutation: anonymous. No identity is read or required.
 *   Booking, browsing, presence and token-based cancel/reschedule live here.
 * - adminQuery / adminMutation: require a Convex Auth v2 identity. The only
 *   login provider is the anonymous one ("Continue as guest admin"), so the
 *   gate is not about *who* you are — it makes the dashboard an explicit,
 *   sessioned step (and gives audit fields a user id) without an external
 *   auth provider. Everyone who signs in is an admin of the shared demo org;
 *   the sandbox resets every hour.
 *
 * Built with convex-helpers' customQuery/customMutation. The builder names are
 * load-bearing: convex/admin.ts and convex/public.ts use them at ~56 call sites.
 */
import {
  customQuery,
  customMutation,
  customCtx,
} from "convex-helpers/server/customFunctions";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

// ====================================
// USER IDENTITY TYPES
// ====================================

export type UserIdentity = {
  /** Convex Auth user id (`identity.subject`) — the app `users` row. */
  userId: string;
  /** Always "" for anonymous sessions; kept for admin.ts compatibility. */
  email: string;
  name?: string;
};

export type Role = "admin";

// ====================================
// IDENTITY HELPERS
// ====================================

/**
 * Read the Convex Auth identity, or null when the caller is not signed in.
 */
export async function getUserIdentity(
  ctx: QueryCtx | MutationCtx
): Promise<UserIdentity | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return {
    userId: identity.subject,
    email: identity.email ?? "",
    name: identity.name,
  };
}

/**
 * Require a signed-in (guest admin) session.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<UserIdentity> {
  const user = await getUserIdentity(ctx);
  if (!user) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in as guest admin to use the dashboard",
    });
  }
  return user;
}

// ====================================
// PUBLIC FUNCTION BUILDERS (anonymous)
// ====================================

/**
 * Public Query — no auth, nothing injected.
 * Use for: availability, resource browsing, event type listings.
 */
export const publicQuery = customQuery(
  query,
  customCtx(async () => ({}))
);

/**
 * Public Mutation — no auth, nothing injected.
 * Use for: anonymous booking creation, presence heartbeats.
 */
export const publicMutation = customMutation(
  mutation,
  customCtx(async () => ({}))
);

// ====================================
// ADMIN FUNCTION BUILDERS (guest admin session required)
// ====================================

/**
 * Admin Query — requires a Convex Auth identity; injects { user, role }.
 */
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await requireAuth(ctx);
    return { user, role: "admin" as Role };
  })
);

/**
 * Admin Mutation — requires a Convex Auth identity; injects { user, role }.
 * `user.userId` is what admin.ts records as changedBy / cancelledBy.
 */
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await requireAuth(ctx);
    return { user, role: "admin" as Role };
  })
);

// ====================================
// INTERNAL FUNCTIONS (re-export)
// ====================================

export { internalQuery, internalMutation };
