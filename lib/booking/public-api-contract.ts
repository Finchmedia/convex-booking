/**
 * Compile-time check of the public gateway (convex/public.ts) against the
 * React contract of @mrfinch/booking. Type-only: nothing imports this file and
 * it emits no code, but `next build` and `tsc --noEmit` typecheck it, so a
 * gateway change that no longer fits what the Booker and Calendar call fails
 * the build with an error naming the function, e.g.
 * "The types of 'getDaySlots._fn' are incompatible".
 *
 * BookingProvider checks the same on each page; this file checks the gateway
 * on its own, for both props variants the demo uses.
 */
import type {
  PublicBookingAPI,
  PublicBookingAPIWithAvailabilityContext,
} from "@mrfinch/booking/react";
import type { api } from "@/convex/_generated/api";

/** `T satisfies Contract`, as a type. */
type Satisfies<T extends Contract, Contract> = T;

/** /book: BookingProvider without availabilityContext. */
export type PublicApiContract = Satisfies<typeof api.public, PublicBookingAPI>;

/**
 * The reschedule page: availabilityContext on, so getDaySlots and
 * getMonthAvailability must declare eventTypeId and rescheduleContext
 * ({ uid, token }).
 */
export type PublicApiContractWithAvailabilityContext = Satisfies<
  typeof api.public,
  PublicBookingAPIWithAvailabilityContext
>;
