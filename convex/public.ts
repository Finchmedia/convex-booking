/**
 * Public Booking API — anonymous sandbox
 *
 * Everything in this module is callable without signing in:
 *
 * - Reads (resources, event types, availability, presence) pass through to the
 *   @mrfinch/booking component. The availability wrappers are SCHEDULE-AWARE
 *   on the server: the React Booker only sends resourceId/date/eventLength/
 *   slotInterval, so this module resolves the resource → its organization's
 *   default schedule → `resourceTimezone` + `scheduleId` (month view) /
 *   `availableSlots` (day view). Without a schedule the component's legacy
 *   09:00–17:00 UTC path is used unchanged.
 *
 * - createBooking takes the booker inline (no identity involved) and enforces
 *   the host-side guard the component deliberately leaves to the caller:
 *   15-minute grid, past / min-notice / horizon windows, duration whitelist,
 *   "start is an offered slot" (the same list getDaySlots shows), plus a small
 *   per-email rate limit. Component errors are translated to
 *   `ConvexError({ code, message })` so clients get stable codes instead of
 *   Convex's redacted "Server Error".
 *
 * - cancel / reschedule are authenticated by the booking's management token.
 *
 * Nothing here can wipe or reset the sandbox — that is internal.seed.* (cron).
 */
import { v, ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { publicQuery, publicMutation } from "./functions";

type Ctx = QueryCtx | MutationCtx;

// ============================================
// CONSTANTS
// ============================================

/** Component slot granularity (component/utils.ts SLOT_DURATION_MS). */
const SLOT_MS = 15 * 60 * 1000;
/** Clock-skew grace for the "not in the past" check. */
const PAST_GRACE_MS = 5 * 60 * 1000;
/** Largest month-view window a client may request. */
const MAX_MONTH_RANGE_MS = 62 * 24 * 60 * 60 * 1000;
/** Horizon when an event type sets no maxFutureMinutes (60 days). */
const DEFAULT_MAX_FUTURE_MINUTES = 60 * 24 * 60;
/** Anonymous createBooking: 5 bookings per email per 10 minutes. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/** Presence: max slots a single heartbeat may hold. */
const MAX_PRESENCE_SLOTS = 32;
/** The component's own reschedule-artifact cancellation reason. */
const RESCHEDULE_SENTINEL = "Rescheduled to new time";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================
// LOCAL TYPES (component returns are `any`)
// ============================================

type EventTypeDoc = {
  id: string;
  title: string;
  lengthInMinutes: number;
  lengthInMinutesOptions?: number[];
  slotInterval?: number;
  timezone: string;
  scheduleId?: string;
  minNoticeMinutes?: number;
  maxFutureMinutes?: number;
  isActive?: boolean;
};

type ResourceDoc = {
  id: string;
  organizationId: string;
  timezone: string;
  isActive: boolean;
  isStandalone?: boolean;
};

type ScheduleDoc = {
  id: string;
  timezone: string;
};

/** Mirrors the component's `bookings` table (dist/component/schema.js). */
type BookingDoc = {
  _id: string;
  _creationTime: number;
  resourceId: string;
  actorId: string;
  start: number;
  end: number;
  status:
    | "provisional"
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "declined"
    | "rescheduled";
  uid: string;
  managementToken?: string;
  eventTypeId: string;
  organizationId?: string;
  timezone: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerNotes?: string;
  eventTitle: string;
  eventDescription?: string;
  location: { type: string; value?: string };
  createdAt: number;
  updatedAt: number;
  cancelledAt?: number;
  rescheduleUid?: string;
  cancellationReason?: string;
};

type DaySlot = { time: string | number };

type BookerInput = {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
};

// ============================================
// SMALL HELPERS
// ============================================

function invalid(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

const isIsoDate = (s: string): boolean =>
  ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`));

const toIsoDateUtc = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

/** "YYYY-MM-DD" of a timestamp in an IANA zone. */
const dateKeyInTz = (ms: number, tz: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);

/** Day key in the resource/schedule zone, or the UTC day on the legacy path. */
const dayKeyFor = (ms: number, tz: string | undefined): string =>
  tz ? dateKeyInTz(ms, tz) : toIsoDateUtc(ms);

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const isSaneEventLength = (n: number): boolean =>
  Number.isInteger(n) && n >= 15 && n <= 1440;

const isSaneSlotInterval = (n: number | undefined): boolean =>
  n === undefined || (Number.isInteger(n) && n >= 15 && n <= 240);

const sanitizeUid = (uid: string | undefined): string | undefined => {
  const t = uid?.trim();
  return t && t.length <= 100 ? t : undefined;
};

const slotTimeMs = (t: string | number): number =>
  typeof t === "number" ? t : Date.parse(t);

/** Durations the booker may pick: curated options, else the default only. */
const allowedDurations = (et: EventTypeDoc): number[] =>
  et.lengthInMinutesOptions?.length
    ? et.lengthInMinutesOptions
    : [et.lengthInMinutes];

/**
 * MUST match the Booker's derivation (react/hooks/use-convex-slots.ts):
 * `slotInterval ?? min(allDurationOptions) ?? eventLength`.
 */
const effectiveSlotInterval = (et: EventTypeDoc): number =>
  et.slotInterval ??
  (et.lengthInMinutesOptions?.length
    ? Math.min(...et.lengthInMinutesOptions)
    : et.lengthInMinutes);

function formatMinutes(minutes: number): string {
  if (minutes % (24 * 60) === 0 && minutes >= 24 * 60) {
    const d = minutes / (24 * 60);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const h = minutes / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function resendOptions() {
  return process.env.RESEND_API_KEY
    ? {
        apiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.RESEND_FROM_EMAIL,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      }
    : undefined;
}

// ============================================
// COMPONENT ERROR TRANSLATION
// ============================================

/** Substring → ConvexError code. Order matters for overlapping prefixes. */
const COMPONENT_ERRORS: Array<[needle: string, code: string, message: string]> = [
  ["Time slot no longer available", "SLOT_NOT_AVAILABLE", "This time slot is no longer available — please pick another one."],
  ["Resource is not available for the requested time range", "SLOT_NOT_AVAILABLE", "This time slot is no longer available — please pick another one."],
  ["Conflict detected on", "SLOT_NOT_AVAILABLE", "This time slot is no longer available — please pick another one."],
  ["Invalid time range", "INVALID_RANGE", "End time must be after start time."],
  ["Event type not found", "EVENT_TYPE_NOT_FOUND", "This event type no longer exists."],
  ["Event type is no longer active", "EVENT_TYPE_INACTIVE", "This event type is no longer available for booking."],
  ["Resource not found", "RESOURCE_NOT_FOUND", "This resource no longer exists."],
  ["Resource is no longer active", "RESOURCE_INACTIVE", "This resource is no longer available."],
  ["cannot be booked alone", "RESOURCE_NOT_STANDALONE", "This resource can only be booked as an add-on."],
  ["Resource is not available for this event type", "NOT_LINKED", "This resource is not available for this event type."],
  ["Booking not found", "NOT_FOUND", "Booking not found."],
  ["Invalid token", "INVALID_TOKEN", "Invalid booking link."],
];

/**
 * Rethrow a component failure as a ConvexError. ConvexErrors pass through
 * untouched; plain Errors are mapped by message; anything else → BOOKING_FAILED.
 */
function translateComponentError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  const message = error instanceof Error ? error.message : String(error);

  const stateMatch = message.match(
    /Cannot (reschedule|cancel) booking with status: (\w+)/
  );
  if (stateMatch) {
    invalid(
      "INVALID_STATE",
      `This booking can no longer be changed (status: ${stateMatch[2]}).`
    );
  }
  for (const [needle, code, text] of COMPONENT_ERRORS) {
    if (message.includes(needle)) invalid(code, text);
  }
  invalid("BOOKING_FAILED", "Booking failed — please try again.");
}

// ============================================
// AVAILABILITY RESOLUTION (resource → schedule)
// ============================================

type AvailabilityContext = {
  resource: ResourceDoc;
  eventType: EventTypeDoc | null;
  /** External schedule id (`schedule.id`), undefined without a schedule. */
  scheduleId: string | undefined;
  /** The schedule's timezone — the coordinate system of `availableSlots`. */
  timezone: string | undefined;
  minNoticeMinutes: number;
  maxFutureMinutes: number;
};

/**
 * Resolve everything the availability queries and the booking guard need.
 *
 * Schedule precedence: the event type's own scheduleId (if an event type is
 * known and it points at an existing schedule) → the organization's default
 * schedule (`getDefaultSchedule`: isDefault, else the first one) → none.
 *
 * The React Booker never sends an eventTypeId to the availability queries, so
 * the notice/horizon windows fall back to the active event types linked to the
 * resource (min notice, max horizon — never hides a slot that createBooking
 * would accept for some event type).
 */
async function resolveAvailabilityContext(
  ctx: Ctx,
  resourceId: string,
  opts: { eventTypeId?: string; eventType?: EventTypeDoc } = {}
): Promise<AvailabilityContext | null> {
  const resource = (await ctx.runQuery(components.booking.resources.getResource, {
    id: resourceId,
  })) as ResourceDoc | null;
  if (!resource || resource.isActive === false) return null;

  let eventType: EventTypeDoc | null = opts.eventType ?? null;
  if (!eventType && opts.eventTypeId) {
    try {
      eventType = (await ctx.runQuery(components.booking.public.getEventType, {
        eventTypeId: opts.eventTypeId,
      })) as EventTypeDoc;
    } catch {
      eventType = null;
    }
    if (eventType && eventType.isActive === false) return null;
  }

  const windowTypes: EventTypeDoc[] = eventType
    ? [eventType]
    : (
        (await ctx.runQuery(
          components.booking.resource_event_types.getEventTypesForResource,
          { resourceId }
        )) as Array<EventTypeDoc | null>
      ).filter((et): et is EventTypeDoc => !!et && et.isActive !== false);

  let schedule: ScheduleDoc | null = null;
  if (eventType?.scheduleId) {
    schedule = (await ctx.runQuery(components.booking.schedules.getSchedule, {
      id: eventType.scheduleId,
    })) as ScheduleDoc | null;
  }
  if (!schedule) {
    schedule = (await ctx.runQuery(
      components.booking.schedules.getDefaultSchedule,
      { organizationId: resource.organizationId }
    )) as ScheduleDoc | null;
  }

  const minNoticeMinutes = windowTypes.length
    ? Math.min(...windowTypes.map((et) => et.minNoticeMinutes ?? 0))
    : 0;
  const maxFutureMinutes = windowTypes.length
    ? Math.max(
        ...windowTypes.map(
          (et) => et.maxFutureMinutes ?? DEFAULT_MAX_FUTURE_MINUTES
        )
      )
    : DEFAULT_MAX_FUTURE_MINUTES;

  return {
    resource,
    eventType,
    scheduleId: schedule?.id,
    timezone: schedule?.timezone,
    minNoticeMinutes,
    maxFutureMinutes,
  };
}

/**
 * The slots the component offers for one resource-local day — schedule-aware
 * when a schedule exists (resourceTimezone + availableSlots are always passed
 * together; the component silently falls back to 09–17 UTC otherwise).
 */
async function offeredDaySlots(
  ctx: Ctx,
  avail: AvailabilityContext,
  opts: {
    date: string;
    eventLength: number;
    slotInterval: number | undefined;
    excludeBookingUid?: string;
  }
): Promise<DaySlot[]> {
  let availableSlots: number[] | undefined;
  if (avail.scheduleId && avail.timezone) {
    const effective = (await ctx.runQuery(
      components.booking.schedules.getEffectiveAvailability,
      { scheduleId: avail.scheduleId, date: opts.date }
    )) as { availableSlots: number[] };
    availableSlots = effective.availableSlots;
    // Empty window (weekend, "unavailable" override): no slots, skip the call.
    if (availableSlots.length === 0) return [];
  }

  const slots = (await ctx.runQuery(components.booking.public.getDaySlots, {
    resourceId: avail.resource.id,
    date: opts.date,
    eventLength: opts.eventLength,
    slotInterval: opts.slotInterval,
    resourceTimezone: availableSlots ? avail.timezone : undefined,
    availableSlots,
    excludeBookingUid: opts.excludeBookingUid,
  })) as DaySlot[];
  return slots;
}

// ============================================
// BOOKING GUARD (shared by create / reschedule)
// ============================================

function assertBookableRange(start: number, end: number): void {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    invalid("INVALID_TIME", "Invalid time value.");
  }
  if (start % SLOT_MS !== 0 || end % SLOT_MS !== 0) {
    invalid("SLOT_NOT_ALIGNED", "Times must be on the 15-minute grid.");
  }
  if (end <= start) {
    invalid("INVALID_RANGE", "End time must be after start time.");
  }
}

function sanitizeBooker(input: BookerInput): BookerInput {
  const name = input.name.trim();
  if (!name) invalid("NAME_REQUIRED", "Please enter your name.");
  if (name.length > 120) {
    invalid("NAME_TOO_LONG", "Name is too long (max 120 characters).");
  }
  const email = input.email.trim();
  if (!email || email.length > 254 || !email.includes("@")) {
    invalid("INVALID_EMAIL", "Please enter a valid email address.");
  }
  const phone = input.phone?.trim() || undefined;
  if (phone && phone.length > 30) {
    invalid("PHONE_TOO_LONG", "Phone number is too long (max 30 characters).");
  }
  const notes = input.notes?.trim() || undefined;
  if (notes && notes.length > 1000) {
    invalid("NOTES_TOO_LONG", "Notes are too long (max 1000 characters).");
  }
  return { name, email, phone, notes };
}

async function loadBookableEventType(
  ctx: Ctx,
  eventTypeId: string
): Promise<EventTypeDoc> {
  let eventType: EventTypeDoc | null = null;
  try {
    eventType = (await ctx.runQuery(components.booking.public.getEventType, {
      eventTypeId,
    })) as EventTypeDoc;
  } catch (error) {
    translateComponentError(error);
  }
  if (!eventType) {
    invalid("EVENT_TYPE_NOT_FOUND", "This event type no longer exists.");
  }
  if (eventType.isActive === false) {
    invalid(
      "EVENT_TYPE_INACTIVE",
      "This event type is no longer available for booking."
    );
  }
  return eventType;
}

async function loadBookableResource(
  ctx: Ctx,
  resourceId: string,
  eventTypeId: string
): Promise<ResourceDoc> {
  const resource = (await ctx.runQuery(components.booking.resources.getResource, {
    id: resourceId,
  })) as ResourceDoc | null;
  if (!resource) {
    invalid("RESOURCE_NOT_FOUND", "This resource no longer exists.");
  }
  if (resource.isActive === false) {
    invalid("RESOURCE_INACTIVE", "This resource is no longer available.");
  }
  if (resource.isStandalone === false) {
    invalid(
      "RESOURCE_NOT_STANDALONE",
      "This resource can only be booked as an add-on."
    );
  }
  const linked = (await ctx.runQuery(
    components.booking.resource_event_types.hasResourceEventTypeLink,
    { resourceId, eventTypeId }
  )) as boolean;
  if (!linked) {
    invalid("NOT_LINKED", "This resource is not available for this event type.");
  }
  return resource;
}

/** Duration whitelist → minutes. */
function assertAllowedDuration(
  eventType: EventTypeDoc,
  start: number,
  end: number
): number {
  const durationMinutes = (end - start) / 60_000;
  const allowed = allowedDurations(eventType);
  if (!Number.isInteger(durationMinutes) || !allowed.includes(durationMinutes)) {
    invalid(
      "INVALID_DURATION",
      `Invalid duration — choose one of ${allowed.join(", ")} minutes.`
    );
  }
  return durationMinutes;
}

/** Past (with grace), minimum notice, maximum horizon. */
function assertBookingWindow(
  eventType: EventTypeDoc,
  start: number,
  now: number
): void {
  if (start < now - PAST_GRACE_MS) {
    invalid("IN_PAST", "This time is in the past.");
  }
  const minNoticeMinutes = eventType.minNoticeMinutes ?? 0;
  if (start < now + minNoticeMinutes * 60_000) {
    invalid(
      "TOO_SOON",
      `This time is too soon — bookings need at least ${formatMinutes(minNoticeMinutes)} notice.`
    );
  }
  const maxFutureMinutes =
    eventType.maxFutureMinutes ?? DEFAULT_MAX_FUTURE_MINUTES;
  if (start > now + maxFutureMinutes * 60_000) {
    invalid(
      "TOO_FAR_AHEAD",
      `This time is too far in the future — bookings can be made up to ${formatMinutes(maxFutureMinutes)} ahead.`
    );
  }
}

/**
 * Master guard: the start must be one of the slots getDaySlots would offer
 * for this resource/event type/duration on that (resource-local) day. This
 * subsumes schedule windows, date overrides, grid alignment for the duration,
 * "runs past closing" and busy collisions — validated against the OFFERED list
 * rather than re-deriving the rules.
 */
async function assertStartIsOfferedSlot(
  ctx: Ctx,
  opts: {
    resource: ResourceDoc;
    eventType: EventTypeDoc;
    start: number;
    durationMinutes: number;
    excludeBookingUid?: string;
  }
): Promise<void> {
  const avail = await resolveAvailabilityContext(ctx, opts.resource.id, {
    eventType: opts.eventType,
  });
  if (!avail) {
    invalid("RESOURCE_INACTIVE", "This resource is no longer available.");
  }
  const date = dayKeyFor(opts.start, avail.timezone);
  const slots = await offeredDaySlots(ctx, avail, {
    date,
    eventLength: opts.durationMinutes,
    slotInterval: effectiveSlotInterval(opts.eventType),
    excludeBookingUid: opts.excludeBookingUid,
  });
  if (!slots.some((s) => slotTimeMs(s.time) === opts.start)) {
    invalid(
      "SLOT_NOT_AVAILABLE",
      "This time slot is no longer available — please pick another one."
    );
  }
}

/** Fixed window per booker email. Rolled back with the transaction on failure. */
async function enforceBookingRateLimit(
  ctx: MutationCtx,
  email: string
): Promise<void> {
  const key = `email:${email.toLowerCase()}`;
  const now = Date.now();
  const row = await ctx.db
    .query("bookingRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!row || row.windowStart + RATE_LIMIT_WINDOW_MS <= now) {
    if (row) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("bookingRateLimits", { key, windowStart: now, count: 1 });
    }
    return;
  }
  if (row.count >= RATE_LIMIT_MAX) {
    invalid(
      "RATE_LIMITED",
      "Too many bookings from this email address — please try again in a few minutes."
    );
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

async function loadBookingByToken(
  ctx: Ctx,
  uid: string,
  token: string
): Promise<BookingDoc> {
  try {
    return (await ctx.runQuery(components.booking.public.getBookingByToken, {
      uid,
      token,
    })) as BookingDoc;
  } catch (error) {
    translateComponentError(error);
  }
}

function sanitizeTokenArgs(uid: string, token: string) {
  const u = uid.trim();
  const t = token.trim();
  if (!u || u.length > 100 || !t || t.length > 200) {
    invalid("INVALID_TOKEN", "Invalid booking link.");
  }
  return { uid: u, token: t };
}

// ============================================
// RESOURCES (Public Read)
// ============================================

/**
 * List available resources for public booking
 * Only shows active resources
 */
export const listResources = publicQuery({
  args: {
    organizationId: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.listResources, {
      organizationId: args.organizationId,
      type: args.type,
      activeOnly: true, // Always filter to active for public
    });
  },
});

/**
 * Get a single resource by ID
 */
export const getResource = publicQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.resources.getResource, args);
  },
});

// ============================================
// EVENT TYPES (Public Read)
// ============================================

/**
 * List event types for a resource
 */
export const getEventTypesForResource = publicQuery({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.getEventTypesForResource,
      args
    );
  },
});

/**
 * Check if a resource is linked to an event type
 * Used by Booker to validate the booking is still valid
 */
export const hasResourceEventTypeLink = publicQuery({
  args: {
    resourceId: v.string(),
    eventTypeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.resource_event_types.hasResourceEventTypeLink,
      args
    );
  },
});

/**
 * Get a single event type by ID
 */
export const getEventType = publicQuery({
  args: { eventTypeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getEventType, args);
  },
});

/**
 * Get event type by slug (for booking URLs)
 */
export const getEventTypeBySlug = publicQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getEventTypeBySlug, args);
  },
});

/**
 * List all active event types
 */
export const listEventTypes = publicQuery({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.listEventTypes, {
      organizationId: args.organizationId,
      activeOnly: true, // Always filter to active for public
    });
  },
});

// ============================================
// AVAILABILITY (Public Read, schedule-aware)
// ============================================

/**
 * Month availability map for the calendar: Record<"YYYY-MM-DD", boolean>.
 *
 * Schedule-aware: resolves the resource's schedule server-side and passes
 * resourceTimezone + scheduleId to the component. Past days are forced to
 * false; days beyond the booking horizon are false; malformed input yields {}.
 * `eventTypeId` / `excludeBookingUid` are optional so a future Booker can send
 * them (the current one does not).
 */
export const getMonthAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
    eventTypeId: v.optional(v.string()),
    excludeBookingUid: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Record<string, boolean>> => {
    if (!isIsoDate(args.dateFrom) || !isIsoDate(args.dateTo)) return {};
    const fromMs = Date.parse(`${args.dateFrom}T00:00:00.000Z`);
    const toMs = Date.parse(`${args.dateTo}T00:00:00.000Z`);
    if (toMs < fromMs || toMs - fromMs > MAX_MONTH_RANGE_MS) return {};
    if (!isSaneEventLength(args.eventLength)) return {};
    if (!isSaneSlotInterval(args.slotInterval)) return {};

    const avail = await resolveAvailabilityContext(ctx, args.resourceId, {
      eventTypeId: args.eventTypeId,
    });
    if (!avail) return {};

    const now = Date.now();
    const horizonMs = now + avail.maxFutureMinutes * 60_000;
    const effectiveTo = Math.min(toMs, horizonMs);

    const result: Record<string, boolean> = {};
    if (fromMs <= effectiveTo) {
      const fromComponent = (await ctx.runQuery(
        components.booking.public.getMonthAvailability,
        {
          resourceId: args.resourceId,
          dateFrom: args.dateFrom,
          dateTo: toIsoDateUtc(effectiveTo),
          eventLength: args.eventLength,
          slotInterval:
            args.slotInterval ??
            (avail.eventType ? effectiveSlotInterval(avail.eventType) : undefined),
          // Both or neither — otherwise the component silently takes the legacy path.
          resourceTimezone: avail.scheduleId ? avail.timezone : undefined,
          scheduleId: avail.scheduleId,
          excludeBookingUid: sanitizeUid(args.excludeBookingUid),
        }
      )) as Record<string, boolean>;
      Object.assign(result, fromComponent);
    }

    // Past days and days beyond the horizon read as unavailable.
    const todayKey = dayKeyFor(now, avail.timezone);
    for (let ms = fromMs; ms <= toMs; ms += 24 * 60 * 60 * 1000) {
      const key = toIsoDateUtc(ms);
      if (key < todayKey || ms > effectiveTo) {
        result[key] = false;
      } else if (!(key in result)) {
        result[key] = false;
      }
    }
    return result;
  },
});

/**
 * Detailed slots for a single (resource-local) day: [{ time }].
 *
 * Schedule-aware: passes resourceTimezone + availableSlots (from the resolved
 * schedule) to the component. Past days, days beyond the horizon and slots
 * inside the minimum-notice window are not offered — matching what
 * createBooking accepts.
 */
export const getDaySlots = publicQuery({
  args: {
    resourceId: v.string(),
    date: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
    eventTypeId: v.optional(v.string()),
    excludeBookingUid: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DaySlot[]> => {
    if (!isIsoDate(args.date)) return [];
    if (!isSaneEventLength(args.eventLength)) return [];
    if (!isSaneSlotInterval(args.slotInterval)) return [];

    const avail = await resolveAvailabilityContext(ctx, args.resourceId, {
      eventTypeId: args.eventTypeId,
    });
    if (!avail) return [];

    const now = Date.now();
    const todayKey = dayKeyFor(now, avail.timezone);
    if (args.date < todayKey) return [];
    const dayStartMs = Date.parse(`${args.date}T00:00:00.000Z`);
    if (dayStartMs > now + avail.maxFutureMinutes * 60_000) return [];

    const slots = await offeredDaySlots(ctx, avail, {
      date: args.date,
      eventLength: args.eventLength,
      slotInterval:
        args.slotInterval ??
        (avail.eventType ? effectiveSlotInterval(avail.eventType) : undefined),
      excludeBookingUid: sanitizeUid(args.excludeBookingUid),
    });

    const notBefore = now + avail.minNoticeMinutes * 60_000;
    return slots.filter((s) => slotTimeMs(s.time) >= notBefore);
  },
});

/**
 * Raw slot-collision check for a time range (ignores opening hours).
 * Kept for the docs demo; do not use it for UI availability.
 */
export const getAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getAvailability, args);
  },
});

// ============================================
// PRESENCE (Session-based, client-generated user id)
// ============================================

/**
 * Get all active presence holds for a date
 * Used by frontend to filter out reserved slots
 */
export const getDatePresence = publicQuery({
  args: {
    resourceId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.presence.getDatePresence,
      args
    );
  },
});

/**
 * Get presence for a specific slot
 */
export const getPresence = publicQuery({
  args: {
    resourceId: v.string(),
    slot: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.presence.list, args);
  },
});

/**
 * Heartbeat to maintain slot hold
 * Called every 5 seconds while user is selecting a slot
 */
export const heartbeat = publicMutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(), // Client-generated session ID
    eventTypeId: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.slots.length > MAX_PRESENCE_SLOTS) {
      invalid("TOO_MANY_SLOTS", "Too many slots in one hold.");
    }
    return await ctx.runMutation(components.booking.presence.heartbeat, args);
  },
});

/**
 * Release slot hold
 * Called when user navigates away or cancels selection
 */
export const leave = publicMutation({
  args: {
    resourceId: v.string(),
    slots: v.array(v.string()),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.booking.presence.leave, args);
  },
});

// ============================================
// BOOKING (Anonymous, guarded)
// ============================================

/**
 * Create a booking as an anonymous visitor.
 *
 * Guard order: cheap validators → event type → resource/link → duration →
 * past/notice/horizon → offered-slot check → rate limit → component write.
 * Every failure is a ConvexError({ code, message }).
 */
export const createBooking = publicMutation({
  args: {
    eventTypeId: v.string(),
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
    timezone: v.string(),
    booker: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    location: v.object({
      type: v.string(),
      value: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    assertBookableRange(args.start, args.end);
    if (!isValidTimezone(args.timezone)) {
      invalid("INVALID_TIMEZONE", "Unknown timezone.");
    }
    const booker = sanitizeBooker(args.booker);
    const location = {
      type: args.location.type,
      value: args.location.value?.slice(0, 300),
    };

    const eventType = await loadBookableEventType(ctx, args.eventTypeId);
    const resource = await loadBookableResource(
      ctx,
      args.resourceId,
      args.eventTypeId
    );
    const durationMinutes = assertAllowedDuration(eventType, args.start, args.end);
    assertBookingWindow(eventType, args.start, Date.now());
    await assertStartIsOfferedSlot(ctx, {
      resource,
      eventType,
      start: args.start,
      durationMinutes,
    });

    await enforceBookingRateLimit(ctx, booker.email);

    let booking: unknown;
    try {
      booking = await ctx.runMutation(components.booking.public.createBooking, {
        eventTypeId: args.eventTypeId,
        resourceId: args.resourceId,
        start: args.start,
        end: args.end,
        timezone: args.timezone,
        booker,
        location,
        resendOptions: resendOptions(),
      });
    } catch (error) {
      translateComponentError(error);
    }
    if (!booking) {
      invalid("BOOKING_FAILED", "Booking failed — please try again.");
    }
    return booking;
  },
});

/**
 * Get booking by ID
 * Public access (booking ID is effectively a secret)
 */
export const getBooking = publicQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBooking, {
      bookingId: args.bookingId,
    });
  },
});

/**
 * Get booking by UID (confirmation code)
 */
export const getBookingByUid = publicQuery({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.booking.public.getBookingByUid, args);
  },
});

/**
 * Get booking by token (for public management)
 * Requires both UID and management token for access
 */
export const getBookingByToken = publicQuery({
  args: { uid: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const { uid, token } = sanitizeTokenArgs(args.uid, args.token);
    return await loadBookingByToken(ctx, uid, token);
  },
});

/**
 * Cancel booking by token (for public management)
 * Idempotent: cancelling an already-cancelled booking is a no-op success.
 */
export const cancelBookingByToken = publicMutation({
  args: {
    uid: v.string(),
    token: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { uid, token } = sanitizeTokenArgs(args.uid, args.token);
    const booking = await loadBookingByToken(ctx, uid, token);

    if (booking.status === "cancelled") {
      return { success: true as const, alreadyCancelled: true as const };
    }
    if (booking.status === "completed" || booking.status === "declined") {
      invalid(
        "INVALID_STATE",
        booking.status === "completed"
          ? "This booking is already completed."
          : "This booking was declined."
      );
    }

    const reason = args.reason?.trim().slice(0, 500) || undefined;
    if (reason === RESCHEDULE_SENTINEL) {
      invalid("RESERVED_REASON", "Please choose a different cancellation reason.");
    }

    try {
      return await ctx.runMutation(components.booking.public.cancelBookingByToken, {
        uid,
        token,
        reason,
        resendOptions: resendOptions(),
      });
    } catch (error) {
      translateComponentError(error);
    }
  },
});

/**
 * Reschedule booking by token (for public management)
 * Runs the same guard as createBooking on the new time, with the booking's own
 * slots treated as free. Returns the NEW booking (new uid, same token).
 */
export const rescheduleBookingByToken = publicMutation({
  args: {
    uid: v.string(),
    token: v.string(),
    newStart: v.number(),
    newEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const { uid, token } = sanitizeTokenArgs(args.uid, args.token);
    const booking = await loadBookingByToken(ctx, uid, token);

    if (!["pending", "confirmed"].includes(booking.status)) {
      invalid(
        "INVALID_STATE",
        `This booking can no longer be rescheduled (status: ${booking.status}).`
      );
    }
    const now = Date.now();
    if (booking.start <= now) {
      invalid(
        "ALREADY_STARTED",
        "This booking has already started and cannot be rescheduled."
      );
    }
    if (args.newStart === booking.start && args.newEnd === booking.end) {
      invalid(
        "SAME_SLOT",
        "The booking is already at this time — please pick a different slot."
      );
    }

    assertBookableRange(args.newStart, args.newEnd);
    const eventType = await loadBookableEventType(ctx, booking.eventTypeId);
    const resource = await loadBookableResource(
      ctx,
      booking.resourceId,
      booking.eventTypeId
    );
    const durationMinutes = assertAllowedDuration(
      eventType,
      args.newStart,
      args.newEnd
    );
    assertBookingWindow(eventType, args.newStart, now);
    await assertStartIsOfferedSlot(ctx, {
      resource,
      eventType,
      start: args.newStart,
      durationMinutes,
      excludeBookingUid: booking.uid,
    });

    try {
      return await ctx.runMutation(
        components.booking.public.rescheduleBookingByToken,
        {
          uid,
          token,
          newStart: args.newStart,
          newEnd: args.newEnd,
          resendOptions: resendOptions(),
        }
      );
    } catch (error) {
      translateComponentError(error);
    }
  },
});

// ============================================
// SCHEDULES (Public Read - for availability display)
// ============================================

/**
 * Get effective availability for a schedule on a date
 * Used to display business hours
 */
export const getEffectiveAvailability = publicQuery({
  args: {
    scheduleId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.booking.schedules.getEffectiveAvailability,
      args
    );
  },
});
