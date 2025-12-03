"use client";

import { useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Booking } from "@mrfinch/booking/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarDays, Check, X, Clock, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Bookings" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const bookings = useQuery(api.admin.listBookings, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const transitionState = useMutation(api.admin.transitionBookingState);
  const cancelBooking = useMutation(api.admin.cancelReservation);

  const handleConfirm = async (bookingId: string) => {
    try {
      await transitionState({
        bookingId,
        toStatus: "confirmed",
      });
      toast.success("Booking confirmed");
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm booking");
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBooking({ reservationId: bookingId });
      toast.success("Booking cancelled");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking");
    }
  };

  const handleComplete = async (bookingId: string) => {
    try {
      await transitionState({
        bookingId,
        toStatus: "completed",
      });
      toast.success("Booking marked as completed");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete booking");
    }
  };

  const openDetail = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      pending: "secondary",
      cancelled: "destructive",
      completed: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const getDuration = (start: number, end: number) => {
    const minutes = Math.round((end - start) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">
            Manage all your bookings and appointments
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>
            View and manage bookings across all event types
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings === undefined ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No bookings</h3>
              <p className="text-muted-foreground">
                {statusFilter === "all"
                  ? "No bookings have been made yet."
                  : `No ${statusFilter} bookings found.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking: Booking) => {
                  const { date, time } = formatDateTime(booking.start);
                  const isPast = booking.start < Date.now();
                  return (
                    <TableRow
                      key={booking._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(booking)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.bookerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.bookerEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{booking.eventTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.resourceId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={isPast ? "text-muted-foreground" : ""}>
                          {date}
                        </p>
                        <p className="text-sm text-muted-foreground">{time}</p>
                      </TableCell>
                      <TableCell>
                        {getDuration(booking.start, booking.end)}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {booking.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirm(booking._id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel(booking._id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {booking.status === "confirmed" && !isPast && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(booking._id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                          {booking.status === "confirmed" && isPast && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleComplete(booking._id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Booking Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBooking.eventTitle}</DialogTitle>
                <DialogDescription>
                  Booking ID: {selectedBooking.uid}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedBooking.bookerName}</p>
                    <p className="text-sm text-muted-foreground">Guest</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedBooking.bookerEmail}</p>
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                </div>
                {selectedBooking.bookerPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedBooking.bookerPhone}</p>
                      <p className="text-sm text-muted-foreground">Phone</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {formatDateTime(selectedBooking.start).date} at{" "}
                      {formatDateTime(selectedBooking.start).time}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Duration: {getDuration(selectedBooking.start, selectedBooking.end)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedBooking.timezone}</p>
                    <p className="text-sm text-muted-foreground">Timezone</p>
                  </div>
                </div>
                {selectedBooking.bookerNotes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBooking.bookerNotes}
                    </p>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Status</p>
                  {getStatusBadge(selectedBooking.status)}
                </div>
              </div>
              <DialogFooter>
                {selectedBooking.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleCancel(selectedBooking._id);
                        setShowDetailModal(false);
                      }}
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={() => {
                        handleConfirm(selectedBooking._id);
                        setShowDetailModal(false);
                      }}
                    >
                      Confirm
                    </Button>
                  </>
                )}
                {selectedBooking.status === "confirmed" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleCancel(selectedBooking._id);
                      setShowDetailModal(false);
                    }}
                  >
                    Cancel Booking
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
