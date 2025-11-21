import { useState, useCallback, useMemo } from "react";
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
  const monthAvailability = useQuery(
    api.booking.getMonthAvailability,
    enabled && dateRange
      ? {
          resourceId,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          eventLength,
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
        }
      : "skip"
  );

  const monthSlots: MonthSlots = monthAvailability ?? {};

  const availableSlots = useMemo<TimeSlot[]>(() => {
    if (!daySlots) {
      return [];
    }

    const formatted = (daySlots as any[]).map((slot) => ({
      time: slot.time,
      attendees: 0,
    }));

    formatted.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return formatted;
  }, [daySlots]);

  const loading =
    enabled && selectedDateStr !== null && daySlots === undefined;

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
    loading,
    fetchMonthSlots,
    fetchSlots,
  };
};
