/**
 * Booking Component - Internal Access Only
 *
 * ⚠️ DEPRECATED: This file no longer exports public functions.
 *
 * The booking API is now split into two modules with proper authorization:
 * - convex/public.ts - Public booking API (anonymous read, auth for booking)
 * - convex/admin.ts  - Admin API (auth + role required)
 *
 * Frontend should use:
 * - api.public.*  for public booking pages
 * - api.admin.*   for admin dashboard
 *
 * The component itself (components.booking) is accessed directly by
 * public.ts and admin.ts - it's the "trusted zone" that doesn't
 * need auth checks (auth is enforced by the wrappers).
 */

// This file is intentionally minimal.
// All public API access goes through convex/public.ts and convex/admin.ts
