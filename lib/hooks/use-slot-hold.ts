import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../booking/session";

/**
 * Automatically maintains a "hold" on one or more slots by sending periodic heartbeats.
 * Creates presence records at 15-minute quantum intervals for complete coverage.
 *
 * @param resourceId - The resource ID (e.g. "studio-a")
 * @param slotId - The ID of the selected slot (e.g. "2024-05-20T10:00:00.000Z")
 * @param durationMinutes - Duration of the booking in minutes (LOCKED at slot selection)
 * @param eventTypeId - Optional event type ID for admin presence awareness
 *
 * NOTE: durationMinutes is intentionally NOT in the useEffect dependency array.
 * Per UX design, once a user selects a slot, the duration is LOCKED and cannot change.
 * If the user wants a different duration, they must click "Back" and reselect.
 */
export function useSlotHold(
  resourceId: string,
  slotId: string | null,
  durationMinutes: number = 60,
  eventTypeId?: string
) {
  const heartbeat = useMutation(api.booking.heartbeat);
  const leave = useMutation(api.booking.leave);
  // We use state to ensure ID is stable for the component lifecycle
  const [userId] = useState(() => getSessionId());

  useEffect(() => {
    if (!slotId) return;

    // Use 15-minute quantum intervals for complete presence coverage
    // This ensures conflict detection works regardless of display slot interval
    // Example: 60-min booking → 4 presence records (13:00, 13:15, 13:30, 13:45)
    const QUANTUM_MINUTES = 15;
    const quantumsNeeded = Math.ceil(durationMinutes / QUANTUM_MINUTES);

    // Generate array of affected slot times at quantum intervals
    const startTime = new Date(slotId).getTime();
    const affectedSlots: string[] = [];

    for (let i = 0; i < quantumsNeeded; i++) {
      const slotTime = new Date(startTime + i * QUANTUM_MINUTES * 60 * 1000);
      affectedSlots.push(slotTime.toISOString());
    }

    // 1. Immediate heartbeat when slot is selected (batched API - single call!)
    heartbeat({ resourceId, slots: affectedSlots, user: userId, eventTypeId });

    // 2. Periodic heartbeat every 5 seconds
    const interval = setInterval(() => {
      heartbeat({ resourceId, slots: affectedSlots, user: userId, eventTypeId });
    }, 5000);

    // 3. Cleanup: Explicitly leave when unmounting or changing slots
    return () => {
      clearInterval(interval);
      leave({ resourceId, slots: affectedSlots, user: userId });
    };
  }, [resourceId, slotId, userId, eventTypeId, heartbeat, leave]);
  // NOTE: durationMinutes intentionally NOT in deps - it's locked at selection time

  return userId;
}

