"use client";

import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, User, Mail, Phone, MessageSquare, ArrowLeft, X, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ViewBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = params.uid as string;
  const token = searchParams.get('token') || "";

  const booking = useQuery(
    api.public.getBookingByToken,
    token ? { uid, token } : "skip"
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      confirmed: { variant: "default", label: "Confirmed" },
      pending: { variant: "secondary", label: "Pending" },
      cancelled: { variant: "destructive", label: "Cancelled" },
      completed: { variant: "outline", label: "Completed" },
      declined: { variant: "destructive", label: "Declined" },
    };

    const config_item = config[status] || { variant: "outline", label: status };
    return <Badge variant={config_item.variant}>{config_item.label}</Badge>;
  };

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

  const { date, time } = formatDateTime(booking.start, booking.timezone);
  const isPast = booking.start < Date.now();
  const canModify = !["cancelled", "completed", "declined"].includes(booking.status) && !isPast;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container max-w-2xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Booking</h1>
          <p className="text-muted-foreground">Booking ID: {booking.uid}</p>
        </div>

        {/* Main Booking Card */}
        <Card className="bg-card/50 border-border mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl text-foreground">{booking.eventTitle}</CardTitle>
                {booking.eventDescription && (
                  <CardDescription className="text-muted-foreground mt-2">
                    {booking.eventDescription}
                  </CardDescription>
                )}
              </div>
              {getStatusBadge(booking.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{date}</p>
                <p className="text-sm text-muted-foreground">{time}</p>
                <p className="text-sm text-muted-foreground">Duration: {getDuration(booking.start, booking.end)}</p>
              </div>
            </div>

            {/* Location */}
            {booking.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">
                    {booking.location.type === 'inPerson' && 'In-Person Meeting'}
                    {booking.location.type === 'phone' && 'Phone Call'}
                    {booking.location.type === 'link' && 'Video Call'}
                  </p>
                  {booking.location.value && (
                    <p className="text-sm text-muted-foreground">{booking.location.value}</p>
                  )}
                </div>
              </div>
            )}

            {/* Timezone */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Timezone</p>
                <p className="text-sm text-muted-foreground">{booking.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest Information Card */}
        <Card className="bg-card/50 border-border mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Guest Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{booking.bookerName}</p>
                <p className="text-sm text-muted-foreground">Name</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{booking.bookerEmail}</p>
                <p className="text-sm text-muted-foreground">Email</p>
              </div>
            </div>

            {booking.bookerPhone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{booking.bookerPhone}</p>
                  <p className="text-sm text-muted-foreground">Phone</p>
                </div>
              </div>
            )}

            {booking.bookerNotes && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Notes</p>
                  <p className="text-sm text-muted-foreground">{booking.bookerNotes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Info */}
        {booking.status === "cancelled" && booking.cancellationReason && (
          <Card className="bg-card/50 border-destructive/50 mb-6">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Cancellation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{booking.cancellationReason}</p>
              {booking.cancelledAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Cancelled on {new Date(booking.cancelledAt).toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {canModify && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/book/${uid}/reschedule?token=${encodeURIComponent(token)}`}
              className="flex-1"
            >
              <Button variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reschedule Booking
              </Button>
            </Link>
            <Link
              href={`/book/${uid}/cancel?token=${encodeURIComponent(token)}`}
              className="flex-1"
            >
              <Button variant="destructive" className="w-full">
                <X className="h-4 w-4 mr-2" />
                Cancel Booking
              </Button>
            </Link>
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link
            href="/book"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Booking Page
          </Link>
        </div>
      </div>
    </div>
  );
}
