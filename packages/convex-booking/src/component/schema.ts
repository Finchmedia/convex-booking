import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  event_types: defineTable({
    id: v.string(), // External ID (e.g., "studio-30min")
    slug: v.string(), // URL-friendly identifier (e.g., "studio-30min")
    title: v.string(), // "Studio Session"
    lengthInMinutes: v.number(), // Duration in minutes (e.g., 30) - matches Cal.com naming
    lengthInMinutesOptions: v.optional(v.array(v.number())), // Optional: Allow booker to choose duration (e.g., [60, 120, 180])
    description: v.optional(v.string()), // "Book a 30-minute studio session"
    timezone: v.string(), // IANA timezone (e.g., "Europe/Berlin")
    lockTimeZoneToggle: v.boolean(), // If true, timezone selector is read-only (performance optimization)
    locations: v.array(
      v.object({
        type: v.string(), // "address" | "link" | "phone" (MVP: just "address")
        address: v.optional(v.string()), // For type="address"
        public: v.optional(v.boolean()), // Whether to show address to booker
      })
    ),
  })
    .index("by_external_id", ["id"])
    .index("by_slug", ["slug"]),

  daily_availability: defineTable({
    resourceId: v.string(), // Using string for now as resources might be external IDs
    date: v.string(), // "2024-05-20" (ISO Date)
    busySlots: v.array(v.number()), // [32, 33, 34...] (Indices of 15-min chunks)
  }).index("by_resource_date", ["resourceId", "date"]),

  bookings: defineTable({
    // Core fields (existing)
    resourceId: v.string(),
    actorId: v.string(),
    start: v.number(),
    end: v.number(),
    status: v.string(), // "confirmed", "cancelled"

    // NEW: Unique identifiers
    uid: v.string(), // e.g., "bk_abc123xyz" for booking URLs

    // NEW: Event reference
    eventTypeId: v.string(),
    timezone: v.string(), // Booker's timezone

    // NEW: Booker details
    bookerName: v.string(),
    bookerEmail: v.string(),
    bookerPhone: v.optional(v.string()),
    bookerNotes: v.optional(v.string()),

    // NEW: Event snapshot (historical record)
    eventTitle: v.string(),
    eventDescription: v.optional(v.string()),

    // NEW: Location
    location: v.object({
      type: v.string(), // "address" | "link" | "phone"
      value: v.optional(v.string()),
    }),

    // NEW: Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),

    // NEW: Relationships
    rescheduleUid: v.optional(v.string()), // Link to original if rescheduled
    cancellationReason: v.optional(v.string()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_uid", ["uid"]) // NEW: Query bookings by UID
    .index("by_email", ["bookerEmail"]), // NEW: Find user's bookings

  // Presence: Tracks active users in specific "rooms" (slots)
  presence: defineTable({
    user: v.string(),      // "session_id"
    room: v.string(),      // "slot_timestamp"
    updated: v.number(),   // Last heartbeat timestamp
    data: v.optional(v.any()), // { username: "..." }
  })
    // Efficiently find everyone in a room to show "Someone is booking..."
    .index("by_room_updated", ["room", "updated"])
    // Efficiently find a specific user's session to update heartbeat
    .index("by_user_room", ["user", "room"]),

  // Presence Heartbeats: Manages cleanup jobs to avoid duplicate scheduling
  presence_heartbeats: defineTable({
    user: v.string(),
    room: v.string(),
    markAsGone: v.id("_scheduled_functions"), // Reference to the cleanup job
  }).index("by_user_room", ["user", "room"]),
});
