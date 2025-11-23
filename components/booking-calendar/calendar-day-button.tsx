"use client";

import React, { useCallback } from "react";
import type { CalendarDay } from "@/lib/booking-calendar/utils/date-utils";

interface CalendarDayButtonProps {
  day: CalendarDay;
  onDateSelect: (date: Date) => void;
}

export const CalendarDayButton = React.memo<CalendarDayButtonProps>(({
  day,
  onDateSelect,
}) => {
  const handleClick = useCallback(() => {
    if (!day.disabled) {
      onDateSelect(day.date);
    }
  }, [day.disabled, day.date, onDateSelect]);

  return (
    <div className="relative w-full pt-[100%]">
      <button
        onClick={handleClick}
        disabled={day.disabled}
        className={`absolute inset-0 flex items-center justify-center rounded-md text-base font-medium transition-all ${
          day.isSelected
            ? "bg-neutral-700 text-white ring-1 ring-neutral-500" // Matched "Today" style
            : day.isToday
            ? "bg-neutral-700 text-white ring-1 ring-neutral-500"
            : day.disabled
            ? "cursor-not-allowed text-neutral-600"
            : day.hasSlots
            ? "bg-neutral-800 text-neutral-100 hover:border-2 hover:border-neutral-500"
            : "text-neutral-500 hover:bg-neutral-800"
        } ${!day.isCurrentMonth ? "opacity-40" : ""}`}>
        {day.day}
        {/* Show dot ONLY if it's Today, regardless of hasSlots */}
        {day.isToday && (
          <div className="absolute bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-400" />
        )}
      </button>
    </div>
  );
});

CalendarDayButton.displayName = 'CalendarDayButton';
