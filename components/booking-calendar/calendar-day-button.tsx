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
            ? "bg-accent text-foreground ring-1 ring-foreground" // Stronger border for selection
            : day.isToday
            ? "bg-accent text-foreground ring-1 ring-muted-foreground"
            : day.disabled
            ? "cursor-not-allowed text-muted-foreground/50"
            : day.hasSlots
            ? "bg-muted text-foreground hover:ring-2 hover:ring-foreground/50"
            : "text-muted-foreground hover:bg-muted hover:ring-1 hover:ring-foreground/30"
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
