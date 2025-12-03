/**
 * Custom Function Builders with Authorization
 *
 * Following Ian's Convex authorization article and convex-helpers patterns.
 * These provide reusable auth wrappers for public and admin APIs.
 *
 * Trust Zones:
 * - publicQuery: No auth (anonymous browsing)
 * - publicMutation: Auth required (for booking creation)
 * - adminQuery: Auth + role check
 * - adminMutation: Auth + admin role required
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
  userId: string; // WorkOS user ID (sub claim)
  email: string;
  name?: string;
  organizationId?: string; // From WorkOS org membership (if applicable)
};

export type Role = "admin" | "member";

// ====================================
// IDENTITY HELPERS
// ====================================

/**
 * Extract user identity from JWT (WorkOS AuthKit)
 * Returns null if not authenticated
 */
export async function getUserIdentity(
  ctx: QueryCtx | MutationCtx
): Promise<UserIdentity | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // WorkOS JWT structure:
  // - subject: WorkOS user ID
  // - email: User's email
  // - name: User's display name (optional)
  return {
    userId: identity.subject,
    email: identity.email ?? "",
    name: identity.name,
    organizationId: (identity as unknown as Record<string, string>).org_id,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<UserIdentity> {
  const user = await getUserIdentity(ctx);
  if (!user) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  }
  return user;
}

/**
 * Get user role
 *
 * Phase 1: Returns "admin" for any authenticated user (simple mode)
 * Phase 2: Will query users table for actual role/permissions
 */
export async function getUserRole(
  _ctx: QueryCtx | MutationCtx,
  _userId: string,
  _organizationId?: string
): Promise<Role> {
  // TODO: Phase 2 - Query users table for role
  // For now, any authenticated user is admin
  return "admin";
}

// ====================================
// PUBLIC FUNCTION BUILDERS
// ====================================

/**
 * Public Query - No auth required
 * Use for: Availability checks, resource browsing, event type listings
 */
export const publicQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    // Optionally capture user identity for analytics/logging
    const user = await getUserIdentity(ctx);
    return { user };
  })
);

/**
 * Public Mutation - Auth required
 * Use for: Creating bookings (auto-fills booker from user)
 */
export const publicMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await requireAuth(ctx);
    return { user };
  })
);

// ====================================
// ADMIN FUNCTION BUILDERS
// ====================================

/**
 * Admin Query - Auth + role check
 * Use for: Listing all bookings, viewing inactive resources
 */
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx, user.userId, user.organizationId);

    // Phase 1: Any authenticated user can query
    // Phase 2: Check for admin/member role here
    return { user, role };
  })
);

/**
 * Admin Mutation - Auth + admin role required
 * Use for: CRUD operations on resources, event types, schedules
 */
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx, user.userId, user.organizationId);

    if (role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    return { user, role };
  })
);

// ====================================
// INTERNAL FUNCTIONS (re-export)
// ====================================

export { internalQuery, internalMutation };
