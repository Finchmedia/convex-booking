/**
 * Public Booking API — anonymous sandbox
 *
 * Everything in this module is callable without signing in:
 *
 * - Reads (resources, event types, availability, presence) pass through to the
 *   @mrfinch/booking component. The availability wrappers are SCHEDULE-AWARE
 *   on the server: the React Booker sends resourceId/date/eventLength/
 *   slotInterval (plus eventTypeId and, while rescheduling, the booker's
 *   rescheduleContext where BookingProvider's availabilityContext is on), so
 *   this module resolves the resource → the event type's or its
 *   organization's default schedule → `resourceTimezone` + `scheduleId`
 *   (month view) / `availableSlots` (day view). Without a schedule the
 *   component's legacy 09:00–17:00 UTC path is used unchanged. A booking's
 *   own slots count as free for a client only through rescheduleContext
 *   ({ uid, token }, checked by the component); the uid-only
 *   excludeBookingUid is passed solely after the reschedule's token check.
 *
 * - createBooking takes the booker inline (no identity involved) and enforces
 *   the host-side guard the component deliberately leaves to the caller:
 *   15-minute grid, past / min-notice / horizon windows, duration whitelist,
 *   "start is an offered slot" (the same list getDaySlots shows), plus a small
 *   per-email rate limit and a sandbox-wide hourly cap. Component errors are
 *   mapped by their code to this gateway's `ConvexError({ code, message })`,
 *   so clients get stable codes and host texts instead of the component's
 *   texts or Convex's redacted "Server Error".
 *
 * - cancel / reschedule are authenticated by the booking's management token.
 *   Reschedule runs the full createBooking guard (including both limits) on
 *   the new time, since it writes a fresh booking row.
 *
 * - The token-less booking reads (getBooking, getBookingByUid) return a
 *   redacted view: no management token, no booker contact data. The uid is
 *   shown to the booker as "Booking ID", so it is not a secret. Token holders
 *   read the full booking through getBookingByToken.
 *
 * Nothing here can wipe or reset the sandbox — that is internal.seed.* (cron).
 */
import { v, ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { isBookingError, type BookingErrorCode } from "@mrfinch/booking";
import { isSendableAddress } from "@mrfinch/booking/emails";
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
/**
 * Largest range the raw getAvailability check accepts. The component reads
 * one availability row per day of the range, so an unbounded anonymous range
 * is unbounded work; the same 62 days as the month view.
 */
const MAX_AVAILABILITY_RANGE_MS = MAX_MONTH_RANGE_MS;
/** Largest |timestamp| a JavaScript Date can represent (±100,000,000 days). */
const MAX_DATE_MS = 8.64e15;
/** Horizon when an event type sets no maxFutureMinutes (60 days). */
const DEFAULT_MAX_FUTURE_MINUTES = 60 * 24 * 60;
/** Anonymous createBooking: 5 bookings per email per 10 minutes. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/**
 * Sandbox-wide cap on booking writes (create + reschedule) per hour.
 *
 * Every booking leaves rows behind (bookings, booking_history, …) until the
 * hourly wipe in seed.ts — and that wipe is ONE Convex transaction, bounded by
 * the per-transaction write limit (16k documents). A create → cancel → create
 * loop on a single slot would otherwise grow the tables without limit and
 * eventually make every reset fail. 500/h keeps the worst case (two windows
 * between two wipes, ~4 rows per booking) far below the limit. The counter
 * row is deleted by the reset, so each sandbox hour starts fresh.
 */
const SANDBOX_BOOKINGS_PER_HOUR = 500;
const SANDBOX_WINDOW_MS = 60 * 60 * 1000;
const SANDBOX_COUNTER_KEY = "sandbox:bookings";
/** Presence: max slots a single heartbeat may hold (or leave may release). */
const MAX_PRESENCE_SLOTS = 32;
/** The component's own reschedule-artifact cancellation reason. */
const RESCHEDULE_SENTINEL = "Rescheduled to new time";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================
// TYPES — component documents come from the generated ComponentApi
// ============================================

type EventTypeDoc = NonNullable<
  FunctionReturnType<typeof components.booking.public.getEventType>
>;
type ResourceDoc = NonNullable<
  FunctionReturnType<typeof components.booking.resources.getResource>
>;
type ScheduleDoc = NonNullable<
  FunctionReturnType<typeof components.booking.schedules.getSchedule>
>;
type BookingDoc = FunctionReturnType<
  typeof components.booking.public.getBookingByToken
>;
type DaySlot = FunctionReturnType<
  typeof components.booking.public.getDaySlots
>[number];

type BookerInput = {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
};

/**
 * The booker's credential for the slot queries while moving a booking: its
 * uid and management token. Forwarded unchanged; the component frees that
 * booking's own slots only when the token matches a pending or confirmed
 * booking on the queried resource, and ignores it otherwise.
 */
type RescheduleContext = { uid: string; token: string };
const rescheduleContextValidator = v.object({
  uid: v.string(),
  token: v.string(),
});

// ============================================
// SMALL HELPERS
// ============================================

function invalid(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

const toIsoDateUtc = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

/** A real calendar date — round-trips, so "2027-02-30" (→ 2 March) is rejected. */
const isIsoDate = (s: string): boolean => {
  if (!ISO_DATE_RE.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00.000Z`);
  return !Number.isNaN(ms) && toIsoDateUtc(ms) === s;
};

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

/** Finite and inside the Date range, so the component can turn it into a day. */
const isDateMs = (ms: number): boolean =>
  Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS;

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

const slotTimeMs = (t: string | number): number =>
  typeof t === "number" ? t : Date.parse(t);

/** Durations the booker may pick: curated options, else the default only. */
const allowedDurations = (et: EventTypeDoc): number[] =>
  et.lengthInMinutesOptions?.length
    ? et.lengthInMinutesOptions
    : [et.lengthInMinutes];

/**
 * Start spacing the booking guard accepts:
 * `slotInterval ?? min(lengthInMinutesOptions) ?? lengthInMinutes`.
 *
 * The Booker (Calendar → useConvexSlots) derives its grid differently:
 * `slotInterval ?? min(lengthInMinutes, ...lengthInMinutesOptions)`. The two
 * agree when `slotInterval` is set (this app's admin form always sends it) or
 * `lengthInMinutes` is not below every option; otherwise the Booker offers
 * starts on a finer grid than this guard accepts.
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

const SLOT_TAKEN = "This time slot is no longer available — please pick another one.";

/**
 * Component error code → the code and text this gateway's clients see. The
 * component's `data.message` is English for logs and can hold IDs, so clients
 * never receive it. Codes missing here become BOOKING_FAILED: the admin-only
 * *_IN_USE / *_ALREADY_EXISTS (the wrapped calls never throw them), and
 * POOL_REQUIRES_BUNDLE / ORGANIZATION_MISMATCH, setup faults a visitor
 * cannot fix.
 */
const COMPONENT_ERRORS: Partial<
  Record<BookingErrorCode, [code: string, message: string]>
> = {
  SLOT_UNAVAILABLE: ["SLOT_NOT_AVAILABLE", SLOT_TAKEN],
  QUANTITY_UNAVAILABLE: ["SLOT_NOT_AVAILABLE", SLOT_TAKEN],
  EVENT_TYPE_NOT_FOUND: ["EVENT_TYPE_NOT_FOUND", "This event type no longer exists."],
  EVENT_TYPE_INACTIVE: ["EVENT_TYPE_INACTIVE", "This event type is no longer available for booking."],
  RESOURCE_NOT_FOUND: ["RESOURCE_NOT_FOUND", "This resource no longer exists."],
  RESOURCE_INACTIVE: ["RESOURCE_INACTIVE", "This resource is no longer available."],
  RESOURCE_NOT_STANDALONE: ["RESOURCE_NOT_STANDALONE", "This resource can only be booked as an add-on."],
  RESOURCE_NOT_LINKED: ["NOT_LINKED", "This resource is not available for this event type."],
  BOOKING_NOT_FOUND: ["NOT_FOUND", "Booking not found."],
  INVALID_TOKEN: ["INVALID_TOKEN", "Invalid booking link."],
  INVALID_STATE: ["INVALID_STATE", "This booking can no longer be changed."],
  INVALID_RANGE: ["INVALID_RANGE", "End time must be after start time."],
  INVALID_INPUT: ["INVALID_INPUT", "Please check your details and try again."],
};

/**
 * Rethrow a component failure as this gateway's ConvexError, chosen by the
 * component's error code (`isBookingError`). Every try block around it wraps
 * a component call only, so each ConvexError caught there is the
 * component's. Unknown codes, plain Errors and anything else → BOOKING_FAILED.
 */
function translateComponentError(error: unknown): never {
  if (isBookingError(error)) {
    const mapped = COMPONENT_ERRORS[error.data.code];
    if (mapped) invalid(mapped[0], mapped[1]);
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
 * The React Booker sends an eventTypeId to the availability queries only where
 * BookingProvider's availabilityContext is on. Without one the notice/horizon
 * windows fall back to the active event types linked to the resource (min
 * notice, max horizon — never hides a slot that createBooking would accept
 * for some event type).
 */
async function resolveAvailabilityContext(
  ctx: Ctx,
  resourceId: string,
  opts: { eventTypeId?: string; eventType?: EventTypeDoc } = {}
): Promise<AvailabilityContext | null> {
  const resource = await ctx.runQuery(components.booking.resources.getResource, {
    id: resourceId,
  });
  if (!resource || resource.isActive === false) return null;

  let eventType: EventTypeDoc | null = opts.eventType ?? null;
  if (!eventType && opts.eventTypeId) {
    eventType = await ctx.runQuery(components.booking.public.getEventType, {
      eventTypeId: opts.eventTypeId,
    });
    if (eventType && eventType.isActive === false) return null;
  }

  const windowTypes: EventTypeDoc[] = eventType
    ? [eventType]
    : (
        await ctx.runQuery(
          components.booking.resource_event_types.getEventTypesForResource,
          { resourceId }
        )
      ).filter((et) => et.isActive !== false);

  let schedule: ScheduleDoc | null = null;
  if (eventType?.scheduleId) {
    schedule = await ctx.runQuery(components.booking.schedules.getSchedule, {
      id: eventType.scheduleId,
    });
  }
  if (!schedule) {
    schedule = await ctx.runQuery(
      components.booking.schedules.getDefaultSchedule,
      { organizationId: resource.organizationId }
    );
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
 * together; the component rejects one without the other).
 *
 * The booking being moved counts as free through ONE of:
 * - `rescheduleContext`: the booker's { uid, token } from the client; the
 *   component checks the token.
 * - `excludeBookingUid`: frees a booking by uid alone, so only
 *   assertStartIsOfferedSlot passes it, for rescheduleBookingByToken after
 *   that mutation's own token check. Never fill it from client arguments.
 */
async function offeredDaySlots(
  ctx: Ctx,
  avail: AvailabilityContext,
  opts: {
    date: string;
    eventLength: number;
    slotInterval: number | undefined;
    rescheduleContext?: RescheduleContext;
    excludeBookingUid?: string;
  }
): Promise<DaySlot[]> {
  let availableSlots: number[] | undefined;
  if (avail.scheduleId && avail.timezone) {
    const effective = await ctx.runQuery(
      components.booking.schedules.getEffectiveAvailability,
      { scheduleId: avail.scheduleId, date: opts.date }
    );
    availableSlots = effective.availableSlots;
    // Empty window (weekend, "unavailable" override): no slots, skip the call.
    if (availableSlots.length === 0) return [];
  }

  return await ctx.runQuery(components.booking.public.getDaySlots, {
    resourceId: avail.resource.id,
    date: opts.date,
    eventLength: opts.eventLength,
    slotInterval: opts.slotInterval,
    resourceTimezone: availableSlots ? avail.timezone : undefined,
    availableSlots,
    rescheduleContext: opts.rescheduleContext,
    excludeBookingUid: opts.excludeBookingUid,
  });
}

/**
 * `offeredDaySlots` narrowed to what createBooking's window guard accepts
 * right now: nothing inside the minimum notice, nothing past the horizon.
 * Filtered PER SLOT, not per day — `now + maxFutureMinutes` lands at the
 * current wall-clock time of its day, so that day is only partly bookable.
 * Serves the client-facing queries, so it takes the client's
 * rescheduleContext and never an excludeBookingUid.
 */
async function windowedDaySlots(
  ctx: Ctx,
  avail: AvailabilityContext,
  opts: {
    date: string;
    eventLength: number;
    slotInterval: number | undefined;
    rescheduleContext: RescheduleContext | undefined;
    now: number;
  }
): Promise<DaySlot[]> {
  const notBefore = opts.now + avail.minNoticeMinutes * 60_000;
  const notAfter = opts.now + avail.maxFutureMinutes * 60_000;
  const slots = await offeredDaySlots(ctx, avail, {
    date: opts.date,
    eventLength: opts.eventLength,
    slotInterval: opts.slotInterval,
    rescheduleContext: opts.rescheduleContext,
  });
  return slots.filter((s) => {
    const t = slotTimeMs(s.time);
    return t >= notBefore && t <= notAfter;
  });
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

/**
 * The booker's details, trimmed and bounded. The email must pass
 * `isSendableAddress` from @mrfinch/booking/emails, the screen the component's
 * createBooking applies since 0.5.0 (INVALID_INPUT otherwise), so a bad
 * address gets INVALID_EMAIL here instead.
 *
 * Syntax is not ownership: this does not stop a visitor from entering someone
 * else's address. That is why the sandbox sends no email (see the recipient
 * policy in app/docs/integrations/email).
 */
function sanitizeBooker(input: BookerInput): BookerInput {
  const name = input.name.trim();
  if (!name) invalid("NAME_REQUIRED", "Please enter your name.");
  if (name.length > 120) {
    invalid("NAME_TOO_LONG", "Name is too long (max 120 characters).");
  }
  const email = input.email.trim();
  if (!isSendableAddress(email)) {
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
    eventType = await ctx.runQuery(components.booking.public.getEventType, {
      eventTypeId,
    });
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
  const resource = await ctx.runQuery(components.booking.resources.getResource, {
    id: resourceId,
  });
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
  const linked = await ctx.runQuery(
    components.booking.resource_event_types.hasResourceEventTypeLink,
    { resourceId, eventTypeId }
  );
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
 *
 * `excludeBookingUid` treats that booking's own slots as free. Trusted server
 * input only: rescheduleBookingByToken passes the uid of the booking it has
 * just loaded by uid AND token.
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

/**
 * Fixed-window counter in `bookingRateLimits`. Throws `code` once `max` hits
 * are inside the window; the increment rolls back with the transaction.
 */
async function bumpFixedWindow(
  ctx: MutationCtx,
  key: string,
  opts: { windowMs: number; max: number; code: string; message: string }
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("bookingRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!row || row.windowStart + opts.windowMs <= now) {
    if (row) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("bookingRateLimits", { key, windowStart: now, count: 1 });
    }
    return;
  }
  if (row.count >= opts.max) {
    invalid(opts.code, opts.message);
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

/**
 * Per-email window first, then the sandbox-wide cap. Called after the guard
 * and before the component write by createBooking AND reschedule (both add a
 * booking row).
 */
async function enforceBookingRateLimit(
  ctx: MutationCtx,
  email: string
): Promise<void> {
  await bumpFixedWindow(ctx, `email:${email.toLowerCase()}`, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    code: "RATE_LIMITED",
    message:
      "Too many bookings from this email address — please try again in a few minutes.",
  });
  await bumpFixedWindow(ctx, SANDBOX_COUNTER_KEY, {
    windowMs: SANDBOX_WINDOW_MS,
    max: SANDBOX_BOOKINGS_PER_HOUR,
    code: "SANDBOX_BUSY",
    message:
      "The sandbox has reached its hourly booking limit — everything resets every hour, please try again later.",
  });
}

async function loadBookingByToken(
  ctx: Ctx,
  uid: string,
  token: string
): Promise<BookingDoc> {
  try {
    return await ctx.runQuery(components.booking.public.getBookingByToken, {
      uid,
      token,
    });
  } catch (error) {
    translateComponentError(error);
  }
}

/** The two codes that mean "this link does not resolve to a booking". */
const UNRESOLVABLE_LINK_CODES = new Set(["NOT_FOUND", "INVALID_TOKEN"]);

function isUnresolvableLink(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string" &&
    UNRESOLVABLE_LINK_CODES.has(data.code)
  );
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
 * Get a single event type by ID, or null if it does not exist. The Booker
 * shows null as a deleted event type; a throw would reach the error boundary.
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
 * false; days beyond the booking horizon are false; today and the horizon day
 * are checked against the windowed slot list (they are only partly bookable);
 * malformed input yields {}.
 *
 * `eventTypeId` and `rescheduleContext` are optional; the Booker sends them
 * where BookingProvider's availabilityContext is on. rescheduleContext goes to
 * the component unchanged, which frees the moved booking's own slots only
 * when its token matches. There is deliberately no `excludeBookingUid`
 * argument: it would free any booking whose uid (the visible "Booking ID")
 * a client knows.
 */
export const getMonthAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    dateFrom: v.string(),
    dateTo: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
    eventTypeId: v.optional(v.string()),
    rescheduleContext: v.optional(rescheduleContextValidator),
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

    const slotInterval =
      args.slotInterval ??
      (avail.eventType ? effectiveSlotInterval(avail.eventType) : undefined);

    // Day keys in the schedule's zone (UTC on the legacy path) — the same
    // calendar the component's month view is computed in.
    const now = Date.now();
    const todayKey = dayKeyFor(now, avail.timezone);
    const horizonKey = dayKeyFor(
      now + avail.maxFutureMinutes * 60_000,
      avail.timezone
    );
    const effectiveTo = args.dateTo < horizonKey ? args.dateTo : horizonKey;

    const result: Record<string, boolean> = {};
    if (args.dateFrom <= effectiveTo) {
      const fromComponent = await ctx.runQuery(
        components.booking.public.getMonthAvailability,
        {
          resourceId: args.resourceId,
          dateFrom: args.dateFrom,
          dateTo: effectiveTo,
          eventLength: args.eventLength,
          slotInterval,
          // resourceTimezone only with scheduleId: the component rejects it alone.
          resourceTimezone: avail.scheduleId ? avail.timezone : undefined,
          scheduleId: avail.scheduleId,
          rescheduleContext: args.rescheduleContext,
        }
      );
      Object.assign(result, fromComponent);
    }

    // Past days and days beyond the horizon read as unavailable.
    for (let ms = fromMs; ms <= toMs; ms += 24 * 60 * 60 * 1000) {
      const key = toIsoDateUtc(ms);
      if (key < todayKey || key > horizonKey || !(key in result)) {
        result[key] = false;
      }
    }

    // The two edge days are only partly bookable (minimum notice on today,
    // the horizon on its own day). The component marks a day true when ANY
    // slot is free, so ask for the windowed list — otherwise the calendar
    // would offer a day whose every slot createBooking rejects.
    for (const edge of new Set([todayKey, horizonKey])) {
      if (result[edge]) {
        const slots = await windowedDaySlots(ctx, avail, {
          date: edge,
          eventLength: args.eventLength,
          slotInterval,
          rescheduleContext: args.rescheduleContext,
          now,
        });
        result[edge] = slots.length > 0;
      }
    }
    return result;
  },
});

/**
 * Detailed slots for a single (resource-local) day: [{ time }].
 *
 * Schedule-aware: passes resourceTimezone + availableSlots (from the resolved
 * schedule) to the component. Past days and days beyond the horizon return [];
 * within a day every slot inside the minimum-notice window or past the horizon
 * is dropped — so the list matches what createBooking accepts, slot by slot.
 * `eventTypeId` and `rescheduleContext` as in getMonthAvailability.
 */
export const getDaySlots = publicQuery({
  args: {
    resourceId: v.string(),
    date: v.string(),
    eventLength: v.number(),
    slotInterval: v.optional(v.number()),
    eventTypeId: v.optional(v.string()),
    rescheduleContext: v.optional(rescheduleContextValidator),
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
    const horizonKey = dayKeyFor(
      now + avail.maxFutureMinutes * 60_000,
      avail.timezone
    );
    if (args.date < todayKey || args.date > horizonKey) return [];

    return await windowedDaySlots(ctx, avail, {
      date: args.date,
      eventLength: args.eventLength,
      slotInterval:
        args.slotInterval ??
        (avail.eventType ? effectiveSlotInterval(avail.eventType) : undefined),
      rescheduleContext: args.rescheduleContext,
      now,
    });
  },
});

/**
 * Raw slot-collision check for a time range (ignores opening hours).
 * Kept for the docs demo; do not use it for UI availability.
 * The range is capped at MAX_AVAILABILITY_RANGE_MS (RANGE_TOO_LARGE).
 */
export const getAvailability = publicQuery({
  args: {
    resourceId: v.string(),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isDateMs(args.start) || !isDateMs(args.end)) {
      invalid("INVALID_TIME", "Invalid time value.");
    }
    if (args.end <= args.start) {
      invalid("INVALID_RANGE", "End time must be after start time.");
    }
    if (args.end - args.start > MAX_AVAILABILITY_RANGE_MS) {
      invalid(
        "RANGE_TOO_LARGE",
        `Availability can be checked for at most ${formatMinutes(MAX_AVAILABILITY_RANGE_MS / 60_000)} at a time.`
      );
    }
    try {
      return await ctx.runQuery(components.booking.public.getAvailability, args);
    } catch (error) {
      translateComponentError(error);
    }
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
    if (args.slots.length > MAX_PRESENCE_SLOTS) {
      invalid("TOO_MANY_SLOTS", "Too many slots in one hold.");
    }
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

    let booking: BookingDoc | undefined;
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
 * What a caller without the management token may see of a booking: an
 * allowlist, so fields the component adds later stay private by default.
 * Left out: managementToken (the bearer credential for cancel/reschedule),
 * the booker's name, email, phone and notes, actorId (the booker's email), the
 * free-text cancellation reason and the location value (it comes from the
 * booking request and can hold an address or phone number); only its type stays.
 */
function toPublicBookingView(booking: BookingDoc) {
  return {
    _id: booking._id,
    _creationTime: booking._creationTime,
    uid: booking.uid,
    status: booking.status,
    eventTypeId: booking.eventTypeId,
    eventTitle: booking.eventTitle,
    eventDescription: booking.eventDescription,
    resourceId: booking.resourceId,
    organizationId: booking.organizationId,
    start: booking.start,
    end: booking.end,
    timezone: booking.timezone,
    location: { type: booking.location.type },
    rescheduleUid: booking.rescheduleUid,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    cancelledAt: booking.cancelledAt,
  };
}

/**
 * Get booking by ID — redacted (see toPublicBookingView); anyone may call it.
 */
export const getBooking = publicQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(components.booking.public.getBooking, {
      bookingId: args.bookingId,
    });
    return booking && toPublicBookingView(booking);
  },
});

/**
 * Get booking by UID (confirmation code) — redacted (see toPublicBookingView).
 * The uid is displayed as "Booking ID", so it must not unlock the token.
 */
export const getBookingByUid = publicQuery({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(
      components.booking.public.getBookingByUid,
      args
    );
    return booking && toPublicBookingView(booking);
  },
});

/**
 * Get booking by token (for public management)
 * Requires both UID and management token for access.
 *
 * Resolves to `null` for a stale or tampered link (unknown uid, wrong or
 * malformed token) so the management pages render their "Booking Not Found"
 * state instead of throwing out of `useQuery`; every other failure still
 * throws. The token mutations keep throwing NOT_FOUND / INVALID_TOKEN.
 */
export const getBookingByToken = publicQuery({
  args: { uid: v.string(), token: v.string() },
  handler: async (ctx, args): Promise<BookingDoc | null> => {
    try {
      const { uid, token } = sanitizeTokenArgs(args.uid, args.token);
      return await loadBookingByToken(ctx, uid, token);
    } catch (error) {
      if (isUnresolvableLink(error)) return null;
      throw error;
    }
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

    // A reschedule writes a new booking row (the old one stays, cancelled,
    // with rescheduledToUid naming the new one), so it counts like a create.
    await enforceBookingRateLimit(ctx, booking.bookerEmail);

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
