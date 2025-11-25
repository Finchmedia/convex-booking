"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { X, Plus, Loader2 } from "lucide-react";

interface EventTypeFormProps {
  eventType?: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    lengthInMinutes: number;
    lengthInMinutesOptions?: number[];
    slotInterval?: number;
    timezone: string;
    lockTimeZoneToggle: boolean;
    locations: Array<{ type: string; address?: string; public?: boolean }>;
    bufferBefore?: number;
    bufferAfter?: number;
    minNoticeMinutes?: number;
    maxFutureMinutes?: number;
    requiresConfirmation?: boolean;
    isActive?: boolean;
  };
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300];
const LOCATION_TYPES = [
  { value: "in_person", label: "In Person" },
  { value: "video", label: "Video Call" },
  { value: "phone", label: "Phone Call" },
  { value: "address", label: "Address" },
];

export function EventTypeForm({ eventType }: EventTypeFormProps) {
  const router = useRouter();
  const createEventType = useMutation(api.booking.createEventType);
  const updateEventType = useMutation(api.booking.updateEventType);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(eventType?.title ?? "");
  const [slug, setSlug] = useState(eventType?.slug ?? "");
  const [description, setDescription] = useState(eventType?.description ?? "");
  const [durations, setDurations] = useState<number[]>(
    eventType?.lengthInMinutesOptions ?? [eventType?.lengthInMinutes ?? 30]
  );
  const [slotInterval, setSlotInterval] = useState(eventType?.slotInterval ?? 15);
  const [timezone, setTimezone] = useState(
    eventType?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [lockTimezone, setLockTimezone] = useState(
    eventType?.lockTimeZoneToggle ?? false
  );
  const [locations, setLocations] = useState<
    Array<{ type: string; address?: string; public?: boolean }>
  >(eventType?.locations ?? [{ type: "in_person" }]);
  const [bufferBefore, setBufferBefore] = useState(eventType?.bufferBefore ?? 0);
  const [bufferAfter, setBufferAfter] = useState(eventType?.bufferAfter ?? 15);
  const [minNotice, setMinNotice] = useState(eventType?.minNoticeMinutes ?? 60);
  const [maxFuture, setMaxFuture] = useState(
    eventType?.maxFutureMinutes ?? 60 * 24 * 60 // 60 days
  );
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    eventType?.requiresConfirmation ?? false
  );
  const [isActive, setIsActive] = useState(eventType?.isActive ?? true);

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!eventType) {
      setSlug(generateSlug(value));
    }
  };

  const addDuration = (duration: number) => {
    if (!durations.includes(duration)) {
      setDurations([...durations, duration].sort((a, b) => a - b));
    }
  };

  const removeDuration = (duration: number) => {
    if (durations.length > 1) {
      setDurations(durations.filter((d) => d !== duration));
    }
  };

  const addLocation = () => {
    setLocations([...locations, { type: "in_person" }]);
  };

  const removeLocation = (index: number) => {
    if (locations.length > 1) {
      setLocations(locations.filter((_, i) => i !== index));
    }
  };

  const updateLocation = (
    index: number,
    field: "type" | "address",
    value: string
  ) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    setLocations(updated);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error("Title and slug are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (eventType) {
        await updateEventType({
          id: eventType.id,
          title,
          slug,
          description: description || undefined,
          lengthInMinutes: durations[0],
          lengthInMinutesOptions: durations.length > 1 ? durations : undefined,
          slotInterval,
          timezone,
          lockTimeZoneToggle: lockTimezone,
          locations,
          bufferBefore,
          bufferAfter,
          minNoticeMinutes: minNotice,
          maxFutureMinutes: maxFuture,
          requiresConfirmation,
          isActive,
        });
        toast.success("Event type updated");
      } else {
        await createEventType({
          id: `et_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title,
          slug,
          description: description || undefined,
          lengthInMinutes: durations[0],
          lengthInMinutesOptions: durations.length > 1 ? durations : undefined,
          slotInterval,
          timezone,
          lockTimeZoneToggle: lockTimezone,
          locations,
          bufferBefore,
          bufferAfter,
          minNoticeMinutes: minNotice,
          maxFutureMinutes: maxFuture,
          requiresConfirmation,
          isActive,
        });
        toast.success("Event type created");
      }
      router.push("/demo/event-types");
    } catch (error: any) {
      toast.error(error.message || "Failed to save event type");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Set up the name and description of your event type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., 30 Minute Meeting"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="30-minute-meeting"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this event is about..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Duration */}
      <Card>
        <CardHeader>
          <CardTitle>Duration</CardTitle>
          <CardDescription>
            Set available duration options for this event type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Duration Options</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {durations.map((duration) => (
                <Badge
                  key={duration}
                  variant="secondary"
                  className="px-3 py-1"
                >
                  {formatDuration(duration)}
                  {durations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDuration(duration)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => addDuration(Number(v))}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Add duration..." />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.filter((d) => !durations.includes(d)).map(
                  (duration) => (
                    <SelectItem key={duration} value={duration.toString()}>
                      {formatDuration(duration)}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slotInterval">Slot Interval</Label>
            <Select
              value={slotInterval.toString()}
              onValueChange={(v) => setSlotInterval(Number(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 60].map((interval) => (
                  <SelectItem key={interval} value={interval.toString()}>
                    Every {formatDuration(interval)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How frequently slots are offered (e.g., every 15 minutes)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Where will this event take place?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {locations.map((location, index) => (
            <div key={index} className="flex gap-3 items-start">
              <Select
                value={location.type}
                onValueChange={(v) => updateLocation(index, "type", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {location.type === "address" && (
                <Input
                  value={location.address ?? ""}
                  onChange={(e) =>
                    updateLocation(index, "address", e.target.value)
                  }
                  placeholder="Enter address..."
                  className="flex-1"
                />
              )}
              {locations.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLocation(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addLocation}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </CardContent>
      </Card>

      {/* Buffers & Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Buffers & Limits</CardTitle>
          <CardDescription>
            Set up buffer time and booking restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bufferBefore">Buffer Before</Label>
              <Select
                value={bufferBefore.toString()}
                onValueChange={(v) => setBufferBefore(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 5, 10, 15, 30, 45, 60].map((mins) => (
                    <SelectItem key={mins} value={mins.toString()}>
                      {mins === 0 ? "No buffer" : `${mins} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bufferAfter">Buffer After</Label>
              <Select
                value={bufferAfter.toString()}
                onValueChange={(v) => setBufferAfter(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 5, 10, 15, 30, 45, 60].map((mins) => (
                    <SelectItem key={mins} value={mins.toString()}>
                      {mins === 0 ? "No buffer" : `${mins} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minNotice">Minimum Notice</Label>
              <Select
                value={minNotice.toString()}
                onValueChange={(v) => setMinNotice(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 30, 60, 120, 240, 480, 1440, 2880].map((mins) => (
                    <SelectItem key={mins} value={mins.toString()}>
                      {mins === 0
                        ? "No minimum"
                        : mins < 60
                        ? `${mins} minutes`
                        : mins < 1440
                        ? `${mins / 60} hours`
                        : `${mins / 1440} days`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFuture">Book Up To</Label>
              <Select
                value={maxFuture.toString()}
                onValueChange={(v) => setMaxFuture(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    7 * 24 * 60,
                    14 * 24 * 60,
                    30 * 24 * 60,
                    60 * 24 * 60,
                    90 * 24 * 60,
                    180 * 24 * 60,
                    365 * 24 * 60,
                  ].map((mins) => (
                    <SelectItem key={mins} value={mins.toString()}>
                      {mins / (24 * 60)} days in advance
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Additional configuration options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Confirmation</Label>
              <p className="text-sm text-muted-foreground">
                Bookings will be pending until you confirm them
              </p>
            </div>
            <Switch
              checked={requiresConfirmation}
              onCheckedChange={setRequiresConfirmation}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Lock Timezone</Label>
              <p className="text-sm text-muted-foreground">
                Prevent guests from changing the timezone
              </p>
            </div>
            <Switch checked={lockTimezone} onCheckedChange={setLockTimezone} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-sm text-muted-foreground">
                Deactivated event types cannot be booked
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/demo/event-types")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {eventType ? "Save Changes" : "Create Event Type"}
        </Button>
      </div>
    </form>
  );
}
