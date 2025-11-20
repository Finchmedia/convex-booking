import { useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { components } from "@/convex/_generated/api";

export interface TimeSlot {
  time: string;
  attendees: number;
}

export interface MonthSlots {
  [date: string]: { start: string; attendees?: number }[];
}

export interface UseConvexSlotsResult {
  monthSlots: MonthSlots;
  availableSlots: TimeSlot[];
  loading: boolean;
  fetchMonthSlots: (currentDate: Date) => void;
  fetchSlots: (date: Date) => void;
}

export const useConvexSlots = (
  resourceId: string,
  eventLength: number,
  enabled: boolean = true
): UseConvexSlotsResult => {
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Query Convex for available slots
  const convexSlots = useQuery(
    components.booking.public.getAvailableSlots as any,
    enabled && dateRange
      ? {
          resourceId,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          eventLength,
        }
      : "skip"
  );

  // Transform Convex data to monthSlots format
  const monthSlots: MonthSlots = {};
  if (convexSlots) {
    Object.entries(convexSlots).forEach(([date, slots]) => {
      monthSlots[date] = (slots as any[]).map((slot) => ({
        start: slot.time,
        attendees: 0,
      }));
    });
  }

  // Loading state - true if query is in progress
  const loading = dateRange !== null && convexSlots === undefined;

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

  // Update availableSlots when selectedDateStr or convexSlots changes
  useEffect(() => {
    if (!selectedDateStr || !convexSlots) {
      setAvailableSlots([]);
      return;
    }

    const slots = convexSlots[selectedDateStr] || [];
    const formattedSlots = (slots as any[]).map((slot) => ({
      time: slot.time,
      attendees: 0,
    }));

    // Sort by time
    formattedSlots.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    setAvailableSlots(formattedSlots);
  }, [selectedDateStr, convexSlots]);

  return {
    monthSlots,
    availableSlots,
    loading,
    fetchMonthSlots,
    fetchSlots,
  };
};
