import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getRequiredSlots } from "./utils";
import { isAvailable } from "./availability";

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
        const bookingId = await ctx.db.insert("bookings", {
            resourceId,
            actorId,
            start,
            end,
            status: "confirmed",
        });

        return bookingId;
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
