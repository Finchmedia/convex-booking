"use client";

import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, Calendar, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Booker, BookingProvider, type Booking } from "@mrfinch/booking/react";

/**
 * Only pending/confirmed bookings can be rescheduled. This guard is the one
 * runtime check the page makes before it renders the Booker; the gateway's
 * rescheduleBookingByToken enforces the same rule.
 */
const RESCHEDULABLE_STATUSES = ["pending", "confirmed"] as const;
type ReschedulableStatus = (typeof RESCHEDULABLE_STATUSES)[number];

function isReschedulable<T extends { status: string }>(
  booking: T
): booking is T & { status: ReschedulableStatus } {
  return (RESCHEDULABLE_STATUSES as readonly string[]).includes(booking.status);
}

export default function RescheduleBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = params.uid as string;
  // Trimmed like the gateway's token check. The Booker sends this token as
  // rescheduleContext, which the component compares exactly: with trailing
  // whitespace (a %0A added by a mail client) the page would load, but the
  // calendar would not free this booking's own slots.
  const token = (searchParams.get('token') || "").trim();

  const booking = useQuery(
    api.public.getBookingByToken,
    token ? { uid, token } : "skip"
  );

  const formatDateTime = (timestamp: number, timezone: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
        timeZoneName: "short",
      }),
    };
  };

  const getDuration = (start: number, end: number) => {
    const minutes = Math.round((end - start) / 60000);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  // Loading state
  if (token && booking === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="container max-w-5xl mx-auto py-8">
          <Skeleton className="h-8 w-48 bg-muted mb-8" />
          <Skeleton className="h-96 w-full bg-muted" />
        </div>
      </div>
    );
  }

  // Error state - booking not found or invalid token
  if (!booking || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Booking Not Found
          </h1>
          <p className="text-muted-foreground mb-8">
            {!token ? "Invalid or missing access token." : "The booking you're looking for doesn't exist or the link is invalid."}
          </p>
          <Link href="/book">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Booking
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if booking can be rescheduled
  if (!isReschedulable(booking)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Cannot Reschedule Booking</h1>
          <p className="text-muted-foreground mb-8">
            This booking has already been {booking.status}. Only pending or confirmed bookings can be rescheduled.
          </p>
          <Link href={`/book/booking/${uid}?token=${encodeURIComponent(token)}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Booking Details
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { date, time } = formatDateTime(booking.start, booking.timezone);

  // Create the Booking object with managementToken for reschedule
  const originalBooking: Booking = {
    ...booking,
    managementToken: token, // Use the token from URL for auth
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container max-w-5xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/book/booking/${uid}?token=${encodeURIComponent(token)}`}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Booking Details
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Reschedule Booking</h1>
          <p className="text-muted-foreground">Select a new time for your booking</p>
        </div>

        {/* Original Booking Info */}
        <Card className="bg-card/50 border-border mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Current Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{booking.eventTitle}</p>
                <p className="text-sm text-muted-foreground">{date} at {time}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Duration</p>
                <p className="text-sm text-muted-foreground">{getDuration(booking.start, booking.end)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booker Component in Reschedule Mode. It shows a failed move itself.
            availabilityContext makes the Calendar send eventTypeId and the
            booker's rescheduleContext ({ uid, token }) to getMonthAvailability
            and getDaySlots, so times that overlap this booking are offered.
            Both gateway queries declare the two arguments. `convex deploy
            --cmd` (vercel.json) builds first and pushes the functions after,
            and Vercel serves the page only once that whole step succeeds, so
            the validators are live before this page is. */}
        <BookingProvider publicApi={api.public} availabilityContext>
          <Booker
            eventTypeId={booking.eventTypeId}
            resourceId={booking.resourceId}
            showHeader={false}
            originalBooking={originalBooking}
            reuseBookerInfo={false}
            onBookingComplete={(newBooking) => {
              // Redirect back to view page after reschedule
              // Use the NEW booking's uid (reschedule creates a new booking)
              router.push(`/book/booking/${newBooking.uid}?token=${encodeURIComponent(token)}`);
            }}
          />
        </BookingProvider>
      </div>
    </div>
  );
}
