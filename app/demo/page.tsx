"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CalendarDays, Clock, Users } from "lucide-react";
import Link from "next/link";

export default function DemoDashboard() {
  const eventTypes = useQuery(api.booking.listEventTypes, {});
  const bookings = useQuery(api.booking.listBookings, { limit: 10 });

  const stats = [
    {
      title: "Event Types",
      value: eventTypes?.length ?? 0,
      icon: Calendar,
      href: "/demo/event-types",
      description: "Active event types",
    },
    {
      title: "Total Bookings",
      value: bookings?.length ?? 0,
      icon: CalendarDays,
      href: "/demo/bookings",
      description: "Recent bookings",
    },
    {
      title: "Upcoming",
      value: bookings?.filter((b) => b.start > Date.now() && b.status === "confirmed").length ?? 0,
      icon: Clock,
      href: "/demo/bookings?status=confirmed",
      description: "Confirmed upcoming",
    },
    {
      title: "Pending",
      value: bookings?.filter((b) => b.status === "pending").length ?? 0,
      icon: Users,
      href: "/demo/bookings?status=pending",
      description: "Awaiting confirmation",
    },
  ];

  const recentBookings = bookings?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Convex Booking admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {eventTypes === undefined || bookings === undefined ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest bookings across all event types</CardDescription>
          </CardHeader>
          <CardContent>
            {bookings === undefined ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No bookings yet. Create an event type and make your first booking!
              </p>
            ) : (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <div
                    key={booking._id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{booking.bookerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.eventTitle} • {booking.bookerEmail}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge
                        variant={
                          booking.status === "confirmed"
                            ? "default"
                            : booking.status === "pending"
                            ? "secondary"
                            : booking.status === "cancelled"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {booking.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(booking.start).toLocaleDateString()} at{" "}
                        {new Date(booking.start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/demo/event-types/new">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg">Create Event Type</CardTitle>
              <CardDescription>
                Set up a new booking type with custom duration and settings
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/demo/schedules">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg">Manage Schedules</CardTitle>
              <CardDescription>
                Configure availability hours and date overrides
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg">View Booker</CardTitle>
              <CardDescription>
                See the public booking interface that your customers use
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
