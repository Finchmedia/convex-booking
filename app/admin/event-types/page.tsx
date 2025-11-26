"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Trash } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function EventTypesPage() {
  const eventTypes = useQuery(api.booking.listEventTypes, {});
  const toggleActive = useMutation(api.booking.toggleEventTypeActive);
  const deleteEventType = useMutation(api.booking.deleteEventType);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await toggleActive({ id, isActive });
      toast.success(isActive ? "Event type activated" : "Event type deactivated");
    } catch (error) {
      toast.error("Failed to update event type");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event type?")) return;
    try {
      await deleteEventType({ id });
      toast.success("Event type deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete event type");
    }
  };

  const copyBookingLink = (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Booking link copied to clipboard");
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">
            Manage your booking types and their settings
          </p>
        </div>
        <Link href="/admin/event-types/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Event Type
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Event Types</CardTitle>
          <CardDescription>
            Configure duration, location, and availability for each event type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventTypes === undefined ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No event types</h3>
              <p className="text-muted-foreground">
                Get started by creating your first event type
              </p>
              <Link href="/admin/event-types/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event Type
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Event Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventTypes.map((eventType) => (
                  <TableRow key={eventType._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-1 rounded-full bg-primary" />
                        <div>
                          <p className="font-medium">{eventType.title}</p>
                          <p className="text-sm text-muted-foreground">
                            /{eventType.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {eventType.lengthInMinutesOptions?.length ? (
                          eventType.lengthInMinutesOptions.map((duration) => (
                            <Badge key={duration} variant="outline">
                              {formatDuration(duration)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">
                            {formatDuration(eventType.lengthInMinutes)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {eventType.locations?.length > 0 ? (
                        <Badge variant="secondary">
                          {eventType.locations[0].type}
                          {eventType.locations.length > 1 &&
                            ` +${eventType.locations.length - 1}`}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={eventType.isActive !== false}
                          onCheckedChange={(checked) =>
                            handleToggleActive(eventType.id, checked)
                          }
                        />
                        <span className="text-sm">
                          {eventType.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/event-types/${eventType.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyBookingLink(eventType.slug)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/${eventType.slug}`} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Preview
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(eventType.id)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
