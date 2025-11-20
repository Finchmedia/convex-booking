"use client";

import { Calendar } from "@/components/booking-calendar/calendar";

export default function Home() {
  const handleSlotSelect = (slot: string) => {
    alert(`Selected time slot: ${new Date(slot).toLocaleString()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neutral-100 mb-4">
            Convex Booking System
          </h1>
          <p className="text-neutral-400">
            Beautiful booking calendar powered by Convex
          </p>
        </div>

        <Calendar
          resourceId="studio-a"
          eventLength={30}
          onSlotSelect={handleSlotSelect}
          title="Book a Studio Session"
          description="Choose a time that works best for you. We'll send you a confirmation email with meeting details."
          showHeader={true}
        />
      </div>
    </div>
  );
}
