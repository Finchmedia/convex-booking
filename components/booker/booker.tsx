"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSlotHold } from "@/lib/hooks/use-slot-hold";
import { Calendar } from "@/components/booking-calendar/calendar";
import { BookingForm } from "@/components/booking-form/booking-form";
import { BookingSuccess } from "@/components/booking-form/booking-success";
import type { BookingStep, BookingFormData, Booking } from "@/types/booking";

// Default mock event type for development/seeding
const DEFAULT_MOCK_EVENT_TYPE = {
  id: "studio-session",
  slug: "studio-session",
  title: "Studio Session",
  lengthInMinutes: 60,
  lengthInMinutesOptions: [60, 120, 300], // 1h, 2h, 5h
  slotInterval: 60, // Hourly slots (will default to Math.min(lengthInMinutesOptions) = 60)
  description: "Book a recording session at Studio A. Includes engineer and basic mixing.",
  locations: [{ type: "address", address: "123 Studio St, Berlin, Germany", public: true }],
  timezone: "Europe/Berlin",
  lockTimeZoneToggle: false,
};

export interface BookerProps {
  /** Event type ID to book */
  eventTypeId: string;
  /** Resource ID to book (e.g., "studio-a") */
  resourceId: string;
  /** Optional header title */
  title?: string;
  /** Optional header description */
  description?: string;
  /** Show/hide header section (default: true) */
  showHeader?: boolean;
  /** Organizer display name */
  organizerName?: string;
  /** Organizer avatar URL */
  organizerAvatar?: string;
  /** Show dev tools seed button (default: false) */
  showDevTools?: boolean;
  /** Mock event type for seeding (default: provided) */
  mockEventType?: any;
  /** Callback when booking is successfully created */
  onBookingComplete?: (booking: Booking) => void;
}

export function Booker({
  eventTypeId,
  resourceId,
  title,
  description,
  showHeader = true,
  organizerName,
  organizerAvatar,
  showDevTools = false,
  mockEventType = DEFAULT_MOCK_EVENT_TYPE,
  onBookingComplete,
}: BookerProps) {
  // Step state
  const [bookingStep, setBookingStep] = useState<BookingStep>("event-meta");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Calendar state (persists across navigation)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");

  // Mutations
  const createBooking = useMutation(api.booking.createBooking);
  const createEventType = useMutation(api.booking.createEventType); // For seeding
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real event type from DB
  const eventTypeData = useQuery(api.booking.getEventType, { eventTypeId });

  // Fallback to mock if loading or error (for MVP robustness)
  const eventType = eventTypeData || mockEventType;

  // Calculate effective slot interval (smart defaulting - same logic as useConvexSlots)
  const slotInterval = eventType.slotInterval ?? (
    eventType.lengthInMinutesOptions && eventType.lengthInMinutesOptions.length > 0
      ? Math.min(...eventType.lengthInMinutesOptions, eventType.lengthInMinutes)
      : eventType.lengthInMinutes
  );

  // Seeder function (dev tools)
  const handleSeed = async () => {
    if (confirm("Reset/Seed Event Type data?")) {
      await createEventType(mockEventType);
      alert("System seeded! Refreshing...");
      window.location.reload();
    }
  };

  // Real-time Hold: Automatically reserve all affected slots (quantum coverage)
  useSlotHold(resourceId, selectedSlot, selectedDuration);

  // Step 1: Calendar slot selection (captures BOTH slot AND duration atomically)
  const handleSlotSelect = (data: { slot: string; duration: number }) => {
    setSelectedSlot(data.slot);
    setSelectedDuration(data.duration); // LOCK the duration at slot selection
    setBookingStep("booking-form");
  };

  // Step 2: Form submission
  const handleFormSubmit = async (formData: BookingFormData) => {
    if (!selectedSlot) return;

    setIsSubmitting(true);

    try {
      const start = new Date(selectedSlot).getTime();
      const end = start + selectedDuration * 60 * 1000;

      const booking = await createBooking({
        eventTypeId: eventType.id,
        resourceId,
        start,
        end,
        timezone,
        booker: formData,
        location: { type: "address", value: eventType.locations[0]?.address || "Studio A" },
      });

      // Cast the result to Booking type (Convex returns plain object, our type matches schema)
      const completedBookingData = booking as unknown as Booking;
      setCompletedBooking(completedBookingData);
      setBookingStep("success");

      // Trigger callback if provided
      onBookingComplete?.(completedBookingData);
    } catch (error) {
      console.error("Booking failed:", error);
      alert("Booking failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Back to calendar
  const handleBack = () => {
    setBookingStep("event-meta");
    setSelectedSlot(null); // Release the hold
  };

  // Reset flow
  const handleBookAnother = () => {
    setBookingStep("event-meta");
    setSelectedSlot(null);
    setCompletedBooking(null);
  };

  // Memoize event type with selected duration for display
  const displayedEventType = useMemo(() => ({
    ...eventType,
    lengthInMinutes: selectedDuration, // Override base length with user selection
  }), [eventType, selectedDuration]);

  return (
    <>
      {/* Optional Header */}
      {showHeader && bookingStep === "event-meta" && (title || description) && (
        <div className="text-center mb-8">
          {title && (
            <h1 className="text-4xl font-bold text-neutral-100 mb-4">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-neutral-400">{description}</p>
          )}
        </div>
      )}

      {/* Step 1: Calendar View */}
      {bookingStep === "event-meta" && (
        <Calendar
          resourceId={resourceId}
          eventTypeId={eventType.id}
          onSlotSelect={handleSlotSelect}
          title={eventType.title}
          organizerName={organizerName}
          organizerAvatar={organizerAvatar}
          // Controlled state (persists across navigation)
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          selectedDuration={selectedDuration}
          onDurationChange={setSelectedDuration}
          timezone={timezone}
          onTimezoneChange={setTimezone}
          timeFormat={timeFormat}
          onTimeFormatChange={setTimeFormat}
        />
      )}

      {/* Step 2: Booking Form */}
      {bookingStep === "booking-form" && selectedSlot && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <BookingForm
            eventType={displayedEventType}
            selectedSlot={selectedSlot}
            selectedDuration={selectedDuration}
            timezone={timezone}
            onSubmit={handleFormSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Step 3: Success Screen */}
      {bookingStep === "success" && completedBooking && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
          <BookingSuccess
            booking={completedBooking}
            eventType={displayedEventType}
            onBookAnother={handleBookAnother}
          />
        </div>
      )}

      {/* Dev Tools */}
      {showDevTools && (
        <div className="fixed bottom-4 right-4 opacity-20 hover:opacity-100 transition-opacity">
          <button
            onClick={handleSeed}
            className="bg-red-900/50 text-red-200 text-xs px-2 py-1 rounded hover:bg-red-900"
          >
            Seed System
          </button>
        </div>
      )}
    </>
  );
}
