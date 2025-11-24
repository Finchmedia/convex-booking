"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSlotHold } from "@/lib/hooks/use-slot-hold";
import { Calendar } from "@/components/booking-calendar/calendar";
import { BookingForm } from "@/components/booking-form/booking-form";
import { BookingSuccess } from "@/components/booking-form/booking-success";
import type { BookingStep, BookingFormData, Booking } from "@/types/booking";

// Temporary mock event type - in future fetch from DB
const MOCK_EVENT_TYPE = {
  id: "studio-30min",
  slug: "studio-30min",
  title: "Studio Session",
  lengthInMinutes: 30,
  lengthInMinutesOptions: [30, 60, 90, 120],
  description: "Book a recording session at Studio A. Includes engineer and basic mixing.",
  locations: [{ type: "address", address: "123 Studio St, Berlin, Germany", public: true }],
  timezone: "Europe/Berlin",
  lockTimeZoneToggle: false,
};

export default function Home() {
  // Step state
  const [bookingStep, setBookingStep] = useState<BookingStep>("event-meta");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Mutation
  const createBooking = useMutation(api.booking.createBooking);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real event type from DB
  const eventTypeData = useQuery(api.booking.getEventType, { eventTypeId: "studio-30min" });
  
  // Fallback to mock if loading or error (for MVP robustness)
  const eventType = eventTypeData || MOCK_EVENT_TYPE;

  // Real-time Hold: Automatically reserve the slot when selected
  useSlotHold(selectedSlot);

  // Step 1: Calendar slot selection
  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
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
        eventTypeId: "studio-30min",
        resourceId: "studio-a", // Hardcoded for MVP
        start,
        end,
        timezone,
        booker: formData,
        location: { type: "address", value: eventType.locations[0]?.address || "Studio A" },
      });

      // Cast the result to Booking type (Convex returns plain object, our type matches schema)
      setCompletedBooking(booking as unknown as Booking);
      setBookingStep("success");
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-5xl w-full">
        {bookingStep === "event-meta" && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-neutral-100 mb-4">
              Convex Booking System
            </h1>
            <p className="text-neutral-400">
              Beautiful booking calendar powered by Convex
            </p>
          </div>
        )}

        {bookingStep === "event-meta" && (
          <Calendar
            resourceId="studio-a"
            eventTypeId="studio-30min"
            onSlotSelect={handleSlotSelect}
            title="Book a Studio Session"
            organizerName="Daniel Finke"
            defaultDuration={selectedDuration}
            onDurationChange={setSelectedDuration}
            defaultTimezone={timezone}
            onTimezoneChange={setTimezone}
          />
        )}

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

        {bookingStep === "success" && completedBooking && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
            <BookingSuccess
              booking={completedBooking}
              eventType={displayedEventType}
              onBookAnother={handleBookAnother}
            />
          </div>
        )}
      </div>
    </div>
  );
}
