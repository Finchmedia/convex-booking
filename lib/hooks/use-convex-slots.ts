import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "../booking/session";

export interface TimeSlot {
  time: string;
  attendees: number;
}

export type MonthSlots = Record<string, boolean>;

export interface UseConvexSlotsResult {
  monthSlots: MonthSlots;
  availableSlots: TimeSlot[];
  reservedSlots: TimeSlot[]; // NEW: Slots held by other users' presence
  isLoading: boolean; // True on first load
  isReloading: boolean; // True when refreshing data (keep showing old data)
  fetchMonthSlots: (currentDate: Date) => void;
  fetchSlots: (date: Date) => void;
}

/**
 * Helper: Calculate which 15-minute slot indices are required for a booking.
 * @param slotTime - ISO timestamp of the slot start time
 * @param durationMinutes - Duration of the booking in minutes
 * @returns Array of 15-minute slot indices (0-95) that would be occupied
 */
function calculateRequiredSlots(slotTime: string, durationMinutes: number): number[] {
  const startTime = new Date(slotTime).getTime();
  const slotsNeeded = Math.ceil(durationMinutes / 15); // How many 15-min chunks needed

  // Convert start time to slot index (0-95)
  const startDate = new Date(slotTime);
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();
  const startSlotIndex = hours * 4 + Math.floor(minutes / 15);

  // Return array of all required slot indices
  return Array.from({ length: slotsNeeded }, (_, i) => startSlotIndex + i);
}

/**
 * Helper: Check if a booking would conflict with any active presence holds.
 * @param slotTime - ISO timestamp of the slot start time
 * @param durationMinutes - Duration of the booking in minutes
 * @param presence - Array of active presence records
 * @param currentUserId - Current user's session ID
 * @returns true if there's a conflict with another user's hold
 */
function hasPresenceConflict(
  slotTime: string,
  durationMinutes: number,
  presence: Array<{ slot: string; user: string; updated: number }>,
  currentUserId: string
): boolean {
  const requiredSlots = calculateRequiredSlots(slotTime, durationMinutes);

  // Convert all held slots to their indices
  const heldSlots = presence
    .filter((p) => p.user !== currentUserId) // Ignore own holds
    .map((p) => {
      const heldDate = new Date(p.slot);
      const hours = heldDate.getHours();
      const minutes = heldDate.getMinutes();
      return hours * 4 + Math.floor(minutes / 15);
    });

  // Check if any required slot is held by another user
  return requiredSlots.some((slot) => heldSlots.includes(slot));
}

export const useConvexSlots = (
  resourceId: string,
  eventLength: number,
  slotInterval?: number,
  allDurationOptions?: number[],
  enabled: boolean = true
): UseConvexSlotsResult => {
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Smart defaulting: Use minimum duration for maximum booking flexibility (Cal.com best practice)
  const effectiveInterval = slotInterval ?? (
    allDurationOptions && allDurationOptions.length > 0
      ? Math.min(...allDurationOptions)
      : eventLength
  );

  const monthAvailability = useQuery(
    api.booking.getMonthAvailability,
    enabled && dateRange
      ? {
          resourceId,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          eventLength,
          slotInterval: effectiveInterval,
        }
      : "skip"
  );

  const daySlots = useQuery(
    api.booking.getDaySlots,
    enabled && selectedDateStr
      ? {
          resourceId,
          date: selectedDateStr,
          eventLength,
          slotInterval: effectiveInterval,
        }
      : "skip"
  );

  // NEW: Fetch presence data for the selected date (separate query for O(1) invalidation)
  const datePresence = useQuery(
    api.booking.getDatePresence,
    enabled && selectedDateStr
      ? {
          resourceId,
          date: selectedDateStr,
        }
      : "skip"
  );

  // Get current user's session ID (stable across renders)
  const currentUserId = useMemo(() => getSessionId(), []);

  const monthSlots: MonthSlots = monthAvailability ?? {};

  // STALENESS LOGIC: Keep previous data while loading new data
  const prevSlotsRef = useRef<{ available: TimeSlot[]; reserved: TimeSlot[] }>({
    available: [],
    reserved: []
  });

  // Process new data if available + split into available/reserved based on presence
  const processedSlots = useMemo<{ available: TimeSlot[]; reserved: TimeSlot[] } | undefined>(() => {
    if (!daySlots) return undefined;

    const formatted = (daySlots as any[]).map((slot) => ({
      time: slot.time,
      attendees: 0,
    }));

    formatted.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // PRESENCE-AWARE SPLIT: Separate available vs reserved slots
    if (datePresence && datePresence.length > 0) {
      const available = formatted.filter((slot) =>
        !hasPresenceConflict(slot.time, eventLength, datePresence, currentUserId)
      );
      const reserved = formatted.filter((slot) =>
        hasPresenceConflict(slot.time, eventLength, datePresence, currentUserId)
      );
      return { available, reserved };
    }

    // No presence conflicts - all slots available
    return { available: formatted, reserved: [] };
  }, [daySlots, datePresence, eventLength, currentUserId]);

  // Update ref only when we have real data
  useEffect(() => {
    if (processedSlots) {
      prevSlotsRef.current = processedSlots;
    }
  }, [processedSlots]);

  // Decide what to show: Current data OR Previous data
  const currentData = processedSlots ?? prevSlotsRef.current;
  const availableSlots = currentData.available;
  const reservedSlots = currentData.reserved;

  // Loading states
  // 1. First load: We have no data at all (neither current nor prev)
  const isLoading = enabled && selectedDateStr !== null && !processedSlots && prevSlotsRef.current.available.length === 0;

  // 2. Reloading: We have prev data, but are waiting for new data
  const isReloading = enabled && selectedDateStr !== null && !processedSlots && prevSlotsRef.current.available.length > 0;

  // Fetch month slots (for calendar dots)
  const fetchMonthSlots = useCallback(
    (currentDate: Date) => {
      if (!enabled) return;

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Get first and last day of the month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Extend to cover the full calendar view (including prev/next month days)
      const startDate = new Date(firstDay);
      startDate.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

      const endDate = new Date(lastDay);
      endDate.setDate(lastDay.getDate() + (6 - ((lastDay.getDay() + 6) % 7)));

      const dateFrom = startDate.toISOString().split("T")[0];
      const dateTo = endDate.toISOString().split("T")[0];

      setDateRange({ from: dateFrom, to: dateTo });
    },
    [enabled]
  );

  // Fetch slots for a specific date (for time slot panel)
  const fetchSlots = useCallback(
    (date: Date) => {
      if (!enabled) return;

      const dateStr = date.toISOString().split("T")[0];
      setSelectedDateStr(dateStr);
    },
    [enabled]
  );

  return {
    monthSlots,
    availableSlots,
    reservedSlots,
    isLoading,
    isReloading,
    fetchMonthSlots,
    fetchSlots,
  };
};
