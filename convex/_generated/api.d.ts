/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as booking from "../booking.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  booking: typeof booking;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  booking: {
    presence: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { room: string; user: string },
        any
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { data?: any; room: string; user: string },
        any
      >;
      leave: FunctionReference<
        "mutation",
        "internal",
        { room: string; user: string },
        any
      >;
      list: FunctionReference<"query", "internal", { room: string }, any>;
    };
    public: {
      cancelReservation: FunctionReference<
        "mutation",
        "internal",
        { reservationId: string },
        any
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
        any
      >;
      createReservation: FunctionReference<
        "mutation",
        "internal",
        { actorId: string; end: number; resourceId: string; start: number },
        any
      >;
      getAvailability: FunctionReference<
        "query",
        "internal",
        { end: number; resourceId: string; start: number },
        any
      >;
      getBooking: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any
      >;
      getDaySlots: FunctionReference<
        "query",
        "internal",
        { date: string; eventLength: number; resourceId: string },
        any
      >;
      getEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any
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
        any
      >;
    };
  };
};
