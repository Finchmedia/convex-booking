import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../booking/session";

/**
 * Automatically maintains a "hold" on one or more slots by sending periodic heartbeats.
 * Supports multi-slot holds for bookings that span multiple slot intervals.
 *
 * @param resourceId - The resource ID (e.g. "studio-a")
 * @param slotId - The ID of the selected slot (e.g. "2024-05-20T10:00:00.000Z")
 * @param durationMinutes - Duration of the booking in minutes (LOCKED at slot selection)
 * @param intervalMinutes - Slot interval in minutes (defaults to duration if not provided)
 *
 * NOTE: durationMinutes is intentionally NOT in the useEffect dependency array.
 * Per UX design, once a user selects a slot, the duration is LOCKED and cannot change.
 * If the user wants a different duration, they must click "Back" and reselect.
 */
export function useSlotHold(
  resourceId: string,
  slotId: string | null,
  durationMinutes: number = 60,
  intervalMinutes: number = 60
) {
  const heartbeat = useMutation(api.booking.heartbeat);
  const leave = useMutation(api.booking.leave);
  // We use state to ensure ID is stable for the component lifecycle
  const [userId] = useState(() => getSessionId());

  useEffect(() => {
    if (!slotId) return;

    // Calculate how many slot intervals this booking spans
    // Example: 90-min booking with 60-min intervals → Math.ceil(90/60) = 2 slots
    const intervalsNeeded = Math.ceil(durationMinutes / intervalMinutes);

    // Generate array of affected slot times
    const startTime = new Date(slotId).getTime();
    const affectedSlots: string[] = [];

    for (let i = 0; i < intervalsNeeded; i++) {
      const slotTime = new Date(startTime + i * intervalMinutes * 60 * 1000);
      affectedSlots.push(slotTime.toISOString());
    }

    // 1. Immediate heartbeat when slot is selected (batched API - single call!)
    heartbeat({ resourceId, slots: affectedSlots, user: userId });

    // 2. Periodic heartbeat every 5 seconds
    const interval = setInterval(() => {
      heartbeat({ resourceId, slots: affectedSlots, user: userId });
    }, 5000);

    // 3. Cleanup: Explicitly leave when unmounting or changing slots
    return () => {
      clearInterval(interval);
      leave({ resourceId, slots: affectedSlots, user: userId });
    };
  }, [resourceId, slotId, intervalMinutes, userId, heartbeat, leave]);
  // NOTE: durationMinutes intentionally NOT in deps - it's locked at selection time

  return userId;
}

