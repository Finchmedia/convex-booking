"use client";

import { Booker } from "@/components/booker";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="max-w-5xl w-full">
        <Booker
          eventTypeId="studio-session"
          resourceId="studio-a"
          title="Convex Booking System"
          description="Beautiful booking calendar powered by Convex"
          organizerName="Daniel Finke"
          showDevTools={true}
          onBookingComplete={(booking) => {
            console.log("Booking created:", booking);
          }}
        />
      </div>
    </div>
  );
}
