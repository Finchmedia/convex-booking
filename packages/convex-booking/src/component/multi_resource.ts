import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getRequiredSlots } from "./utils";

// ============================================
// MULTI-RESOURCE AVAILABILITY CHECK
// ============================================

export const checkMultiResourceAvailability = query({
  args: {
    resources: v.array(
      v.object({
        resourceId: v.string(),
        quantity: v.optional(v.number()),
      })
    ),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      resourceId: string;
      available: boolean;
      requestedQuantity: number;
      availableQuantity: number;
      conflicts: number[];
    }> = [];

    const requiredSlots = getRequiredSlots(args.start, args.end);

    for (const resourceReq of args.resources) {
      const requestedQty = resourceReq.quantity ?? 1;

      // Get resource to check if it's quantity-based
      const resource = await ctx.db
        .query("resources")
        .withIndex("by_external_id", (q) => q.eq("id", resourceReq.resourceId))
        .unique();

      const totalQuantity = resource?.quantity ?? 1;
      const isFungible = resource?.isFungible ?? false;

      // For each date in the range, check availability
      let isAvailable = true;
      let minAvailable = totalQuantity;
      const conflicts: number[] = [];

      for (const [date, slots] of requiredSlots.entries()) {
        if (isFungible && totalQuantity > 1) {
          // Quantity-based resource
          const quantityDoc = await ctx.db
            .query("quantity_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          const bookedQuantities = (quantityDoc?.slotQuantities ?? {}) as Record<
            string,
            number
          >;

          for (const slot of slots) {
            const booked = bookedQuantities[slot.toString()] ?? 0;
            const available = totalQuantity - booked;
            minAvailable = Math.min(minAvailable, available);

            if (available < requestedQty) {
              isAvailable = false;
              conflicts.push(slot);
            }
          }
        } else {
          // Regular resource (quantity = 1)
          const availability = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          const busySlots = availability?.busySlots ?? [];

          for (const slot of slots) {
            if (busySlots.includes(slot)) {
              isAvailable = false;
              minAvailable = 0;
              conflicts.push(slot);
            }
          }
        }
      }

      results.push({
        resourceId: resourceReq.resourceId,
        available: isAvailable,
        requestedQuantity: requestedQty,
        availableQuantity: minAvailable,
        conflicts,
      });
    }

    const allAvailable = results.every((r) => r.available);

    return {
      available: allAvailable,
      resources: results,
    };
  },
});

// ============================================
// MULTI-RESOURCE BOOKING
// ============================================

export const createMultiResourceBooking = mutation({
  args: {
    eventTypeId: v.string(),
    organizationId: v.optional(v.string()),
    resources: v.array(
      v.object({
        resourceId: v.string(),
        quantity: v.optional(v.number()),
      })
    ),
    start: v.number(),
    end: v.number(),
    timezone: v.string(),
    booker: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    location: v.optional(
      v.object({
        type: v.string(),
        value: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Get event type for metadata
    const eventType = await ctx.db
      .query("event_types")
      .withIndex("by_external_id", (q) => q.eq("id", args.eventTypeId))
      .unique();

    if (!eventType) {
      throw new Error(`Event type "${args.eventTypeId}" not found`);
    }

    // 2. Check ALL resources are available (fail-fast)
    const requiredSlots = getRequiredSlots(args.start, args.end);

    for (const resourceReq of args.resources) {
      const requestedQty = resourceReq.quantity ?? 1;

      // Get resource
      const resource = await ctx.db
        .query("resources")
        .withIndex("by_external_id", (q) => q.eq("id", resourceReq.resourceId))
        .unique();

      const totalQuantity = resource?.quantity ?? 1;
      const isFungible = resource?.isFungible ?? false;

      for (const [date, slots] of requiredSlots.entries()) {
        if (isFungible && totalQuantity > 1) {
          // Quantity-based
          const quantityDoc = await ctx.db
            .query("quantity_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          const bookedQuantities = (quantityDoc?.slotQuantities ?? {}) as Record<
            string,
            number
          >;

          for (const slot of slots) {
            const booked = bookedQuantities[slot.toString()] ?? 0;
            if (booked + requestedQty > totalQuantity) {
              throw new Error(
                `Resource "${resourceReq.resourceId}" is not available for the requested quantity`
              );
            }
          }
        } else {
          // Regular
          const availability = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          const busySlots = availability?.busySlots ?? [];

          for (const slot of slots) {
            if (busySlots.includes(slot)) {
              throw new Error(
                `Resource "${resourceReq.resourceId}" is not available for the selected time`
              );
            }
          }
        }
      }
    }

    // 3. Create main booking record (use first resource as primary)
    const primaryResourceId = args.resources[0].resourceId;
    const bookingUid = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    const bookingId = await ctx.db.insert("bookings", {
      resourceId: primaryResourceId,
      actorId: args.booker.email, // Use email as actor ID
      start: args.start,
      end: args.end,
      status: eventType.requiresConfirmation ? "pending" : "confirmed",
      uid: bookingUid,
      eventTypeId: args.eventTypeId,
      organizationId: args.organizationId,
      timezone: args.timezone,
      bookerName: args.booker.name,
      bookerEmail: args.booker.email,
      bookerPhone: args.booker.phone,
      bookerNotes: args.booker.notes,
      eventTitle: eventType.title,
      eventDescription: eventType.description,
      location: args.location ?? { type: "address" },
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create booking_items for each resource
    for (const resourceReq of args.resources) {
      await ctx.db.insert("booking_items", {
        bookingId,
        resourceId: resourceReq.resourceId,
        quantity: resourceReq.quantity ?? 1,
      });
    }

    // 5. Mark slots busy for each resource
    for (const resourceReq of args.resources) {
      const resource = await ctx.db
        .query("resources")
        .withIndex("by_external_id", (q) => q.eq("id", resourceReq.resourceId))
        .unique();

      const totalQuantity = resource?.quantity ?? 1;
      const isFungible = resource?.isFungible ?? false;
      const requestedQty = resourceReq.quantity ?? 1;

      for (const [date, slots] of requiredSlots.entries()) {
        if (isFungible && totalQuantity > 1) {
          // Update quantity availability
          const quantityDoc = await ctx.db
            .query("quantity_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          if (quantityDoc) {
            const bookedQuantities = {
              ...(quantityDoc.slotQuantities as Record<string, number>),
            };
            for (const slot of slots) {
              bookedQuantities[slot.toString()] =
                (bookedQuantities[slot.toString()] ?? 0) + requestedQty;
            }
            await ctx.db.patch(quantityDoc._id, {
              slotQuantities: bookedQuantities,
            });
          } else {
            const bookedQuantities: Record<string, number> = {};
            for (const slot of slots) {
              bookedQuantities[slot.toString()] = requestedQty;
            }
            await ctx.db.insert("quantity_availability", {
              resourceId: resourceReq.resourceId,
              date,
              slotQuantities: bookedQuantities,
            });
          }
        } else {
          // Update regular availability
          const availability = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", resourceReq.resourceId).eq("date", date)
            )
            .unique();

          if (availability) {
            const newBusySlots = [...new Set([...availability.busySlots, ...slots])];
            await ctx.db.patch(availability._id, { busySlots: newBusySlots });
          } else {
            await ctx.db.insert("daily_availability", {
              resourceId: resourceReq.resourceId,
              date,
              busySlots: slots,
            });
          }
        }
      }
    }

    // 6. Record initial state in history
    await ctx.db.insert("booking_history", {
      bookingId,
      fromStatus: "",
      toStatus: eventType.requiresConfirmation ? "pending" : "confirmed",
      changedBy: "system",
      reason: "Booking created",
      timestamp: now,
    });

    // 7. Return the booking
    const booking = await ctx.db.get(bookingId);
    return booking;
  },
});

// ============================================
// GET BOOKING WITH ITEMS
// ============================================

export const getBookingWithItems = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    const items = await ctx.db
      .query("booking_items")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    // Get resource details for each item
    const itemsWithResources = await Promise.all(
      items.map(async (item) => {
        const resource = await ctx.db
          .query("resources")
          .withIndex("by_external_id", (q) => q.eq("id", item.resourceId))
          .unique();
        return {
          ...item,
          resource,
        };
      })
    );

    return {
      ...booking,
      items: itemsWithResources,
    };
  },
});

// ============================================
// CANCEL MULTI-RESOURCE BOOKING
// ============================================

export const cancelMultiResourceBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.optional(v.string()),
    cancelledBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled");
    }

    // Get all booking items
    const items = await ctx.db
      .query("booking_items")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    const requiredSlots = getRequiredSlots(booking.start, booking.end);

    // Release slots for each resource
    for (const item of items) {
      const resource = await ctx.db
        .query("resources")
        .withIndex("by_external_id", (q) => q.eq("id", item.resourceId))
        .unique();

      const totalQuantity = resource?.quantity ?? 1;
      const isFungible = resource?.isFungible ?? false;

      for (const [date, slots] of requiredSlots.entries()) {
        if (isFungible && totalQuantity > 1) {
          // Release quantity
          const quantityDoc = await ctx.db
            .query("quantity_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", item.resourceId).eq("date", date)
            )
            .unique();

          if (quantityDoc) {
            const bookedQuantities = {
              ...(quantityDoc.slotQuantities as Record<string, number>),
            };
            for (const slot of slots) {
              bookedQuantities[slot.toString()] = Math.max(
                0,
                (bookedQuantities[slot.toString()] ?? 0) - item.quantity
              );
            }
            await ctx.db.patch(quantityDoc._id, {
              slotQuantities: bookedQuantities,
            });
          }
        } else {
          // Release regular slots
          const availability = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
              q.eq("resourceId", item.resourceId).eq("date", date)
            )
            .unique();

          if (availability) {
            const newBusySlots = availability.busySlots.filter(
              (s) => !slots.includes(s)
            );
            await ctx.db.patch(availability._id, { busySlots: newBusySlots });
          }
        }
      }
    }

    // Update booking status
    const now = Date.now();
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: args.reason,
      updatedAt: now,
    });

    // Record in history
    await ctx.db.insert("booking_history", {
      bookingId: args.bookingId,
      fromStatus: booking.status,
      toStatus: "cancelled",
      changedBy: args.cancelledBy ?? "unknown",
      reason: args.reason,
      timestamp: now,
    });

    return { success: true };
  },
});
