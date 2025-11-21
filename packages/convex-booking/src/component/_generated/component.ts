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
    public: {
      cancelReservation: FunctionReference<
        "mutation",
        "internal",
        { reservationId: string },
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
      getAvailableSlots: FunctionReference<
        "query",
        "internal",
        {
          dateFrom: string;
          dateTo: string;
          eventLength: number;
          resourceId: string;
        },
        any,
        Name
      >;
      getDaySlots: FunctionReference<
        "query",
        "internal",
        { date: string; eventLength: number; resourceId: string },
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
        },
        any,
        Name
      >;
    };
  };
