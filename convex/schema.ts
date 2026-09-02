import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// App-level schema. The booking component and the auth components own their
// own isolated tables; only what the host itself needs lives here.
export default defineSchema({
  // Convex Auth v2 user records (one per anonymous "guest admin" session).
  // email/name are optional so that legacy rows written by the previous
  // provider-backed app schema still validate and so that a non-anonymous
  // provider can be added later without a migration.
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  }),

  // Fixed-window counters for anonymous booking writes: one row per booker
  // email (`email:<address>`) and one sandbox-wide row (`sandbox:bookings`).
  // All rows are deleted by the hourly reset (seed.ts).
  bookingRateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
