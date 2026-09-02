/**
 * Demo data + hourly sandbox reset.
 *
 * - seedDemoData:     one org ("demo-org"), a default schedule, 4 resources,
 *                     2 event types, links. Mon–Fri 09:00–18:00 Europe/Berlin.
 * - wipeSandbox:      components.booking.maintenance.wipeAllData (bookings AND
 *                     setup rows; presence is left to expire).
 * - cleanupGuestUsers: deletes app `users` (anonymous guest admins) older than
 *                     an hour plus stale rate-limit rows, in batches.
 * - resetSandbox:     internalAction run by crons.ts every hour:
 *                     wipe → seed → cleanup, each as its own mutation.
 *
 * Order is mandatory: createSchedule / createResource throw on duplicate ids,
 * so the wipe must precede the reseed. Nothing here is publicly callable.
 */
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";

const ORG_ID = "demo-org";
const TZ = "Europe/Berlin";

/** Guest users older than this are deleted by the reset. */
const GUEST_MAX_AGE_MS = 60 * 60 * 1000;
/** Rate-limit rows older than this are deleted by the reset. */
const RATE_LIMIT_MAX_AGE_MS = 10 * 60 * 1000;
const CLEANUP_BATCH = 200;

// ============================================
// SEED
// ============================================

export async function seedAll(ctx: MutationCtx) {
  // 1. Default schedule (validated by the component: HH:MM on the 15-min grid,
  //    start < end, dayOfWeek 0-6, no overlapping windows).
  await ctx.runMutation(components.booking.schedules.createSchedule, {
    id: "business-hours",
    organizationId: ORG_ID,
    name: "Business Hours",
    timezone: TZ,
    isDefault: true,
    weeklyHours: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
    ],
  });

  // 2. Resources
  await ctx.runMutation(components.booking.resources.createResource, {
    id: "studio-a",
    organizationId: ORG_ID,
    name: "StudioA",
    description: "Tolles Studio Mit Tollen Boxen",
    type: "room",
    timezone: TZ,
    quantity: 1,
    isFungible: false,
    isActive: true,
  });

  await ctx.runMutation(components.booking.resources.createResource, {
    id: "studio-b",
    organizationId: ORG_ID,
    name: "StudioB",
    description: "Mastering Suite",
    type: "room",
    timezone: TZ,
    quantity: 1,
    isFungible: false,
    isActive: true,
  });

  await ctx.runMutation(components.booking.resources.createResource, {
    id: "sm7b",
    organizationId: ORG_ID,
    name: "Shure SM7b",
    description: "Studio Standard, Jackson Mic",
    type: "equipment",
    timezone: TZ,
    quantity: 5,
    isFungible: true,
    isStandalone: false,
    isActive: true,
  });

  await ctx.runMutation(components.booking.resources.createResource, {
    id: "keyboard-fp88",
    organizationId: ORG_ID,
    name: "Keyboard FP88",
    description: "Tolles Keyboard",
    type: "equipment",
    timezone: TZ,
    quantity: 1,
    isFungible: false,
    isStandalone: false,
    isActive: true,
  });

  // 3. Event types (organizationId set so org-filtered listings find them;
  //    scheduleId set so the availability resolver can take the direct path).
  await ctx.runMutation(components.booking.public.createEventType, {
    id: "recording-session",
    slug: "recording-session",
    title: "Recording Session",
    description: "Nehme deinen Song auf",
    organizationId: ORG_ID,
    scheduleId: "business-hours",
    lengthInMinutes: 30,
    lengthInMinutesOptions: [30, 60, 180],
    slotInterval: 30,
    timezone: TZ,
    locations: [{ type: "in_person", address: "Studio" }],
    lockTimeZoneToggle: false,
    minNoticeMinutes: 60,
    maxFutureMinutes: 86400,
    bufferBefore: 0,
    bufferAfter: 0,
    requiresConfirmation: false,
    isActive: true,
  });

  await ctx.runMutation(components.booking.public.createEventType, {
    id: "probesession",
    slug: "probesession",
    title: "Probesession",
    description: "Probe deine Musik",
    organizationId: ORG_ID,
    scheduleId: "business-hours",
    lengthInMinutes: 60,
    slotInterval: 60,
    timezone: TZ,
    locations: [{ type: "in_person" }],
    lockTimeZoneToggle: false,
    minNoticeMinutes: 60,
    maxFutureMinutes: 86400,
    bufferBefore: 0,
    bufferAfter: 0,
    requiresConfirmation: false,
    isActive: true,
  });

  // 4. Link resources to event types
  await ctx.runMutation(
    components.booking.resource_event_types.setResourcesForEventType,
    { eventTypeId: "recording-session", resourceIds: ["studio-a", "studio-b"] }
  );

  await ctx.runMutation(
    components.booking.resource_event_types.setResourcesForEventType,
    { eventTypeId: "probesession", resourceIds: ["studio-a", "studio-b"] }
  );

  return {
    organizationId: ORG_ID,
    schedules: 1,
    resources: 4,
    eventTypes: 2,
  };
}

const seedResult = v.object({
  success: v.boolean(),
  message: v.string(),
  organizationId: v.string(),
  schedules: v.number(),
  resources: v.number(),
  eventTypes: v.number(),
});

export const seedDemoData = internalMutation({
  args: {},
  returns: seedResult,
  handler: async (ctx) => {
    const summary = await seedAll(ctx);
    return { success: true, message: "Demo data seeded!", ...summary };
  },
});

// ============================================
// SANDBOX RESET
// ============================================

const wipeResult = v.object({
  bookingHistory: v.number(),
  bookingItems: v.number(),
  bookings: v.number(),
  dailyAvailability: v.number(),
  dateOverrides: v.number(),
  eventTypes: v.number(),
  hooks: v.number(),
  quantityAvailability: v.number(),
  resourceEventTypes: v.number(),
  resources: v.number(),
  schedules: v.number(),
});

/**
 * Wipe every booking AND setup row in the booking component.
 * Internal only — never expose this through public.ts / admin.ts.
 */
export const wipeSandbox = internalMutation({
  args: {},
  returns: wipeResult,
  handler: async (ctx) => {
    return await ctx.runMutation(components.booking.maintenance.wipeAllData, {});
  },
});

const cleanupResult = v.object({
  deletedUsers: v.number(),
  deletedRateLimits: v.number(),
  hasMore: v.boolean(),
});

/**
 * Delete guest-admin `users` rows older than an hour and expired rate-limit
 * rows, one batch per call. Their auth sessions are not revoked (the auth core
 * exposes no per-user session API); they expire on their own.
 */
export const cleanupGuestUsers = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  returns: cleanupResult,
  handler: async (ctx, args) => {
    const now = Date.now();
    const userCutoff = now - (args.olderThanMs ?? GUEST_MAX_AGE_MS);

    const staleUsers = await ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", userCutoff))
      .take(CLEANUP_BATCH);
    for (const user of staleUsers) {
      await ctx.db.delete(user._id);
    }

    const staleLimits = await ctx.db
      .query("bookingRateLimits")
      .withIndex("by_windowStart", (q) =>
        q.lt("windowStart", now - RATE_LIMIT_MAX_AGE_MS)
      )
      .take(CLEANUP_BATCH);
    for (const row of staleLimits) {
      await ctx.db.delete(row._id);
    }

    return {
      deletedUsers: staleUsers.length,
      deletedRateLimits: staleLimits.length,
      hasMore:
        staleUsers.length === CLEANUP_BATCH ||
        staleLimits.length === CLEANUP_BATCH,
    };
  },
});

type ResetResult = {
  wiped: {
    bookingHistory: number;
    bookingItems: number;
    bookings: number;
    dailyAvailability: number;
    dateOverrides: number;
    eventTypes: number;
    hooks: number;
    quantityAvailability: number;
    resourceEventTypes: number;
    resources: number;
    schedules: number;
  };
  seeded: {
    success: boolean;
    message: string;
    organizationId: string;
    schedules: number;
    resources: number;
    eventTypes: number;
  };
  cleanup: { deletedUsers: number; deletedRateLimits: number; batches: number };
};

/**
 * Hourly sandbox reset (crons.ts). Three separate mutations so a large wipe
 * cannot drag the reseed into one oversized transaction.
 */
export const resetSandbox = internalAction({
  args: {},
  returns: v.object({
    wiped: wipeResult,
    seeded: seedResult,
    cleanup: v.object({
      deletedUsers: v.number(),
      deletedRateLimits: v.number(),
      batches: v.number(),
    }),
  }),
  handler: async (ctx): Promise<ResetResult> => {
    const wiped = await ctx.runMutation(internal.seed.wipeSandbox, {});
    const seeded = await ctx.runMutation(internal.seed.seedDemoData, {});

    let deletedUsers = 0;
    let deletedRateLimits = 0;
    let batches = 0;
    for (;;) {
      const r = await ctx.runMutation(internal.seed.cleanupGuestUsers, {});
      deletedUsers += r.deletedUsers;
      deletedRateLimits += r.deletedRateLimits;
      batches += 1;
      if (!r.hasMore || batches >= 50) break;
    }

    return {
      wiped,
      seeded,
      cleanup: { deletedUsers, deletedRateLimits, batches },
    };
  },
});
