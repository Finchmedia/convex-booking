import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// SCHEDULE QUERIES
// ============================================

export const getSchedule = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schedules")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const getScheduleById = query({
  args: { scheduleId: v.id("schedules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scheduleId);
  },
});

export const listSchedules = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schedules")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const getDefaultSchedule = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return schedules.find((s) => s.isDefault) ?? schedules[0] ?? null;
  },
});

// ============================================
// SCHEDULE MUTATIONS
// ============================================

export const createSchedule = mutation({
  args: {
    id: v.string(),
    organizationId: v.id("organizations"),
    name: v.string(),
    timezone: v.string(),
    isDefault: v.optional(v.boolean()),
    weeklyHours: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check for existing ID
    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      throw new Error(`Schedule with ID "${args.id}" already exists`);
    }

    // If this is default, unset other defaults
    if (args.isDefault) {
      const schedules = await ctx.db
        .query("schedules")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      for (const schedule of schedules) {
        if (schedule.isDefault) {
          await ctx.db.patch(schedule._id, { isDefault: false });
        }
      }
    }

    const now = Date.now();
    return await ctx.db.insert("schedules", {
      id: args.id,
      organizationId: args.organizationId,
      name: args.name,
      timezone: args.timezone,
      isDefault: args.isDefault ?? false,
      weeklyHours: args.weeklyHours,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSchedule = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    weeklyHours: v.optional(
      v.array(
        v.object({
          dayOfWeek: v.number(),
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!schedule) {
      throw new Error(`Schedule "${args.id}" not found`);
    }

    // If setting as default, unset other defaults
    if (args.isDefault && !schedule.isDefault) {
      const schedules = await ctx.db
        .query("schedules")
        .withIndex("by_org", (q) =>
          q.eq("organizationId", schedule.organizationId)
        )
        .collect();

      for (const s of schedules) {
        if (s.isDefault && s._id !== schedule._id) {
          await ctx.db.patch(s._id, { isDefault: false });
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;
    if (args.weeklyHours !== undefined) updates.weeklyHours = args.weeklyHours;

    await ctx.db.patch(schedule._id, updates);
    return schedule._id;
  },
});

export const deleteSchedule = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_external_id", (q) => q.eq("id", args.id))
      .unique();

    if (!schedule) {
      throw new Error(`Schedule "${args.id}" not found`);
    }

    // Delete associated date overrides
    const overrides = await ctx.db
      .query("date_overrides")
      .withIndex("by_schedule_date", (q) => q.eq("scheduleId", schedule._id))
      .collect();

    for (const override of overrides) {
      await ctx.db.delete(override._id);
    }

    await ctx.db.delete(schedule._id);
    return { success: true };
  },
});

// ============================================
// DATE OVERRIDE QUERIES
// ============================================

export const listDateOverrides = query({
  args: {
    scheduleId: v.id("schedules"),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const overrides = await ctx.db
      .query("date_overrides")
      .withIndex("by_schedule_date", (q) => q.eq("scheduleId", args.scheduleId))
      .collect();

    // Filter by date range if specified
    let filtered = overrides;
    if (args.dateFrom) {
      filtered = filtered.filter((o) => o.date >= args.dateFrom!);
    }
    if (args.dateTo) {
      filtered = filtered.filter((o) => o.date <= args.dateTo!);
    }

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const getDateOverride = query({
  args: {
    scheduleId: v.id("schedules"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const overrides = await ctx.db
      .query("date_overrides")
      .withIndex("by_schedule_date", (q) => q.eq("scheduleId", args.scheduleId))
      .collect();

    return overrides.find((o) => o.date === args.date) ?? null;
  },
});

// ============================================
// DATE OVERRIDE MUTATIONS
// ============================================

export const createDateOverride = mutation({
  args: {
    scheduleId: v.id("schedules"),
    date: v.string(),
    type: v.string(), // "unavailable" | "custom"
    customHours: v.optional(
      v.array(
        v.object({
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    // Check for existing override on this date
    const overrides = await ctx.db
      .query("date_overrides")
      .withIndex("by_schedule_date", (q) => q.eq("scheduleId", args.scheduleId))
      .collect();

    const existing = overrides.find((o) => o.date === args.date);
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        type: args.type,
        customHours: args.customHours,
      });
      return existing._id;
    }

    return await ctx.db.insert("date_overrides", {
      scheduleId: args.scheduleId,
      date: args.date,
      type: args.type,
      customHours: args.customHours,
    });
  },
});

export const updateDateOverride = mutation({
  args: {
    overrideId: v.id("date_overrides"),
    type: v.optional(v.string()),
    customHours: v.optional(
      v.array(
        v.object({
          startTime: v.string(),
          endTime: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) {
      throw new Error("Date override not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.type !== undefined) updates.type = args.type;
    if (args.customHours !== undefined) updates.customHours = args.customHours;

    await ctx.db.patch(args.overrideId, updates);
    return args.overrideId;
  },
});

export const deleteDateOverride = mutation({
  args: { overrideId: v.id("date_overrides") },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) {
      throw new Error("Date override not found");
    }

    await ctx.db.delete(args.overrideId);
    return { success: true };
  },
});

// ============================================
// EFFECTIVE AVAILABILITY
// ============================================

/**
 * Convert time string "HH:MM" to slot index (0-95)
 */
function timeToSlot(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 4 + Math.floor(minutes / 15);
}

/**
 * Get the effective available slots for a resource on a specific date.
 * This considers the schedule's weekly hours and any date overrides.
 */
export const getEffectiveAvailability = query({
  args: {
    scheduleId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_external_id", (q) => q.eq("id", args.scheduleId))
      .unique();

    if (!schedule) {
      // No schedule = default business hours (9-17)
      return { availableSlots: Array.from({ length: 32 }, (_, i) => i + 36) };
    }

    // Check for date override
    const overrides = await ctx.db
      .query("date_overrides")
      .withIndex("by_schedule_date", (q) => q.eq("scheduleId", schedule._id))
      .collect();

    const override = overrides.find((o) => o.date === args.date);

    if (override) {
      if (override.type === "unavailable") {
        return { availableSlots: [] };
      }
      if (override.customHours && override.customHours.length > 0) {
        const slots: number[] = [];
        for (const range of override.customHours) {
          const startSlot = timeToSlot(range.startTime);
          const endSlot = timeToSlot(range.endTime);
          for (let i = startSlot; i < endSlot; i++) {
            slots.push(i);
          }
        }
        return { availableSlots: slots };
      }
    }

    // Get day of week for the date
    const dateObj = new Date(args.date);
    const dayOfWeek = dateObj.getDay();

    // Find weekly hours for this day
    const dayEntries = schedule.weeklyHours.filter(
      (h) => h.dayOfWeek === dayOfWeek
    );

    if (dayEntries.length === 0) {
      return { availableSlots: [] };
    }

    const slots: number[] = [];
    for (const entry of dayEntries) {
      const startSlot = timeToSlot(entry.startTime);
      const endSlot = timeToSlot(entry.endTime);
      for (let i = startSlot; i < endSlot; i++) {
        if (!slots.includes(i)) {
          slots.push(i);
        }
      }
    }

    return { availableSlots: slots.sort((a, b) => a - b) };
  },
});
