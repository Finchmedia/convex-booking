import { internalMutation } from "./_generated/server";
import { api } from "./_generated/api";

export const seedDemoData = internalMutation(async (ctx) => {
  const orgId = "demo-org";
  const tz = "Europe/Berlin";

  // 1. Create Schedule
  await ctx.runMutation(api.booking.createSchedule, {
    id: "business-hours",
    organizationId: orgId,
    name: "Business Hours",
    timezone: tz,
    isDefault: true,
    weeklyHours: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
    ],
  });

  // 2. Create Resources
  await ctx.runMutation(api.booking.createResource, {
    id: "studio-a",
    organizationId: orgId,
    name: "StudioA",
    description: "Tolles Studio Mit Tollen Boxen",
    type: "room",
    timezone: tz,
    quantity: 1,
    isFungible: false,
    isActive: true,
  });

  await ctx.runMutation(api.booking.createResource, {
    id: "studio-b",
    organizationId: orgId,
    name: "StudioB",
    description: "Mastering Suite",
    type: "room",
    timezone: tz,
    quantity: 1,
    isFungible: false,
    isActive: true,
  });

  await ctx.runMutation(api.booking.createResource, {
    id: "sm7b",
    organizationId: orgId,
    name: "Shure SM7b",
    description: "Studio Standard, Jackson Mic",
    type: "equipment",
    timezone: tz,
    quantity: 5,
    isFungible: true,
    isStandalone: false,
    isActive: true,
  });

  await ctx.runMutation(api.booking.createResource, {
    id: "keyboard-fp88",
    organizationId: orgId,
    name: "Keyboard FP88",
    description: "Tolles Keyboard",
    type: "equipment",
    timezone: tz,
    quantity: 1,
    isFungible: false,
    isStandalone: false,
    isActive: true,
  });

  // 3. Create Event Types
  await ctx.runMutation(api.booking.createEventType, {
    id: "recording-session",
    slug: "recording-session",
    title: "Recording Session",
    description: "Nehme deinen Song auf",
    lengthInMinutes: 30,
    lengthInMinutesOptions: [30, 60, 180],
    slotInterval: 30,
    timezone: tz,
    locations: [{ type: "in_person", address: "Studio" }],
    lockTimeZoneToggle: false,
    minNoticeMinutes: 60,
    maxFutureMinutes: 86400,
    bufferBefore: 0,
    bufferAfter: 0,
    requiresConfirmation: false,
    isActive: true,
  });

  await ctx.runMutation(api.booking.createEventType, {
    id: "probesession",
    slug: "probesession",
    title: "Probesession",
    description: "Probe deine Musik",
    lengthInMinutes: 60,
    slotInterval: 60,
    timezone: tz,
    locations: [{ type: "in_person" }],
    lockTimeZoneToggle: false,
    minNoticeMinutes: 60,
    maxFutureMinutes: 86400,
    bufferBefore: 0,
    bufferAfter: 0,
    requiresConfirmation: false,
    isActive: true,
  });

  // 4. Link Resources to Event Types
  await ctx.runMutation(api.booking.setResourcesForEventType, {
    eventTypeId: "recording-session",
    resourceIds: ["studio-a", "studio-b"],
  });

  await ctx.runMutation(api.booking.setResourcesForEventType, {
    eventTypeId: "probesession",
    resourceIds: ["studio-a", "studio-b"],
  });

  return { success: true, message: "Demo data seeded!" };
});
