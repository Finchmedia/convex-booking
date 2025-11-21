"use client";

import { Calendar } from "@/components/booking-calendar/calendar";

/**
 * Demo page for the booking calendar
 *
 * NOTE: Before using, create an event type in the Convex dashboard:
 *
 * Table: event_types
 * Insert a document:
 * {
 *   "id": "studio-30min",
 *   "slug": "studio-30min",
 *   "title": "30min Studio Session",
 *   "lengthInMinutes": 30,
 *   "description": "Book a 30-minute studio session",
 *   "timezone": "Europe/Berlin",
 *   "lockTimeZoneToggle": true,
 *   "locations": [
 *     {
 *       "type": "address",
 *       "address": "Studio A, Berlin",
 *       "public": true
 *     }
 *   ]
 * }
 */

export default function Home() {
  const handleSlotSelect = (slot: string) => {
    alert(`Selected time slot: ${new Date(slot).toLocaleString()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-5xl w-full -mt-[100px]">
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
          eventTypeId="studio-30min"
          onSlotSelect={handleSlotSelect}
          title="Book a Studio Session"
          description="Choose a time that works best for you. We'll send you a confirmation email with meeting details."
          showHeader={false}
          organizerName="Daniel Finke"
        />
      </div>
    </div>
  );
}
