import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../booking/session";

/**
 * Automatically maintains a "hold" on a slot by sending periodic heartbeats.
 * @param slotId - The ID of the slot to hold (e.g. "2024-05-20T10:00:00.000Z")
 */
export function useSlotHold(slotId: string | null) {
  const heartbeat = useMutation(api.booking.heartbeat);
  const leave = useMutation(api.booking.leave);
  // We use state to ensure ID is stable for the component lifecycle
  const [userId] = useState(() => getSessionId());

  useEffect(() => {
    if (!slotId) return;

    // 1. Immediate heartbeat when slot is selected
    heartbeat({ room: slotId, user: userId });

    // 2. Periodic heartbeat every 5 seconds
    const interval = setInterval(() => {
      heartbeat({ room: slotId, user: userId });
    }, 5000);

    // 3. Cleanup: Explicitly leave when unmounting or changing slots
    return () => {
      clearInterval(interval);
      leave({ room: slotId, user: userId });
    };
  }, [slotId, userId, heartbeat, leave]); // Re-run if slot changes

  return userId;
}

