import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export interface TimeSlot {
  time: string;
  attendees: number;
}

export type MonthSlots = Record<string, boolean>;

export interface UseConvexSlotsResult {
  monthSlots: MonthSlots;
  availableSlots: TimeSlot[];
  isLoading: boolean; // True on first load
  isReloading: boolean; // True when refreshing data (keep showing old data)
  fetchMonthSlots: (currentDate: Date) => void;
  fetchSlots: (date: Date) => void;
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

  const monthSlots: MonthSlots = monthAvailability ?? {};

  // STALENESS LOGIC: Keep previous data while loading new data
  const prevSlotsRef = useRef<TimeSlot[]>([]);
  
  // Process new data if available
  const currentSlots = useMemo<TimeSlot[] | undefined>(() => {
    if (!daySlots) return undefined;

    const formatted = (daySlots as any[]).map((slot) => ({
      time: slot.time,
      attendees: 0,
    }));

    formatted.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    return formatted;
  }, [daySlots]);

  // Update ref only when we have real data
  useEffect(() => {
    if (currentSlots) {
      prevSlotsRef.current = currentSlots;
    }
  }, [currentSlots]);

  // Decide what to show: Current data OR Previous data
  const availableSlots = currentSlots ?? prevSlotsRef.current;

  // Loading states
  // 1. First load: We have no data at all (neither current nor prev)
  const isLoading = enabled && selectedDateStr !== null && !currentSlots && prevSlotsRef.current.length === 0;
  
  // 2. Reloading: We have prev data, but are waiting for new data
  const isReloading = enabled && selectedDateStr !== null && !currentSlots && prevSlotsRef.current.length > 0;

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
    isLoading,
    isReloading,
    fetchMonthSlots,
    fetchSlots,
  };
};
