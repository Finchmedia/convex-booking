"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CalendarGrid } from "./calendar-grid";
import { TimeSlotsPanel } from "./time-slots-panel";
import { EventMetaPanel } from "./event-meta-panel";
import { useConvexSlots } from "@/lib/hooks/use-convex-slots";
import { useIntersectionObserver } from "@/lib/hooks/use-intersection-observer";

interface CalendarProps {
  resourceId: string;
  eventTypeId: string; // Event type ID (contains duration, timezone, etc.)
  onSlotSelect: (data: { slot: string; duration: number }) => void; // Pass both slot AND duration
  title?: string;
  description?: string;
  showHeader?: boolean;
  organizerName?: string; // Organizer name to display
  organizerAvatar?: string; // Organizer avatar URL

  // Controlled state props (lifted to parent)
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDuration: number;
  onDurationChange: (duration: number) => void;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  timeFormat: "12h" | "24h";
  onTimeFormatChange: (format: "12h" | "24h") => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  resourceId,
  eventTypeId,
  onSlotSelect,
  title,
  description,
  showHeader,
  organizerName,
  organizerAvatar,
  // Controlled state
  selectedDate,
  onDateChange,
  currentMonth,
  onMonthChange,
  selectedDuration,
  onDurationChange,
  timezone,
  onTimezoneChange,
  timeFormat,
  onTimeFormatChange,
}) => {

  // Fetch event type configuration
  const eventType = useQuery(api.booking.getEventType, { eventTypeId });

  // Event type timezone (overrides browser timezone when locked)
  const eventTimezone = eventType?.timezone || "Europe/Berlin";
  const isTimezoneLocked = eventType?.lockTimeZoneToggle || false;

  // Use controlled duration from props
  const eventLength = selectedDuration;

  // Extract slot interval and all duration options for smart defaulting
  const slotInterval = eventType?.slotInterval;
  const allDurationOptions = eventType
    ? [eventType.lengthInMinutes, ...(eventType.lengthInMinutesOptions || [])]
    : undefined;

  // Intersection observer to detect when calendar becomes visible
  const [calendarRef, isIntersecting, hasIntersected] = useIntersectionObserver(
    {
      rootMargin: "500px",
      triggerOnce: true,
    }
  );

  // Use Convex hook for slots data - only enabled when visible
  const { monthSlots, availableSlots, reservedSlots, isLoading, isReloading, fetchMonthSlots, fetchSlots } =
    useConvexSlots(
      resourceId,
      eventLength,
      slotInterval,
      allDurationOptions,
      hasIntersected
    );

  // Auto-select today's date
  const autoSelectToday = () => {
    if (!selectedDate) {
      const today = new Date();
      onDateChange(today);
      fetchSlots(today);
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    onDateChange(date);
    fetchSlots(date);
  };

  // Navigation
  const goToPreviousMonth = () => {
    onMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    onMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  // Fetch month slots when calendar becomes visible or month changes
  useEffect(() => {
    if (hasIntersected) {
      fetchMonthSlots(currentMonth);
    }
  }, [
    hasIntersected,
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    fetchMonthSlots,
  ]);

  // Auto-select today's date when month slots are loaded
  useEffect(() => {
    if (Object.keys(monthSlots).length > 0) {
      autoSelectToday();
    }
  }, [monthSlots]);

  // Fetch slots for selected date when it changes (including on mount with persisted date)
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  return (
    <div
      ref={calendarRef}
      className="bg-neutral-900 overflow-hidden rounded-xl border border-neutral-800 shadow"
    >
      {/* Optional Header */}
      {showHeader && (
        <div className="border-b border-neutral-800 p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-neutral-100">{title}</h1>
          <p className="text-neutral-400">{description}</p>
        </div>
      )}

      {/* 3-Column Layout: Event Meta | Calendar | Time Slots */}
      <div className="flex flex-col md:flex-row">
        {/* Event Meta Panel */}
        <EventMetaPanel
          eventType={eventType}
          selectedDuration={selectedDuration}
          onDurationChange={onDurationChange}
          userTimezone={timezone}
          onTimezoneChange={onTimezoneChange}
          timezoneLocked={isTimezoneLocked}
          organizerName={organizerName}
          organizerAvatar={organizerAvatar}
        />

        {/* Calendar Grid */}
        <CalendarGrid
          currentDate={currentMonth}
          selectedDate={selectedDate}
          monthSlots={monthSlots}
          onDateSelect={handleDateSelect}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {/* Time Slots Panel (timezone removed) */}
        <TimeSlotsPanel
          selectedDate={selectedDate}
          availableSlots={availableSlots}
          reservedSlots={reservedSlots}
          loading={isLoading}
          isReloading={isReloading}
          timeFormat={timeFormat}
          onTimeFormatChange={onTimeFormatChange}
          onSlotSelect={(slot) => onSlotSelect({ slot, duration: selectedDuration })}
        />
      </div>
    </div>
  );
};
