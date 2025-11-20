import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  event_types: defineTable({
    id: v.string(), // External ID (e.g., "studio-30min")
    title: v.string(), // "Studio Session"
    length: v.number(), // Duration in minutes (e.g., 30)
    description: v.optional(v.string()), // "Book a 30-minute studio session"
  }).index("by_external_id", ["id"]),

  daily_availability: defineTable({
    resourceId: v.string(), // Using string for now as resources might be external IDs
    date: v.string(), // "2024-05-20" (ISO Date)
    busySlots: v.array(v.number()), // [32, 33, 34...] (Indices of 15-min chunks)
  }).index("by_resource_date", ["resourceId", "date"]),

  bookings: defineTable({
    resourceId: v.string(),
    actorId: v.string(),
    start: v.number(), // Timestamp
    end: v.number(), // Timestamp
    status: v.string(), // "confirmed", "cancelled"
  }).index("by_resource", ["resourceId"]),
});
