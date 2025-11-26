"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/booking-calendar/utils/date-utils";

interface CalendarNavigationProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const CalendarNavigation: React.FC<CalendarNavigationProps> = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
}) => {
  return (
    <div className="mb-1 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-foreground">
        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
      </h2>
      <div className="flex gap-1">
        <button
          onClick={onPreviousMonth}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:border-border hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:border-border hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
