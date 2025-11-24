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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("event_types", args);
    }
  },
});
