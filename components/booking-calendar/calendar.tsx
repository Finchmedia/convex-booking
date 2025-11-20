"use client";

import { useState, useEffect } from "react";
import { CalendarGrid } from "./calendar-grid";
import { TimeSlotsPanel } from "./time-slots-panel";
import { useConvexSlots } from "@/lib/hooks/use-convex-slots";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";

interface CalendarProps {
  resourceId: string;
  eventLength: number;
  onSlotSelect: (slot: string) => void;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

export const Calendar: React.FC<CalendarProps> = ({
  resourceId,
  eventLength,
  onSlotSelect,
  title,
  description,
  showHeader,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [userTimezone, setUserTimezone] = useState<string>("");

  // Initialize user timezone
  useEffect(() => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(browserTimezone);
  }, []);

  // Intersection observer to detect when calendar becomes visible
  const [calendarRef, isIntersecting, hasIntersected] = useIntersectionObserver(
    {
      rootMargin: "500px",
      triggerOnce: true,
    }
  );

  // Use Convex hook for slots data - only enabled when visible
  const { monthSlots, availableSlots, loading, fetchMonthSlots, fetchSlots } =
    useConvexSlots(resourceId, eventLength, hasIntersected);

  // Auto-select today's date
  const autoSelectToday = () => {
    if (!selectedDate) {
      const today = new Date();
      setSelectedDate(today);
      fetchSlots(today);
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    fetchSlots(date);
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  // Fetch month slots when calendar becomes visible or month changes
  useEffect(() => {
    if (hasIntersected) {
      fetchMonthSlots(currentDate);
    }
  }, [
    hasIntersected,
    currentDate.getFullYear(),
    currentDate.getMonth(),
    fetchMonthSlots,
  ]);

  // Auto-select today's date when month slots are loaded
  useEffect(() => {
    if (Object.keys(monthSlots).length > 0) {
      autoSelectToday();
    }
  }, [monthSlots]);

  return (
    <div
      ref={calendarRef}
      className="bg-neutral-900 overflow-hidden rounded-2xl border border-neutral-800 shadow"
    >
      {/* Optional Header */}
      {showHeader && (
        <div className="border-b border-neutral-800 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-neutral-100">{title}</h1>
          <p className="text-neutral-400">{description}</p>
        </div>
      )}

      {/* Calendar and Time Slots */}
      <div className="flex flex-col lg:flex-row">
        {/* Calendar Grid */}
        <CalendarGrid
          currentDate={currentDate}
          selectedDate={selectedDate}
          monthSlots={monthSlots}
          onDateSelect={handleDateSelect}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {/* Time Slots Panel */}
        <TimeSlotsPanel
          selectedDate={selectedDate}
          availableSlots={availableSlots}
          loading={loading}
          timeFormat={timeFormat}
          onTimeFormatChange={setTimeFormat}
          userTimezone={userTimezone}
          onTimezoneChange={setUserTimezone}
          onSlotSelect={onSlotSelect}
        />
      </div>
    </div>
  );
};
