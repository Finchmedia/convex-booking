import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // RESOURCES (Bookable Items)
  // ============================================
  resources: defineTable({
    id: v.string(),
    organizationId: v.string(), // External org ID from auth system
    name: v.string(),
    type: v.string(), // "room" | "equipment" | "person"
    description: v.optional(v.string()),
    timezone: v.string(),

    // Quantity tracking
    quantity: v.optional(v.number()), // null = 1 (singular)
    isFungible: v.optional(v.boolean()), // true = any unit works

    // Booking constraint
    isStandalone: v.optional(v.boolean()), // false = can't be booked alone (e.g., rental equipment)

    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_id", ["id"])
    .index("by_org", ["organizationId"])
    .index("by_org_type", ["organizationId", "type"]),

  // ============================================
  // SCHEDULES (Weekly Patterns)
  // ============================================
  schedules: defineTable({
    id: v.string(),
    organizationId: v.string(), // External org ID from auth system
    name: v.string(),
    timezone: v.string(),
    isDefault: v.boolean(),
    weeklyHours: v.array(
      v.object({
        dayOfWeek: v.number(), // 0-6 (Sunday-Saturday)
        startTime: v.string(), // "09:00"
        endTime: v.string(), // "17:00"
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_id", ["id"])
    .index("by_org", ["organizationId"]),

  // Date overrides (holidays, custom hours)
  date_overrides: defineTable({
    scheduleId: v.id("schedules"),
    date: v.string(), // "2025-12-25"
    type: v.string(), // "unavailable" | "custom"
    customHours: v.optional(
      v.array(
        v.object({
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  }).index("by_schedule_date", ["scheduleId", "date"]),

  // ============================================
  // EVENT TYPES (Extended)
  // ============================================
  event_types: defineTable({
    id: v.string(), // External ID (e.g., "studio-30min")
    slug: v.string(), // URL-friendly identifier (e.g., "studio-30min")
    title: v.string(), // "Studio Session"
    lengthInMinutes: v.number(), // Duration in minutes (e.g., 30)
    lengthInMinutesOptions: v.optional(v.array(v.number())), // Allow booker to choose duration
    slotInterval: v.optional(v.number()), // Frequency of slots
    description: v.optional(v.string()),
    timezone: v.string(), // IANA timezone
    lockTimeZoneToggle: v.boolean(),
    locations: v.array(
      v.object({
        type: v.string(), // "address" | "link" | "phone"
        address: v.optional(v.string()),
        public: v.optional(v.boolean()),
      })
    ),

    // Organization ownership (external ID)
    organizationId: v.optional(v.string()),

    // Schedule reference
    scheduleId: v.optional(v.string()),

    // Buffer times
    bufferBefore: v.optional(v.number()), // Minutes before booking
    bufferAfter: v.optional(v.number()), // Minutes after booking

    // Booking window
    minNoticeMinutes: v.optional(v.number()), // Min hours ahead required
    maxFutureMinutes: v.optional(v.number()), // Max days into future

    // Booking policy
    requiresConfirmation: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_external_id", ["id"])
    .index("by_slug", ["slug"])
    .index("by_org", ["organizationId"]),

  // ============================================
  // RESOURCE ↔ EVENT TYPE MAPPING (Many-to-Many)
  // ============================================
  resource_event_types: defineTable({
    resourceId: v.string(),
    eventTypeId: v.string(),
  })
    .index("by_resource", ["resourceId"]) // Resource → Event Types
    .index("by_event_type", ["eventTypeId"]), // Event Type → Resources

  // ============================================
  // AVAILABILITY (Bitmap Pattern)
  // ============================================
  daily_availability: defineTable({
    resourceId: v.string(),
    date: v.string(), // "2024-05-20" (ISO Date)
    busySlots: v.array(v.number()), // Indices of 15-min chunks (0-95)
  }).index("by_resource_date", ["resourceId", "date"]),

  // Quantity availability tracking (for pooled resources)
  quantity_availability: defineTable({
    resourceId: v.string(),
    date: v.string(),
    slotQuantities: v.any(), // { "36": 2, "37": 1 } = booked count per slot
  }).index("by_resource_date", ["resourceId", "date"]),

  // ============================================
  // BOOKINGS (Extended)
  // ============================================
  bookings: defineTable({
    // Core fields
    resourceId: v.string(),
    actorId: v.string(),
    start: v.number(),
    end: v.number(),
    status: v.string(), // "pending" | "confirmed" | "cancelled" | "completed"

    // Unique identifiers
    uid: v.string(), // e.g., "bk_abc123xyz"

    // References
    eventTypeId: v.string(),
    organizationId: v.optional(v.string()), // External org ID from auth system
    timezone: v.string(),

    // Booker details
    bookerName: v.string(),
    bookerEmail: v.string(),
    bookerPhone: v.optional(v.string()),
    bookerNotes: v.optional(v.string()),

    // Event snapshot
    eventTitle: v.string(),
    eventDescription: v.optional(v.string()),

    // Location
    location: v.object({
      type: v.string(),
      value: v.optional(v.string()),
    }),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),

    // Relationships
    rescheduleUid: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_uid", ["uid"])
    .index("by_email", ["bookerEmail"])
    .index("by_org", ["organizationId"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_event_type", ["eventTypeId"]),

  // Booking items (for multi-resource bookings)
  booking_items: defineTable({
    bookingId: v.id("bookings"),
    resourceId: v.string(),
    quantity: v.number(),
  }).index("by_booking", ["bookingId"]),

  // Booking state history (audit trail)
  booking_history: defineTable({
    bookingId: v.id("bookings"),
    fromStatus: v.string(),
    toStatus: v.string(),
    changedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_booking", ["bookingId"]),

  // ============================================
  // PRESENCE (Real-time Slot Locking)
  // ============================================
  presence: defineTable({
    resourceId: v.string(),
    user: v.string(),
    slot: v.string(), // ISO timestamp
    eventTypeId: v.optional(v.string()), // Track which event type being booked
    updated: v.number(),
    data: v.optional(v.any()),
  })
    .index("by_resource_slot_updated", ["resourceId", "slot", "updated"])
    .index("by_user_slot", ["user", "slot"])
    .index("by_event_type", ["eventTypeId"]),

  presence_heartbeats: defineTable({
    resourceId: v.string(),
    user: v.string(),
    slot: v.string(),
    markAsGone: v.id("_scheduled_functions"),
  }).index("by_user_slot", ["user", "slot"]),

  // ============================================
  // HOOKS (Notification System)
  // ============================================
  hooks: defineTable({
    eventType: v.string(), // "booking.created" | "booking.cancelled" | "booking.confirmed"
    functionHandle: v.string(),
    organizationId: v.optional(v.string()), // External org ID from auth system
    enabled: v.boolean(),
    createdAt: v.number(),
  }).index("by_event", ["eventType", "enabled"]),
});
