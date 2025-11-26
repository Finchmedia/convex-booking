import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../booking/session";

/**
 * Checks if a specific slot is currently held by another user.
 * @param resourceId - The resource ID (e.g. "studio-a")
 * @param slotId - The ID of the slot to check
 */
export function useSlotPresence(resourceId: string, slotId: string) {
  // Fetch active users in this slot
  const presence = useQuery(api.booking.getPresence, { resourceId, slot: slotId });
  
  // Get current user's ID
  const myUserId = getSessionId();

  // If no data yet, assume free (or loading)
  if (!presence) {
    return {
      isLocked: false,
      isHeldByMe: false,
      isLoading: true,
    };
  }

  // Logic: 
  // 1. If presence list is empty -> Free
  // 2. If most recent user is ME -> Free (for me)
  // 3. If most recent user is OTHER -> Locked
  
  const holdingUser = presence[0]; // List is sorted by `updated` desc
  const isHeld = !!holdingUser;
  const isHeldByMe = holdingUser?.user === myUserId;
  const isHeldByOther = isHeld && !isHeldByMe;

  return {
    isLocked: isHeldByOther, // The main flag for UI
    isHeldByMe,
    holderCount: presence.length,
    isLoading: false,
  };
}

