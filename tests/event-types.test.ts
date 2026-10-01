import { describe, expect, it } from "vitest";
import * as admin from "../convex/admin";
import * as publicApi from "../convex/public";
import { toEventTypePayload } from "../app/admin/event-types/_components/event-type-form";
import { errorCode, fakeCtx, run } from "./convex-fake-ctx";

const MINUTE = 60 * 1000;

/** A component event-type document with two durations and a description. */
const storedEventType = () => ({
  _id: "k57eventtypedoc",
  _creationTime: 1_900_000_000_000,
  id: "studio-session",
  slug: "studio-session",
  title: "Studio session",
  description: "Bring your own headphones.",
  lengthInMinutes: 30,
  lengthInMinutesOptions: [30, 60] as number[],
  slotInterval: 15,
  timezone: "Europe/Berlin",
  lockTimeZoneToggle: false,
  locations: [{ type: "in_person" }],
  isActive: true,
});

describe("public getEventType for a missing event type (N1)", () => {
  it("returns null when the component finds no event type", async () => {
    // 0.5.0 returns null for an unknown ID (0.4.x threw "Event type not found").
    const { ctx } = fakeCtx({ "public/getEventType": () => null });
    expect(await run(publicApi.getEventType, ctx, { eventTypeId: "deleted" })).toBeNull();
  });

  it("control: an existing event type is returned unchanged", async () => {
    const eventType = storedEventType();
    const { ctx } = fakeCtx({ "public/getEventType": () => eventType });
    expect(await run(publicApi.getEventType, ctx, { eventTypeId: eventType.id })).toBe(eventType);
  });

  it("other component failures still propagate", async () => {
    const failure = new Error("Transient failure");
    const { ctx } = fakeCtx({
      "public/getEventType": () => {
        throw failure;
      },
    });
    await expect(run(publicApi.getEventType, ctx, { eventTypeId: "studio-session" })).rejects.toBe(
      failure
    );
  });
});

describe("admin event-type form clears removed settings (N25)", () => {
  /** Form values as the admin edit form submits them. */
  const formValues = (durations: number[], description: string) => ({
    title: "Studio session",
    slug: "studio-session",
    description,
    durations,
    slotInterval: 15,
    timezone: "Europe/Berlin",
    lockTimezone: false,
    locations: [{ type: "in_person" }],
    bufferBefore: 0,
    bufferAfter: 15,
    minNotice: 0,
    maxFuture: 60 * 24 * 60,
    requiresConfirmation: false,
    isActive: true,
    resourceIds: ["studio-a"],
  });

  it("sends the duration list and the description even when single or empty", () => {
    const payload = toEventTypePayload(formValues([30], ""));
    expect(payload).toMatchObject({ lengthInMinutes: 30, lengthInMinutesOptions: [30], description: "" });
    // Control: several durations and a description go through as entered.
    expect(toEventTypePayload(formValues([30, 60], "Notes"))).toMatchObject({
      lengthInMinutes: 30,
      lengthInMinutesOptions: [30, 60],
      description: "Notes",
    });
  });

  it("a duration removed in the form is no longer bookable", async () => {
    const eventType = storedEventType();
    const { ctx } = fakeCtx({
      // Like the component: update patches every provided field and keeps
      // omitted ones (Convex drops `undefined` arguments in transport).
      "public/updateEventType": (args) => {
        for (const [key, value] of Object.entries(args)) {
          if (key !== "id" && value !== undefined) Object.assign(eventType, { [key]: value });
        }
        return null;
      },
      "public/getEventType": () => eventType,
      "resources/getResource": () => ({ id: "studio-a", isActive: true }),
      "resource_event_types/hasResourceEventTypeLink": () => true,
    });
    const adminCtx = { ...ctx, auth: { getUserIdentity: async () => ({ subject: "users|admin" }) } };

    // A past start fails right after the duration check, so IN_PAST means
    // "this duration is allowed" without stubbing the schedule.
    const start = Date.UTC(2001, 0, 1, 10);
    const book = (minutes: number) =>
      errorCode(
        run(publicApi.createBooking, ctx, {
          eventTypeId: eventType.id,
          resourceId: "studio-a",
          start,
          end: start + minutes * MINUTE,
          timezone: "Europe/Berlin",
          booker: { name: "Ada", email: "ada@example.com" },
          location: { type: "in_person" },
        })
      );

    // Control: before the edit, the 60-minute option is accepted.
    expect(await book(60)).toBe("IN_PAST");

    await run(admin.updateEventType, adminCtx, {
      id: eventType.id,
      ...toEventTypePayload(formValues([30], "")),
    });

    expect(eventType.lengthInMinutesOptions).toEqual([30]);
    expect(eventType.description).toBe("");
    expect(await book(60)).toBe("INVALID_DURATION");
    // Control: the remaining duration is still accepted.
    expect(await book(30)).toBe("IN_PAST");
  });
});
