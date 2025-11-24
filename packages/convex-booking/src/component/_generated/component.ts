/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    presence: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { room: string; user: string },
        any,
        Name
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { data?: any; rooms: Array<string>; user: string },
        any,
        Name
      >;
      leave: FunctionReference<
        "mutation",
        "internal",
        { rooms: Array<string>; user: string },
        any,
        Name
      >;
      list: FunctionReference<"query", "internal", { room: string }, any, Name>;
    };
    public: {
      cancelReservation: FunctionReference<
        "mutation",
        "internal",
        { reservationId: string },
        any,
        Name
      >;
      createBooking: FunctionReference<
        "mutation",
        "internal",
        {
          booker: {
            email: string;
            name: string;
            notes?: string;
            phone?: string;
          };
          end: number;
          eventTypeId: string;
          location: { type: string; value?: string };
          resourceId: string;
          start: number;
          timezone: string;
        },
        any,
        Name
      >;
      createEventType: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          id: string;
          lengthInMinutes: number;
          lengthInMinutesOptions?: Array<number>;
          locations: Array<{
            address?: string;
            public?: boolean;
            type: string;
          }>;
          lockTimeZoneToggle: boolean;
          slotInterval?: number;
          slug: string;
          timezone: string;
          title: string;
        },
        any,
        Name
      >;
      createReservation: FunctionReference<
        "mutation",
        "internal",
        { actorId: string; end: number; resourceId: string; start: number },
        any,
        Name
      >;
      getAvailability: FunctionReference<
        "query",
        "internal",
        { end: number; resourceId: string; start: number },
        any,
        Name
      >;
      getBooking: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any,
        Name
      >;
      getDaySlots: FunctionReference<
        "query",
        "internal",
        {
          date: string;
          eventLength: number;
          resourceId: string;
          slotInterval?: number;
        },
        any,
        Name
      >;
      getEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any,
        Name
      >;
      getMonthAvailability: FunctionReference<
        "query",
        "internal",
        {
          dateFrom: string;
          dateTo: string;
          eventLength: number;
          resourceId: string;
          slotInterval?: number;
        },
        any,
        Name
      >;
    };
  };
