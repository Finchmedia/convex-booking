import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getRequiredSlots, generateDaySlots, areSlotsAvailable, isDayAvailable } from "./utils";
import { isAvailable } from "./availability";

export const getEventType = query({
    args: {
        eventTypeId: v.string(),
    },
    handler: async (ctx, args) => {
        const eventType = await ctx.db
            .query("event_types")
            .withIndex("by_external_id", (q) => q.eq("id", args.eventTypeId))
            .unique();

        if (!eventType) {
            throw new Error(`Event type not found: ${args.eventTypeId}`);
        }

        return eventType;
    },
});

export const getAvailability = query({
    args: {
        resourceId: v.string(),
        start: v.number(),
        end: v.number(),
    },
    handler: async (ctx, args) => {
        return await isAvailable(ctx, args.resourceId, args.start, args.end);
    },
});

/**
 * Gets availability status for a date range
 * Optimized for month view: Returns boolean map, no slot objects
 */
export const getMonthAvailability = query({
    args: {
        resourceId: v.string(),
        dateFrom: v.string(), // "2025-06-17"
        dateTo: v.string(), // "2025-06-20"
        eventLength: v.number(), // Duration in minutes (e.g., 30)
        slotInterval: v.optional(v.number()), // Slot interval
    },
    handler: async (ctx, args) => {
        const { resourceId, dateFrom, dateTo, eventLength, slotInterval } = args;

        // Parse dates
        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo);

        // Result object: { "2025-06-17": true, "2025-06-18": false }
        const availabilityByDate: Record<string, boolean> = {};

        // Iterate through each day in the range
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split("T")[0];

            // Fetch availability data for this day
            const availabilityDoc = await ctx.db
                .query("daily_availability")
                .withIndex("by_resource_date", (q) =>
                    q.eq("resourceId", resourceId).eq("date", dateStr)
                )
                .unique();

            const busySlots = availabilityDoc?.busySlots || [];

            // Check if there is ANY availability (optimized check)
            const hasAvailability = isDayAvailable(eventLength, busySlots);
            
            availabilityByDate[dateStr] = hasAvailability;

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return availabilityByDate;
    },
});

/**
 * Gets detailed slots for a SINGLE day
 * Used for day view / slot picker
 */
export const getDaySlots = query({
    args: {
        resourceId: v.string(),
        date: v.string(), // "2025-06-17"
        eventLength: v.number(), // Duration in minutes
        slotInterval: v.optional(v.number()), // Step between slots (default: 15 or equal to eventLength if business logic dictates, but utils defaults to 15)
    },
    handler: async (ctx, args) => {
        const { resourceId, date, eventLength, slotInterval } = args;

        // Generate all possible slots for this day
        const possibleSlots = generateDaySlots(date, eventLength, slotInterval);

        // Fetch availability data for this day
        const availabilityDoc = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
                q.eq("resourceId", resourceId).eq("date", date)
            )
            .unique();

        const busySlots = availabilityDoc?.busySlots || [];

        // Filter to only available slots
        const availableSlots = possibleSlots
            .filter((slot) => areSlotsAvailable(slot.slots, busySlots))
            .map((slot) => ({ time: slot.start }));

        return availableSlots;
    },
});

export const createReservation = mutation({
    args: {
        resourceId: v.string(),
        actorId: v.string(),
        start: v.number(),
        end: v.number(),
    },
    handler: async (ctx, args) => {
        const { resourceId, start, end, actorId } = args;

        // 1. Check availability first (read-before-write pattern)
        // Note: We re-check inside the transaction to ensure atomicity
        const available = await isAvailable(ctx, resourceId, start, end);
        if (!available) {
            throw new Error("Resource is not available for the requested time range.");
        }

        // 2. Calculate required slots
        const requiredSlots = getRequiredSlots(start, end);

        // 3. Update daily_availability for each day
        for (const [date, slots] of requiredSlots.entries()) {
            const existing = await ctx.db
                .query("daily_availability")
                .withIndex("by_resource_date", (q) =>
                    q.eq("resourceId", resourceId).eq("date", date)
                )
                .unique();

            if (existing) {
                // Double check conflict (redundant but safe)
                for (const slot of slots) {
                    if (existing.busySlots.includes(slot)) {
                        throw new Error(`Conflict detected on ${date} at slot ${slot}`);
                    }
                }

                // Merge new slots
                const updatedSlots = [...existing.busySlots, ...slots].sort((a, b) => a - b);
                await ctx.db.patch(existing._id, { busySlots: updatedSlots });
            } else {
                // Create new day record
                await ctx.db.insert("daily_availability", {
                    resourceId,
                    date,
                    busySlots: slots,
                });
            }
        }

        // 4. Create Booking Record
        // Using "confirmed" as default status, but with minimal metadata (legacy)
        const bookingId = await ctx.db.insert("bookings", {
            resourceId,
            actorId,
            start,
            end,
            status: "confirmed",
            // Fill required new fields with placeholders/defaults for backward compat
            uid: `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventTypeId: "legacy",
            timezone: "UTC",
            bookerName: "Legacy Booker",
            bookerEmail: actorId, // Assume actorId is email for legacy
            eventTitle: "Legacy Booking",
            location: { type: "unknown" },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return bookingId;
    },
});

export const createBooking = mutation({
  args: {
    // Event details
    eventTypeId: v.string(),
    resourceId: v.string(),

    // Time selection
    start: v.number(),
    end: v.number(),
    timezone: v.string(),

    // Booker information
    booker: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),

    // Location
    location: v.object({
      type: v.string(),
      value: v.optional(v.string()),
    }),
  },

  handler: async (ctx, args) => {
    // 1. Fetch event type (for snapshot)
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.eventTypeId))
      .first();

    if (!eventType) throw new Error("Event type not found");

    // 2. Check availability (reuse existing logic from createReservation)
    const startChunk = Math.floor((args.start % 86400000) / 900000);
    const endChunk = Math.floor((args.end % 86400000) / 900000);
    const dateStr = new Date(args.start).toISOString().split("T")[0];

    const dayAvailability = await ctx.db
      .query("daily_availability")
      .withIndex("by_resource_date", (q) =>
        q.eq("resourceId", args.resourceId).eq("date", dateStr)
      )
      .first();

    // Check if slots are available (not busy)
    if (dayAvailability) {
      for (let chunk = startChunk; chunk < endChunk; chunk++) {
        if (dayAvailability.busySlots.includes(chunk)) {
          throw new Error("Time slot no longer available");
        }
      }
    }

    // 3. Generate unique booking UID
    const uid = `bk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 4. Create booking record
    const bookingId = await ctx.db.insert("bookings", {
      uid,
      resourceId: args.resourceId,
      actorId: args.booker.email, // Use email as actorId
      eventTypeId: args.eventTypeId,
      start: args.start,
      end: args.end,
      timezone: args.timezone,
      status: "confirmed",
      bookerName: args.booker.name,
      bookerEmail: args.booker.email,
      bookerPhone: args.booker.phone,
      bookerNotes: args.booker.notes,
      eventTitle: eventType.title,
      eventDescription: eventType.description,
      location: args.location,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 5. Mark slots as busy in daily_availability
    const busyChunks = Array.from(
      { length: endChunk - startChunk },
      (_, i) => startChunk + i
    );

    if (dayAvailability) {
      await ctx.db.patch(dayAvailability._id, {
        busySlots: [...dayAvailability.busySlots, ...busyChunks].sort((a, b) => a - b),
      });
    } else {
      await ctx.db.insert("daily_availability", {
        resourceId: args.resourceId,
        date: dateStr,
        busySlots: busyChunks,
      });
    }

    // 6. Return full booking object
    return await ctx.db.get(bookingId);
  },
});

export const getBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookingId);
  },
});

export const cancelReservation = mutation({
    args: {
        reservationId: v.id("bookings"),
    },
    handler: async (ctx, args) => {
        const booking = await ctx.db.get(args.reservationId);
        if (!booking) {
            throw new Error("Reservation not found");
        }

        if (booking.status === "cancelled") {
            return; // Already cancelled
        }

        // 1. Calculate slots to free up
        const slotsToFree = getRequiredSlots(booking.start, booking.end);

        // 2. Update daily_availability
        for (const [date, slots] of slotsToFree.entries()) {
            const availability = await ctx.db
                .query("daily_availability")
                .withIndex("by_resource_date", (q) =>
                    q.eq("resourceId", booking.resourceId).eq("date", date)
                )
                .unique();

            if (availability) {
                const updatedSlots = availability.busySlots.filter(
                    (s) => !slots.includes(s)
                );
                await ctx.db.patch(availability._id, { busySlots: updatedSlots });
            }
        }

        // 3. Update booking status
        await ctx.db.patch(args.reservationId, { status: "cancelled" });
    },
});

export const createEventType = mutation({
  args: {
    id: v.string(),
    slug: v.string(),
    title: v.string(),
    lengthInMinutes: v.number(),
    lengthInMinutesOptions: v.optional(v.array(v.number())),
    slotInterval: v.optional(v.number()), // Frequency of slots
    description: v.optional(v.string()),
    timezone: v.string(),
    lockTimeZoneToggle: v.boolean(),
    locations: v.array(
      v.object({
        type: v.string(),
        address: v.optional(v.string()),
        public: v.optional(v.boolean()),
      })
    ),
    // New optional fields for expanded schema
    organizationId: v.optional(v.id("organizations")),
    scheduleId: v.optional(v.string()),
    resourceIds: v.optional(v.array(v.string())),
    bufferBefore: v.optional(v.number()),
    bufferAfter: v.optional(v.number()),
    minNoticeMinutes: v.optional(v.number()),
    maxFutureMinutes: v.optional(v.number()),
    requiresConfirmation: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    const now = Date.now();
    const data = {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...data, createdAt: existing.createdAt });
      return existing._id;
    } else {
      return await ctx.db.insert("event_types", data);
    }
  },
});

// ============================================
// EVENT TYPE LIST & DETAIL QUERIES
// ============================================

export const listEventTypes = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let eventTypes;

    if (args.organizationId) {
      eventTypes = await ctx.db
        .query("event_types")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();
    } else {
      eventTypes = await ctx.db.query("event_types").collect();
    }

    if (args.activeOnly) {
      eventTypes = eventTypes.filter((et) => et.isActive !== false);
    }

    return eventTypes;
  },
});

export const getEventTypeBySlug = query({
  args: {
    slug: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const eventTypes = await ctx.db
      .query("event_types")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .collect();

    if (args.organizationId) {
      return eventTypes.find((et) => et.organizationId === args.organizationId) ?? null;
    }

    return eventTypes[0] ?? null;
  },
});

export const updateEventType = mutation({
  args: {
    id: v.string(),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    lengthInMinutes: v.optional(v.number()),
    lengthInMinutesOptions: v.optional(v.array(v.number())),
    slotInterval: v.optional(v.number()),
    timezone: v.optional(v.string()),
    lockTimeZoneToggle: v.optional(v.boolean()),
    locations: v.optional(
      v.array(
        v.object({
          type: v.string(),
          address: v.optional(v.string()),
          public: v.optional(v.boolean()),
        })
      )
    ),
    scheduleId: v.optional(v.string()),
    resourceIds: v.optional(v.array(v.string())),
    bufferBefore: v.optional(v.number()),
    bufferAfter: v.optional(v.number()),
    minNoticeMinutes: v.optional(v.number()),
    maxFutureMinutes: v.optional(v.number()),
    requiresConfirmation: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.id}" not found`);
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(eventType._id, filteredUpdates);
    return eventType._id;
  },
});

export const deleteEventType = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.id}" not found`);
    }

    // Check for existing bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.id))
      .first();

    if (bookings) {
      throw new Error(
        "Cannot delete event type with existing bookings. Deactivate it instead."
      );
    }

    await ctx.db.delete(eventType._id);
    return { success: true };
  },
});

export const toggleEventTypeActive = mutation({
  args: {
    id: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.id}" not found`);
    }

    await ctx.db.patch(eventType._id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return eventType._id;
  },
});

// ============================================
// BOOKING LIST & DETAIL QUERIES
// ============================================

export const getBookingByUid = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_uid", (q) => q.eq("uid", args.uid))
      .unique();
  },
});

export const listBookings = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    resourceId: v.optional(v.string()),
    eventTypeId: v.optional(v.string()),
    status: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let bookings;

    // Use the most specific index available
    if (args.organizationId) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();
    } else if (args.resourceId) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
        .collect();
    } else if (args.eventTypeId) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_event_type", (q) => q.eq("eventTypeId", args.eventTypeId))
        .collect();
    } else {
      bookings = await ctx.db.query("bookings").collect();
    }

    // Apply filters
    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status);
    }
    if (args.dateFrom) {
      bookings = bookings.filter((b) => b.start >= args.dateFrom!);
    }
    if (args.dateTo) {
      bookings = bookings.filter((b) => b.start <= args.dateTo!);
    }

    // Sort by start time descending (newest first)
    bookings.sort((a, b) => b.start - a.start);

    // Apply limit
    if (args.limit) {
      bookings = bookings.slice(0, args.limit);
    }

    return bookings;
  },
});
