import React from "react";
import { Calendar, CheckCircle, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Booking } from "@/types/booking";
import { formatDateTime, formatDuration } from "@/lib/booking/utils/formatting";

interface EventType {
  title: string;
  description?: string;
  lengthInMinutes: number;
  // Add other fields as needed for display
}

interface BookingSuccessProps {
  booking: Booking;
  eventType: EventType;
  onBookAnother: () => void;
}

export const BookingSuccess: React.FC<BookingSuccessProps> = ({
  booking,
  eventType,
  onBookAnother,
}) => {
  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Success Icon */}
      <div className="flex justify-center mb-6">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-100 mb-2">
          You're booked!
        </h1>
        <p className="text-neutral-400">
          A confirmation email has been sent to {booking.bookerEmail}
        </p>
      </div>

      {/* Booking Details Card */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-neutral-400 mt-0.5" />
          <div>
            <p className="font-medium text-neutral-100">{eventType.title}</p>
            <p className="text-sm text-neutral-400 mt-1">
              {formatDateTime(booking.start, booking.timezone)}
            </p>
            <p className="text-sm text-neutral-400">
              {formatDuration(booking.end - booking.start)} duration
            </p>
          </div>
        </div>

        {booking.location.value && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-neutral-400 mt-0.5" />
            <p className="text-sm text-neutral-300">{booking.location.value}</p>
          </div>
        )}

        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-neutral-400 mt-0.5" />
          <p className="text-sm text-neutral-300">{booking.bookerName}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 font-medium"
          onClick={onBookAnother}
        >
          Book Another
        </Button>
        {/* Future: Add to Calendar, Reschedule, Cancel buttons */}
      </div>
    </div>
  );
};

