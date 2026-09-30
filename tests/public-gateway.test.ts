import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import * as publicApi from "../convex/public";
import {
  componentError,
  declaredArgs,
  errorCode,
  errorData,
  fakeCtx,
  run,
} from "./convex-fake-ctx";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A full component booking document, as the component returns it. */
const booking = {
  _id: "k17bookingdoc",
  _creationTime: 1_900_000_000_000,
  uid: "bk_lq8x2_9f3kz1",
  managementToken: "tok_7c1e9b0d5a4f",
  status: "confirmed",
  eventTypeId: "studio-session",
  eventTitle: "Studio session",
  resourceId: "studio-a",
  organizationId: "demo-org",
  start: Date.UTC(2030, 0, 7, 10),
  end: Date.UTC(2030, 0, 7, 11),
  timezone: "Europe/Berlin",
  location: { type: "address", value: "Flat 3, Hauptstrasse 5" },
  bookerName: "Grace Guest",
  bookerEmail: "grace.guest@example.com",
  bookerPhone: "+49 30 5550123",
  bookerNotes: "door code 4711",
  actorId: "grace.guest@example.com",
  cancellationReason: "call me on 0176 5550199",
  createdAt: 1_900_000_000_000,
  updatedAt: 1_900_000_000_000,
};

/** Everything a token-less reader must not learn. */
const PRIVATE_VALUES = [
  booking.managementToken,
  booking.bookerName,
  booking.bookerEmail,
  booking.bookerPhone,
  booking.bookerNotes,
  booking.cancellationReason,
  booking.location.value,
];

/** The component's token check, with its 0.5.0 error codes. */
const getBookingByTokenStub = ({ uid, token }: Record<string, unknown>) => {
  if (uid !== booking.uid) throw componentError("BOOKING_NOT_FOUND", "Booking not found");
  if (token !== booking.managementToken) throw componentError("INVALID_TOKEN", "Invalid token");
  return booking;
};

/** Component stubs that behave like the real token check. */
const bookingComponent = () =>
  fakeCtx({
    "public/getBooking": () => booking,
    "public/getBookingByUid": ({ uid }) => (uid === booking.uid ? booking : null),
    "public/getBookingByToken": getBookingByTokenStub,
    "public/cancelBookingByToken": () => ({ success: true }),
  });

describe("token-less booking reads (H-01)", () => {
  const reads = [
    ["getBooking", publicApi.getBooking, { bookingId: booking._id }],
    ["getBookingByUid", publicApi.getBookingByUid, { uid: booking.uid }],
  ] as const;

  for (const [name, fn, args] of reads) {
    it(`${name} returns no management token or contact data`, async () => {
      const { ctx } = bookingComponent();
      const view = await run(fn, ctx, args);

      const json = JSON.stringify(view);
      for (const value of PRIVATE_VALUES) expect(json).not.toContain(value);
      for (const key of ["managementToken", "bookerEmail", "bookerPhone", "bookerNotes", "bookerName", "actorId"]) {
        expect(view).not.toHaveProperty(key);
      }
      // The public facts stay available.
      expect(view).toMatchObject({
        _id: booking._id,
        uid: booking.uid,
        status: "confirmed",
        start: booking.start,
        end: booking.end,
        timezone: "Europe/Berlin",
        eventTitle: "Studio session",
        eventTypeId: "studio-session",
        resourceId: "studio-a",
        location: { type: "address" },
      });
      expect(view).not.toHaveProperty("location.value");
    });
  }

  it("getBookingByUid still returns null for an unknown uid", async () => {
    const { ctx } = bookingComponent();
    expect(await run(publicApi.getBookingByUid, ctx, { uid: "bk_unknown" })).toBeNull();
  });

  it("the uid → token → cancel chain fails", async () => {
    const { ctx, calls } = bookingComponent();
    const view = await run(publicApi.getBookingByUid, ctx, { uid: booking.uid });

    // Try every string the anonymous read returns as the management token.
    const candidates = JSON.stringify(view).match(/"[^"]*"/g)!.map((s) => JSON.parse(s) as string);
    expect(candidates.length).toBeGreaterThan(5);
    for (const token of candidates) {
      const code = await errorCode(
        run(publicApi.cancelBookingByToken, ctx, { uid: booking.uid, token })
      );
      expect(["INVALID_TOKEN", "NOT_FOUND"]).toContain(code);
    }
    expect(calls).not.toContain("public/cancelBookingByToken");
  });

  it("control: the token holder still reads and cancels the booking", async () => {
    const { ctx, calls } = bookingComponent();
    const args = { uid: booking.uid, token: booking.managementToken };
    expect(await run(publicApi.getBookingByToken, ctx, args)).toMatchObject({
      managementToken: booking.managementToken,
      bookerEmail: booking.bookerEmail,
    });
    expect(await run(publicApi.cancelBookingByToken, ctx, args)).toEqual({ success: true });
    expect(calls).toContain("public/cancelBookingByToken");
  });
});

describe("createBooking email syntax (H-02)", () => {
  // The email check runs before any component read; a valid address gets as
  // far as the event-type lookup, which this stub answers with "not found".
  const attempt = (email: string) => {
    const { ctx } = fakeCtx({ "public/getEventType": () => null });
    return errorCode(
      run(publicApi.createBooking, ctx, {
        eventTypeId: "studio-session",
        resourceId: "studio-a",
        start: Date.UTC(2030, 0, 7, 10),
        end: Date.UTC(2030, 0, 7, 11),
        timezone: "Europe/Berlin",
        booker: { name: "Ada", email },
        location: { type: "address" },
      })
    );
  };
  const PASSED_EMAIL_CHECK = "EVENT_TYPE_NOT_FOUND";
  const longDomain = ["a", "b", "c", "d"].map((c) => c.repeat(60)).join("."); // 243 chars

  it.each([
    "guest@example.com",
    "first.last+tag@mail.example.co.uk",
    "o'brien@example.ie",
    "user@bücher.de",
    "用户@例子.广告",
    "  padded@example.com  ",
    `${"x".repeat(10)}@${longDomain}`, // 254 characters
  ])("accepts %j", async (email) => {
    expect(await attempt(email)).toBe(PASSED_EMAIL_CHECK);
  });

  it.each([
    "",
    "x@",
    "@x.y",
    "a b@c.d",
    "a@b",
    "a@@b.c",
    "a@b@c.d",
    "a@b.",
    "a@.b",
    "a@b..c",
    "a\tb@c.d",
    "a\u0007@b.c",
    "a@b.c\u0085d",
    "no-at-sign.example.com",
    `${"x".repeat(11)}@${longDomain}`, // 255 characters
    // Domain labels (the rule 0.5.0's createBooking applies, isSendableAddress):
    `guest@${"x".repeat(64)}.de`, // label longer than 63 characters
    "guest@-example.com",
    "guest@example-.com",
    "guest@exa_mple.com",
  ])("rejects %j", async (email) => {
    expect(await attempt(email)).toBe("INVALID_EMAIL");
  });

  it("control: a 63-character label passes", async () => {
    expect(await attempt(`guest@${"x".repeat(63)}.de`)).toBe(PASSED_EMAIL_CHECK);
  });
});

describe("anonymous work bounds (H-03)", () => {
  const availabilityComponent = () =>
    fakeCtx({ "public/getAvailability": () => true });
  const start = Date.UTC(2030, 0, 1);

  it("getAvailability accepts ranges up to 62 days", async () => {
    const { ctx, calls } = availabilityComponent();
    for (const end of [start + HOUR, start + 62 * DAY]) {
      expect(await run(publicApi.getAvailability, ctx, { resourceId: "studio-a", start, end })).toBe(true);
    }
    expect(calls).toEqual(["public/getAvailability", "public/getAvailability"]);
  });

  it("getAvailability rejects longer ranges before any component read", async () => {
    const { ctx, calls } = availabilityComponent();
    for (const end of [start + 62 * DAY + 1, start + 366 * DAY, start + 30 * 365 * DAY]) {
      expect(
        await errorCode(run(publicApi.getAvailability, ctx, { resourceId: "studio-a", start, end }))
      ).toBe("RANGE_TOO_LARGE");
    }
    expect(calls).toEqual([]);
  });

  it("getAvailability rejects inverted and non-finite ranges with stable codes", async () => {
    const { ctx, calls } = availabilityComponent();
    const check = (s: number, e: number) =>
      errorCode(run(publicApi.getAvailability, ctx, { resourceId: "studio-a", start: s, end: e }));
    expect(await check(start, start)).toBe("INVALID_RANGE");
    expect(await check(start, start - HOUR)).toBe("INVALID_RANGE");
    expect(await check(start, Infinity)).toBe("INVALID_TIME");
    expect(await check(NaN, start)).toBe("INVALID_TIME");
    expect(calls).toEqual([]);
  });

  it("getAvailability rejects finite timestamps outside the Date range", async () => {
    // Beyond ±8.64e15 ms `new Date(ms)` is invalid, so the component would
    // throw a RangeError that surfaces as BOOKING_FAILED.
    const MAX = 8.64e15;
    const { ctx, calls } = availabilityComponent();
    const check = (s: number, e: number) =>
      errorCode(run(publicApi.getAvailability, ctx, { resourceId: "studio-a", start: s, end: e }));
    expect(await check(9e15, 9e15 + HOUR)).toBe("INVALID_TIME");
    expect(await check(MAX - HOUR, MAX + HOUR)).toBe("INVALID_TIME");
    expect(await check(-9e15, -9e15 + HOUR)).toBe("INVALID_TIME");
    expect(calls).toEqual([]);

    // Controls: ranges touching either end of the Date range reach the component.
    const ok = (s: number, e: number) =>
      run(publicApi.getAvailability, ctx, { resourceId: "studio-a", start: s, end: e });
    expect(await ok(MAX - HOUR, MAX)).toBe(true);
    expect(await ok(-MAX, -MAX + HOUR)).toBe(true);
    expect(calls).toEqual(["public/getAvailability", "public/getAvailability"]);
  });

  const slots = (n: number) =>
    Array.from({ length: n }, (_, i) => new Date(start + i * 15 * 60 * 1000).toISOString());
  const presenceComponent = () =>
    fakeCtx({ "presence/heartbeat": () => null, "presence/leave": () => null });

  for (const [name, fn] of [
    ["leave", publicApi.leave],
    ["heartbeat", publicApi.heartbeat],
  ] as const) {
    it(`${name} accepts 32 slots and rejects 33`, async () => {
      const { ctx, calls } = presenceComponent();
      const args = (n: number) => ({ resourceId: "studio-a", slots: slots(n), user: "session-1" });
      expect(await run(fn, ctx, args(32))).toBeNull();
      expect(await errorCode(run(fn, ctx, args(33)))).toBe("TOO_MANY_SLOTS");
      expect(calls).toEqual([`presence/${name}`]);
    });
  }

  it("availability queries reject impossible dates such as 2027-02-30", async () => {
    // getResource → null ends both queries right after the date check, so the
    // recorded calls show whether a date passed it.
    const { ctx, calls } = fakeCtx({ "resources/getResource": () => null });
    const day = (date: string) =>
      run(publicApi.getDaySlots, ctx, { resourceId: "studio-a", date, eventLength: 60 });
    const month = (dateFrom: string, dateTo: string) =>
      run(publicApi.getMonthAvailability, ctx, { resourceId: "studio-a", dateFrom, dateTo, eventLength: 60 });

    for (const bad of ["2027-02-30", "2027-02-29", "2026-04-31", "2026-13-01", "2026-00-10"]) {
      expect(await day(bad)).toEqual([]);
      expect(await month(bad, bad)).toEqual({});
      expect(await month("2027-02-01", bad)).toEqual({});
    }
    expect(calls).toEqual([]);

    // Controls: real dates, including a leap day, reach the resource lookup.
    for (const good of ["2027-02-28", "2028-02-29", "2026-12-31"]) {
      await day(good);
      await month(good, good);
    }
    expect(calls).toHaveLength(6);
  });
});

// ============================================
// @mrfinch/booking 0.5.0 contract
// ============================================

/** A start on the 15-minute grid, two days ahead: inside the default horizon. */
const START = Math.ceil((Date.now() + 2 * DAY) / HOUR) * HOUR;
const START_ISO = new Date(START).toISOString();
const START_DAY = START_ISO.slice(0, 10);

const eventType = {
  _id: "k57eventtypedoc",
  _creationTime: 1_900_000_000_000,
  id: "studio-session",
  slug: "studio-session",
  title: "Studio session",
  lengthInMinutes: 60,
  slotInterval: 60,
  timezone: "Europe/Berlin",
  lockTimeZoneToggle: false,
  locations: [{ type: "address" }],
  isActive: true,
};
const resource = { id: "studio-a", organizationId: "demo-org", isActive: true };

/**
 * What the booking guard reads: an active, linked event type and resource, no
 * schedule (legacy hours), and START offered by the component's getDaySlots.
 */
const guardStubs = () => ({
  "public/getEventType": () => eventType,
  "resources/getResource": () => resource,
  "resource_event_types/hasResourceEventTypeLink": () => true,
  "schedules/getDefaultSchedule": () => null,
  "public/getDaySlots": () => [{ time: START_ISO }],
});

const SLOT_QUERIES = ["public/getDaySlots", "public/getMonthAvailability"];

describe("component error codes (0.5.0)", () => {
  // cancelBookingByToken is the shortest wrapped path: token read, status
  // check, then the component write whose rejection is translated.
  const cancelRejectedWith = (error: unknown) => {
    const { ctx } = fakeCtx({
      "public/getBookingByToken": getBookingByTokenStub,
      "public/cancelBookingByToken": () => {
        throw error;
      },
    });
    const args = { uid: booking.uid, token: booking.managementToken };
    return errorData(run(publicApi.cancelBookingByToken, ctx, args));
  };
  // The component's texts are for logs and can name IDs.
  const componentText = `Resource "studio-a" is not available (booking ${booking.uid})`;

  it.each([
    ["SLOT_UNAVAILABLE", "SLOT_NOT_AVAILABLE"],
    ["QUANTITY_UNAVAILABLE", "SLOT_NOT_AVAILABLE"],
    ["RESOURCE_NOT_LINKED", "NOT_LINKED"],
    ["BOOKING_NOT_FOUND", "NOT_FOUND"],
    ["INVALID_TOKEN", "INVALID_TOKEN"],
    ["INVALID_STATE", "INVALID_STATE"],
    ["INVALID_RANGE", "INVALID_RANGE"],
    ["INVALID_INPUT", "INVALID_INPUT"],
    ["EVENT_TYPE_NOT_FOUND", "EVENT_TYPE_NOT_FOUND"],
    ["EVENT_TYPE_INACTIVE", "EVENT_TYPE_INACTIVE"],
    ["RESOURCE_NOT_FOUND", "RESOURCE_NOT_FOUND"],
    ["RESOURCE_INACTIVE", "RESOURCE_INACTIVE"],
    ["RESOURCE_NOT_STANDALONE", "RESOURCE_NOT_STANDALONE"],
    ["POOL_REQUIRES_BUNDLE", "BOOKING_FAILED"],
    ["ORGANIZATION_MISMATCH", "BOOKING_FAILED"],
  ] as const)("%s becomes %s with the gateway's text", async (componentCode, code) => {
    const data = await cancelRejectedWith(componentError(componentCode, componentText));
    expect(data.code).toBe(code);
    expect(data.message).toEqual(expect.any(String));
    expect(data.message).not.toContain("studio-a");
  });

  it("uses the gateway's texts, not the component's", async () => {
    expect(await cancelRejectedWith(componentError("SLOT_UNAVAILABLE", componentText))).toEqual({
      code: "SLOT_NOT_AVAILABLE",
      message: "This time slot is no longer available — please pick another one.",
    });
    expect(await cancelRejectedWith(componentError("INVALID_INPUT", componentText))).toEqual({
      code: "INVALID_INPUT",
      message: "Please check your details and try again.",
    });
  });

  it("control: plain Errors and unknown codes become BOOKING_FAILED", async () => {
    for (const error of [
      new Error("Time slot no longer available"), // a 0.4.x text is no longer matched
      new ConvexError({ code: "SOMETHING_NEW", message: componentText }),
      new ConvexError({ code: "SLOT_UNAVAILABLE" }), // no message: not the component's shape
      "not an error",
    ]) {
      expect(await cancelRejectedWith(error)).toEqual({
        code: "BOOKING_FAILED",
        message: "Booking failed — please try again.",
      });
    }
  });

  it("createBooking maps a slot taken after the guard to SLOT_NOT_AVAILABLE", async () => {
    const { ctx, calls } = fakeCtx({
      ...guardStubs(),
      "public/createBooking": () => {
        throw componentError("SLOT_UNAVAILABLE", 'Resource "studio-a" is not available for the selected time');
      },
    });
    const code = await errorCode(
      run(publicApi.createBooking, ctx, {
        eventTypeId: eventType.id,
        resourceId: resource.id,
        start: START,
        end: START + HOUR,
        timezone: "Europe/Berlin",
        booker: { name: "Ada", email: "ada@example.com" },
        location: { type: "address" },
      })
    );
    expect(code).toBe("SLOT_NOT_AVAILABLE");
    // The guard passed; the component rejected the write.
    expect(calls).toContain("public/createBooking");
  });
});

describe("stale booking links (BOOKING_NOT_FOUND)", () => {
  it("getBookingByToken resolves an unknown uid or a wrong token to null", async () => {
    const { ctx, calls } = bookingComponent();
    const read = (uid: string, token: string) => run(publicApi.getBookingByToken, ctx, { uid, token });
    expect(await read("bk_deleted", booking.managementToken)).toBeNull();
    expect(await read(booking.uid, "tok_wrong")).toBeNull();
    expect(calls).toEqual(["public/getBookingByToken", "public/getBookingByToken"]);
  });

  it("the token mutations report NOT_FOUND for an unknown uid", async () => {
    const { ctx } = bookingComponent();
    const args = { uid: "bk_deleted", token: booking.managementToken };
    expect(await errorCode(run(publicApi.cancelBookingByToken, ctx, args))).toBe("NOT_FOUND");
    expect(
      await errorCode(
        run(publicApi.rescheduleBookingByToken, ctx, { ...args, newStart: START, newEnd: START + HOUR })
      )
    ).toBe("NOT_FOUND");
  });

  it("control: other failures of the read still throw", async () => {
    const { ctx } = fakeCtx({
      "public/getBookingByToken": () => {
        throw new Error("Transient failure");
      },
    });
    const args = { uid: booking.uid, token: booking.managementToken };
    expect(await errorCode(run(publicApi.getBookingByToken, ctx, args))).toBe("BOOKING_FAILED");
  });
});

describe("reschedule availability: rescheduleContext, never a client excludeBookingUid (F13)", () => {
  const context = { uid: booking.uid, token: booking.managementToken };

  /** Every UTC day from `from` to `to`, both included, marked available. */
  const openDays = (from: unknown, to: unknown) => {
    const days: Record<string, boolean> = {};
    for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += DAY) {
      days[new Date(ms).toISOString().slice(0, 10)] = true;
    }
    return days;
  };
  const slotComponent = () =>
    fakeCtx({
      ...guardStubs(),
      // Without an eventTypeId the notice/horizon come from the linked types.
      "resource_event_types/getEventTypesForResource": () => [eventType],
      "public/getMonthAvailability": ({ dateFrom, dateTo }) => openDays(dateFrom, dateTo),
    });

  it("getDaySlots and getMonthAvailability forward the booker's rescheduleContext", async () => {
    const { ctx, requests } = slotComponent();
    const base = { resourceId: resource.id, eventLength: 60, slotInterval: 60, eventTypeId: eventType.id };
    const today = new Date().toISOString().slice(0, 10);

    expect(await run(publicApi.getDaySlots, ctx, { ...base, date: START_DAY, rescheduleContext: context })).toEqual([
      { time: START_ISO },
    ]);
    expect(
      await run(publicApi.getMonthAvailability, ctx, {
        ...base,
        dateFrom: today,
        dateTo: START_DAY,
        rescheduleContext: context,
      })
    ).toMatchObject({ [START_DAY]: true });

    const slotQueries = requests.filter((r) => SLOT_QUERIES.includes(r.path));
    // The day query, the month query, and the day query for today's edge.
    expect(slotQueries.map((r) => r.path)).toEqual([
      "public/getDaySlots",
      "public/getMonthAvailability",
      "public/getDaySlots",
    ]);
    for (const { args } of slotQueries) {
      expect(args.rescheduleContext).toEqual(context);
      expect(args.excludeBookingUid).toBeUndefined();
    }
  });

  it("the queries declare rescheduleContext { uid, token } and no excludeBookingUid", () => {
    // Convex checks client arguments against these validators, and an object
    // validator rejects keys it does not declare.
    for (const fn of [publicApi.getDaySlots, publicApi.getMonthAvailability]) {
      const args = declaredArgs(fn);
      expect(args).not.toHaveProperty("excludeBookingUid");
      expect(args.rescheduleContext).toEqual({
        optional: true,
        fieldType: {
          type: "object",
          value: {
            uid: { fieldType: { type: "string" }, optional: false },
            token: { fieldType: { type: "string" }, optional: false },
          },
        },
      });
    }
  });

  it("a client excludeBookingUid never reaches the component", async () => {
    // run() skips argument validation, so this is the case where the key got
    // past it: the handlers still never read it.
    const { ctx, requests } = slotComponent();
    const excludeBookingUid = booking.uid;
    await run(publicApi.getDaySlots, ctx, { resourceId: resource.id, date: START_DAY, eventLength: 60, excludeBookingUid });
    await run(publicApi.getMonthAvailability, ctx, {
      resourceId: resource.id,
      dateFrom: START_DAY,
      dateTo: START_DAY,
      eventLength: 60,
      excludeBookingUid,
    });

    const slotQueries = requests.filter((r) => SLOT_QUERIES.includes(r.path));
    expect(slotQueries).toHaveLength(2);
    for (const { args } of slotQueries) {
      expect(args.excludeBookingUid).toBeUndefined();
      expect(args.rescheduleContext).toBeUndefined();
    }
  });

  const rescheduleComponent = () =>
    fakeCtx({
      ...guardStubs(),
      "public/getBookingByToken": getBookingByTokenStub,
      "public/rescheduleBookingByToken": () => ({ ...booking, uid: "bk_moved", start: START, end: START + HOUR }),
    });
  const move = (token: string) => ({ uid: booking.uid, token, newStart: START, newEnd: START + HOUR });

  it("rescheduleBookingByToken frees the booking's own slots after its token check", async () => {
    const { ctx, calls, requests } = rescheduleComponent();
    expect(await run(publicApi.rescheduleBookingByToken, ctx, move(booking.managementToken))).toMatchObject({
      uid: "bk_moved",
    });
    // The token is checked before the guard's slot query, which then frees
    // the booking by uid (server-side, never from client arguments).
    expect(calls.indexOf("public/getBookingByToken")).toBeLessThan(calls.indexOf("public/getDaySlots"));
    const guardQuery = requests.find((r) => r.path === "public/getDaySlots");
    expect(guardQuery?.args.excludeBookingUid).toBe(booking.uid);
    expect(guardQuery?.args.rescheduleContext).toBeUndefined();
  });

  it("control: with a wrong token no slot query runs, so nothing is freed", async () => {
    const { ctx, calls } = rescheduleComponent();
    expect(await errorCode(run(publicApi.rescheduleBookingByToken, ctx, move("tok_guess")))).toBe("INVALID_TOKEN");
    expect(calls).toEqual(["public/getBookingByToken"]);
  });
});
