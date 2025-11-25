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
    hooks: {
      getBookingHistory: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any,
        Name
      >;
      getHook: FunctionReference<
        "query",
        "internal",
        { hookId: string },
        any,
        Name
      >;
      listHooks: FunctionReference<
        "query",
        "internal",
        { eventType?: string; organizationId?: string },
        any,
        Name
      >;
      registerHook: FunctionReference<
        "mutation",
        "internal",
        { eventType: string; functionHandle: string; organizationId?: string },
        any,
        Name
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
        any,
        Name
      >;
      unregisterHook: FunctionReference<
        "mutation",
        "internal",
        { hookId: string },
        any,
        Name
      >;
      updateHook: FunctionReference<
        "mutation",
        "internal",
        { enabled?: boolean; functionHandle?: string; hookId: string },
        any,
        Name
      >;
    };
    multi_resource: {
      cancelMultiResourceBooking: FunctionReference<
        "mutation",
        "internal",
        { bookingId: string; cancelledBy?: string; reason?: string },
        any,
        Name
      >;
      checkMultiResourceAvailability: FunctionReference<
        "query",
        "internal",
        {
          end: number;
          resources: Array<{ quantity?: number; resourceId: string }>;
          start: number;
        },
        any,
        Name
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
        any,
        Name
      >;
      getBookingWithItems: FunctionReference<
        "query",
        "internal",
        { bookingId: string },
        any,
        Name
      >;
    };
    presence: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string; slot: string; user: string },
        any,
        Name
      >;
      getDatePresence: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any,
        Name
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        { data?: any; resourceId: string; slots: Array<string>; user: string },
        any,
        Name
      >;
      leave: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string; slots: Array<string>; user: string },
        any,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { resourceId: string; slot: string },
        any,
        Name
      >;
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
      deleteEventType: FunctionReference<
        "mutation",
        "internal",
        { id: string },
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
      getBookingByUid: FunctionReference<
        "query",
        "internal",
        { uid: string },
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
      getEventTypeBySlug: FunctionReference<
        "query",
        "internal",
        { organizationId?: string; slug: string },
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
        any,
        Name
      >;
      listEventTypes: FunctionReference<
        "query",
        "internal",
        { activeOnly?: boolean; organizationId?: string },
        any,
        Name
      >;
      toggleEventTypeActive: FunctionReference<
        "mutation",
        "internal",
        { id: string; isActive: boolean },
        any,
        Name
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
        any,
        Name
      >;
    };
    resource_event_types: {
      deleteAllLinksForEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string },
        any,
        Name
      >;
      deleteAllLinksForResource: FunctionReference<
        "mutation",
        "internal",
        { resourceId: string },
        any,
        Name
      >;
      getEventTypeIdsForResource: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any,
        Name
      >;
      getEventTypesForResource: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any,
        Name
      >;
      getResourceIdsForEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any,
        Name
      >;
      getResourcesForEventType: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string },
        any,
        Name
      >;
      hasLink: FunctionReference<
        "query",
        "internal",
        { eventTypeId: string; resourceId: string },
        any,
        Name
      >;
      linkResourceToEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceId: string },
        any,
        Name
      >;
      setEventTypesForResource: FunctionReference<
        "mutation",
        "internal",
        { eventTypeIds: Array<string>; resourceId: string },
        any,
        Name
      >;
      setResourcesForEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceIds: Array<string> },
        any,
        Name
      >;
      unlinkResourceFromEventType: FunctionReference<
        "mutation",
        "internal",
        { eventTypeId: string; resourceId: string },
        any,
        Name
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
        any,
        Name
      >;
      deleteResource: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any,
        Name
      >;
      getQuantityAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any,
        Name
      >;
      getResource: FunctionReference<
        "query",
        "internal",
        { id: string },
        any,
        Name
      >;
      getResourceAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; resourceId: string },
        any,
        Name
      >;
      getResourceById: FunctionReference<
        "query",
        "internal",
        { resourceId: string },
        any,
        Name
      >;
      listResources: FunctionReference<
        "query",
        "internal",
        { activeOnly?: boolean; organizationId: string; type?: string },
        any,
        Name
      >;
      listResourcesByType: FunctionReference<
        "query",
        "internal",
        { organizationId: string; type: string },
        any,
        Name
      >;
      toggleResourceActive: FunctionReference<
        "mutation",
        "internal",
        { id: string; isActive: boolean },
        any,
        Name
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
        any,
        Name
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
        any,
        Name
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
        any,
        Name
      >;
      deleteDateOverride: FunctionReference<
        "mutation",
        "internal",
        { overrideId: string },
        any,
        Name
      >;
      deleteSchedule: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any,
        Name
      >;
      getDateOverride: FunctionReference<
        "query",
        "internal",
        { date: string; scheduleId: string },
        any,
        Name
      >;
      getDefaultSchedule: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        any,
        Name
      >;
      getEffectiveAvailability: FunctionReference<
        "query",
        "internal",
        { date: string; scheduleId: string },
        any,
        Name
      >;
      getSchedule: FunctionReference<
        "query",
        "internal",
        { id: string },
        any,
        Name
      >;
      getScheduleById: FunctionReference<
        "query",
        "internal",
        { scheduleId: string },
        any,
        Name
      >;
      listDateOverrides: FunctionReference<
        "query",
        "internal",
        { dateFrom?: string; dateTo?: string; scheduleId: string },
        any,
        Name
      >;
      listSchedules: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        any,
        Name
      >;
      updateDateOverride: FunctionReference<
        "mutation",
        "internal",
        {
          customHours?: Array<{ endTime: string; startTime: string }>;
          overrideId: string;
          type?: string;
        },
        any,
        Name
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
        any,
        Name
      >;
    };
  };
