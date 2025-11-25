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
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  booking: typeof booking;
  seed: typeof seed;
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
    hooks: {
      getBookingHistory: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any
      >;
      getHook: FunctionReference<"query", "internal", { hookId: string }, any>;
      listHooks: FunctionReference<
        "query",
        "internal",
        { eventType?: string; organizationId?: string },
        any
      >;
      registerHook: FunctionReference<
        "mutation",
        "internal",
        { eventType: string; functionHandle: string; organizationId?: string },
        any
      >;
      transitionBookingState: FunctionReference<
        "mutation",
        "internal",
        {
          bookingId: string;
          changedBy?: string;
          reason?: string;
          toStatus: string;
        },
        any
      >;
      unregisterHook: FunctionReference<
        "mutation",
        "internal",
        { hookId: string },
        any
      >;
      updateHook: FunctionReference<
        "mutation",
        "internal",
        { enabled?: boolean; functionHandle?: string; hookId: string },
        any
      >;
    };
    multi_resource: {
      cancelMultiResourceBooking: FunctionReference<
        "mutation",
        "internal",
        { bookingId: string; cancelledBy?: string; reason?: string },
        any
      >;
      checkMultiResourceAvailability: FunctionReference<
        "query",
        "internal",
        {
          end: number;
          resources: Array<{ quantity?: number; resourceId: string }>;
          start: number;
        },
        any
      >;
      createMultiResourceBooking: FunctionReference<
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
          location?: { type: string; value?: string };
          organizationId?: string;
          resources: Array<{ quantity?: number; resourceId: string }>;
          start: number;
          timezone: string;
        },
        any
      >;
      getBookingWithItems: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any
      >;
    };
    presence: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string; slot: string; user: string },
        any
      >;
      getDatePresence: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { data?: any; resourceId: string; slots: Array<string>; user: string },
        any
      >;
      leave: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string; slots: Array<string>; user: string },
        any
      >;
      list: FunctionReference<
        "query",
        "internal",
        { resourceId: string; slot: string },
        any
      >;
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
      createEventType: FunctionReference<
        "mutation",
        "internal",
        {
          bufferAfter?: number;
          bufferBefore?: number;
          description?: string;
          id: string;
          isActive?: boolean;
          lengthInMinutes: number;
          lengthInMinutesOptions?: Array<number>;
          locations: Array<{
            address?: string;
            public?: boolean;
            type: string;
          }>;
          lockTimeZoneToggle: boolean;
          maxFutureMinutes?: number;
          minNoticeMinutes?: number;
          organizationId?: string;
          requiresConfirmation?: boolean;
          scheduleId?: string;
          slotInterval?: number;
          slug: string;
          timezone: string;
          title: string;
        },
        any
      >;
      createReservation: FunctionReference<
        "mutation",
        "internal",
        { actorId: string; end: number; resourceId: string; start: number },
        any
      >;
      deleteEventType: FunctionReference<
        "mutation",
        "internal",
        { id: string },
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
      getBookingByUid: FunctionReference<
        "query",
        "internal",
        { uid: string },
        any
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
        any
      >;
      getEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any
      >;
      getEventTypeBySlug: FunctionReference<
        "query",
        "internal",
        { organizationId?: string; slug: string },
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
          slotInterval?: number;
        },
        any
      >;
      listBookings: FunctionReference<
        "query",
        "internal",
        {
          dateFrom?: number;
          dateTo?: number;
          eventTypeId?: string;
          limit?: number;
          organizationId?: string;
          resourceId?: string;
          status?: string;
        },
        any
      >;
      listEventTypes: FunctionReference<
        "query",
        "internal",
        { activeOnly?: boolean; organizationId?: string },
        any
      >;
      toggleEventTypeActive: FunctionReference<
        "mutation",
        "internal",
        { id: string; isActive: boolean },
        any
      >;
      updateEventType: FunctionReference<
        "mutation",
        "internal",
        {
          bufferAfter?: number;
          bufferBefore?: number;
          description?: string;
          id: string;
          isActive?: boolean;
          lengthInMinutes?: number;
          lengthInMinutesOptions?: Array<number>;
          locations?: Array<{
            address?: string;
            public?: boolean;
            type: string;
          }>;
          lockTimeZoneToggle?: boolean;
          maxFutureMinutes?: number;
          minNoticeMinutes?: number;
          requiresConfirmation?: boolean;
          scheduleId?: string;
          slotInterval?: number;
          slug?: string;
          timezone?: string;
          title?: string;
        },
        any
      >;
    };
    resource_event_types: {
      deleteAllLinksForEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string },
        any
      >;
      deleteAllLinksForResource: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string },
        any
      >;
      getEventTypeIdsForResource: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any
      >;
      getEventTypesForResource: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any
      >;
      getResourceIdsForEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any
      >;
      getResourcesForEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any
      >;
      hasLink: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string; resourceId: string },
        any
      >;
      linkResourceToEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceId: string },
        any
      >;
      setEventTypesForResource: FunctionReference<
        "mutation",
        "internal",
        { eventTypeIds: Array<string>; resourceId: string },
        any
      >;
      setResourcesForEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceIds: Array<string> },
        any
      >;
      unlinkResourceFromEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceId: string },
        any
      >;
    };
    resources: {
      createResource: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          id: string;
          isActive?: boolean;
          isFungible?: boolean;
          isStandalone?: boolean;
          name: string;
          organizationId: string;
          quantity?: number;
          timezone: string;
          type: string;
        },
        any
      >;
      deleteResource: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any
      >;
      getQuantityAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any
      >;
      getResource: FunctionReference<"query", "internal", { id: string }, any>;
      getResourceAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any
      >;
      getResourceById: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any
      >;
      listResources: FunctionReference<
        "query",
        "internal",
        { activeOnly?: boolean; organizationId: string; type?: string },
        any
      >;
      listResourcesByType: FunctionReference<
        "query",
        "internal",
        { organizationId: string; type: string },
        any
      >;
      toggleResourceActive: FunctionReference<
        "mutation",
        "internal",
        { id: string; isActive: boolean },
        any
      >;
      updateResource: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          id: string;
          isActive?: boolean;
          isFungible?: boolean;
          isStandalone?: boolean;
          name?: string;
          quantity?: number;
          timezone?: string;
          type?: string;
        },
        any
      >;
    };
    schedules: {
      createDateOverride: FunctionReference<
        "mutation",
        "internal",
        {
          customHours?: Array<{ endTime: string; startTime: string }>;
          date: string;
          scheduleId: string;
          type: string;
        },
        any
      >;
      createSchedule: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          isDefault?: boolean;
          name: string;
          organizationId: string;
          timezone: string;
          weeklyHours: Array<{
            dayOfWeek: number;
            endTime: string;
            startTime: string;
          }>;
        },
        any
      >;
      deleteDateOverride: FunctionReference<
        "mutation",
        "internal",
        { overrideId: string },
        any
      >;
      deleteSchedule: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any
      >;
      getDateOverride: FunctionReference<
        "query",
        "internal",
        { date: string; scheduleId: string },
        any
      >;
      getDefaultSchedule: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        any
      >;
      getEffectiveAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; scheduleId: string },
        any
      >;
      getSchedule: FunctionReference<"query", "internal", { id: string }, any>;
      getScheduleById: FunctionReference<
        "query",
        "internal",
        { scheduleId: string },
        any
      >;
      listDateOverrides: FunctionReference<
        "query",
        "internal",
        { dateFrom?: string; dateTo?: string; scheduleId: string },
        any
      >;
      listSchedules: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        any
      >;
      updateDateOverride: FunctionReference<
        "mutation",
        "internal",
        {
          customHours?: Array<{ endTime: string; startTime: string }>;
          overrideId: string;
          type?: string;
        },
        any
      >;
      updateSchedule: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          isDefault?: boolean;
          name?: string;
          timezone?: string;
          weeklyHours?: Array<{
            dayOfWeek: number;
            endTime: string;
            startTime: string;
          }>;
        },
        any
      >;
    };
  };
};
