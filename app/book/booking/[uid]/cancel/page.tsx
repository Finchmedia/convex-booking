"use client";

import { useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

export default function CancelBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = params.uid as string;
  const token = searchParams.get('token') || "";

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const booking = useQuery(
    api.public.getBookingByToken,
    token ? { uid, token } : "skip"
  );

  const cancelBooking = useMutation(api.public.cancelBookingByToken);

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

  const handleCancel = async () => {
    if (!token) {
      toast.error("Invalid token");
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelBooking({
        uid,
        token,
        reason: reason.trim() || undefined,
      });

      toast.success("Booking cancelled successfully");

      // Redirect back to view page with token
      router.push(`/book/booking/${uid}?token=${encodeURIComponent(token)}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking");
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (booking === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="container max-w-2xl mx-auto py-8">
          <Skeleton className="h-8 w-48 bg-muted mb-8" />
          <Skeleton className="h-96 w-full bg-muted" />
        </div>
      </div>
    );
  }

  // Error state - booking not found or invalid token
  if (booking === null || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Booking Not Found</h1>
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

  // Check if booking can be cancelled
  if (["cancelled", "completed", "declined"].includes(booking.status)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Cannot Cancel Booking</h1>
          <p className="text-muted-foreground mb-8">
            This booking has already been {booking.status}. Only pending or confirmed bookings can be cancelled.
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container max-w-2xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/book/booking/${uid}?token=${encodeURIComponent(token)}`}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Booking Details
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Cancel Booking</h1>
          <p className="text-muted-foreground">Are you sure you want to cancel this booking?</p>
        </div>

        {/* Warning Card */}
        <Card className="bg-destructive/10 border-destructive/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">This action cannot be undone</p>
                <p className="text-sm text-muted-foreground">
                  Once cancelled, you'll need to create a new booking if you change your mind.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Summary Card */}
        <Card className="bg-card/50 border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground">{booking.eventTitle}</CardTitle>
            <CardDescription className="text-muted-foreground">
              Booking ID: {booking.uid}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{date}</p>
                <p className="text-sm text-muted-foreground">{time}</p>
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

        {/* Cancellation Reason Form */}
        <Card className="bg-card/50 border-border mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Cancellation Reason (Optional)</CardTitle>
            <CardDescription>
              Let us know why you're cancelling. This helps us improve our service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for cancellation</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Found another time slot, Plans changed, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/book/booking/${uid}?token=${encodeURIComponent(token)}`}
            className="flex-1"
          >
            <Button variant="outline" className="w-full" disabled={isSubmitting}>
              Go Back
            </Button>
          </Link>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
