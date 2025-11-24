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
  onSlotSelect: (slot: string) => void;
  title?: string;
  description?: string;
  showHeader?: boolean;
  organizerName?: string; // Organizer name to display
  organizerAvatar?: string; // Organizer avatar URL
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
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  // Fetch event type configuration
  const eventType = useQuery(api.booking.getEventType, { eventTypeId });

  // Event type timezone (overrides browser timezone when locked)
  const eventTimezone = eventType?.timezone || "Europe/Berlin";
  const isTimezoneLocked = eventType?.lockTimeZoneToggle || false;

  // Duration management (support for multiple duration options)
  const [selectedDuration, setSelectedDuration] = useState<number>(
    eventType?.lengthInMinutes || 30
  );

  // Update selected duration when event type loads
  useEffect(() => {
    if (eventType?.lengthInMinutes) {
      setSelectedDuration(eventType.lengthInMinutes);
    }
  }, [eventType?.lengthInMinutes]);

  const eventLength = selectedDuration;

  // Use event type timezone if locked, otherwise allow user selection
  const [userTimezone, setUserTimezone] = useState<string>("");

  // Initialize timezone (use event type timezone if locked)
  useEffect(() => {
    if (isTimezoneLocked) {
      setUserTimezone(eventTimezone);
    } else {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(browserTimezone);
    }
  }, [isTimezoneLocked, eventTimezone]);

  // Intersection observer to detect when calendar becomes visible
  const [calendarRef, isIntersecting, hasIntersected] = useIntersectionObserver(
    {
      rootMargin: "500px",
      triggerOnce: true,
    }
  );

  // Use Convex hook for slots data - only enabled when visible
  const { monthSlots, availableSlots, isLoading, isReloading, fetchMonthSlots, fetchSlots } =
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
          onDurationChange={setSelectedDuration}
          userTimezone={userTimezone}
          onTimezoneChange={setUserTimezone}
          timezoneLocked={isTimezoneLocked}
          organizerName={organizerName}
          organizerAvatar={organizerAvatar}
        />

        {/* Calendar Grid */}
        <CalendarGrid
          currentDate={currentDate}
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
          loading={isLoading}
          isReloading={isReloading}
          timeFormat={timeFormat}
          onTimeFormatChange={setTimeFormat}
          onSlotSelect={onSlotSelect}
        />
      </div>
    </div>
  );
};
