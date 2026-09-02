"use client";

import { type ReactNode, useMemo } from "react";
import { ConvexProvider, useConvex, type ConvexReactClient } from "convex/react";
import { toast } from "sonner";
import { convexErrorMessage } from "@/lib/convex-error-message";

/**
 * Surfaces booking-mutation failures as toasts.
 *
 * The @mrfinch/booking 0.3.0 Booker catches createBooking / reschedule errors,
 * stores them in a state variable it never renders and exposes no error
 * callback — so a rejected booking (SLOT_NOT_AVAILABLE, RATE_LIMITED, …)
 * would be invisible: the form simply re-enables. The Booker obtains its
 * mutations through convex/react's `useMutation`, which reads the client from
 * ConvexContext, so this wraps the subtree in a nested `ConvexProvider` whose
 * client delegates everything to the real one (same connection, same auth)
 * but toasts `error.data.message` before re-throwing.
 *
 * Host-side workaround only; remove once the component renders its own
 * booking errors (or offers an onBookingError prop).
 */
export function BookingErrorToaster({ children }: { children: ReactNode }) {
  const client = useConvex();
  const toasting = useMemo(() => withMutationToasts(client), [client]);
  return <ConvexProvider client={toasting}>{children}</ConvexProvider>;
}

const TOAST_ID = "booking-error";

function withMutationToasts(client: ConvexReactClient): ConvexReactClient {
  const mutation: ConvexReactClient["mutation"] = (ref, ...argsAndOptions) =>
    client.mutation(ref, ...argsAndOptions).catch((error: unknown) => {
      toast.error(
        convexErrorMessage(error, "Booking failed — please try again."),
        { id: TOAST_ID }
      );
      throw error;
    });

  return new Proxy(client, {
    get(target, prop) {
      if (prop === "mutation") return mutation;
      const value = Reflect.get(target, prop, target);
      // Keep `this` bound to the real client for every other method.
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
