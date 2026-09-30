import { describe, expect, it } from "vitest";
import * as publicApi from "../convex/public";
import { errorCode, fakeCtx, run } from "./convex-fake-ctx";

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
  location: { type: "address", value: "Studio A" },
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
];

/** Component stubs that behave like the real token check. */
const bookingComponent = () =>
  fakeCtx({
    "public/getBooking": () => booking,
    "public/getBookingByUid": ({ uid }) => (uid === booking.uid ? booking : null),
    "public/getBookingByToken": ({ uid, token }) => {
      if (uid !== booking.uid) throw new Error("Booking not found");
      if (token !== booking.managementToken) throw new Error("Invalid token");
      return booking;
    },
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
        location: { type: "address", value: "Studio A" },
      });
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
  ])("rejects %j", async (email) => {
    expect(await attempt(email)).toBe("INVALID_EMAIL");
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
