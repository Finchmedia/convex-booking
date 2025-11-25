"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { X, Plus, Loader2, Users } from "lucide-react";

// Zod Schema
const locationSchema = z.object({
  type: z.string(),
  address: z.string().optional(),
  public: z.boolean().optional(),
});

const eventTypeFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  durations: z.array(z.number()).min(1, "At least one duration is required"),
  slotInterval: z.number(),
  timezone: z.string(),
  lockTimezone: z.boolean(),
  locations: z.array(locationSchema).min(1),
  bufferBefore: z.number(),
  bufferAfter: z.number(),
  minNotice: z.number(),
  maxFuture: z.number(),
  requiresConfirmation: z.boolean(),
  isActive: z.boolean(),
  resourceIds: z.array(z.string()),
});

type EventTypeFormData = z.infer<typeof eventTypeFormSchema>;

interface Resource {
  _id: string;
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
  isStandalone?: boolean;
}

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
  availableResources: Resource[];
  initialResourceIds?: string[];
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300];
const LOCATION_TYPES = [
  { value: "in_person", label: "In Person" },
  { value: "video", label: "Video Call" },
  { value: "phone", label: "Phone Call" },
  { value: "address", label: "Address" },
];

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

// Isolated component to prevent watch subscription thrashing inside map
function LocationField({
  index,
  control,
  onRemove,
  canRemove
}: {
  index: number;
  control: any;
  onRemove: () => void;
  canRemove: boolean;
}) {
  // useWatch inside component = isolated subscription (no thrashing)
  const locationType = useWatch({ control, name: `locations.${index}.type` });

  return (
    <div className="flex gap-3 items-start">
      <Controller
        name={`locations.${index}.type`}
        control={control}
        render={({ field: typeField }) => (
          <Select value={typeField.value} onValueChange={typeField.onChange}>
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
        )}
      />
      {locationType === "address" && (
        <Controller
          name={`locations.${index}.address`}
          control={control}
          render={({ field: addressField }) => (
            <Input
              {...addressField}
              placeholder="Enter address..."
              className="flex-1"
            />
          )}
        />
      )}
      {canRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

const generateSlug = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

export function EventTypeForm({ eventType, availableResources, initialResourceIds }: EventTypeFormProps) {
  const router = useRouter();
  const createEventType = useMutation(api.booking.createEventType);
  const updateEventType = useMutation(api.booking.updateEventType);
  const setResourcesForEventType = useMutation(api.booking.setResourcesForEventType);

  // Memoize default values to prevent re-renders
  const defaultValues = useMemo<EventTypeFormData>(() => ({
    title: eventType?.title ?? "",
    slug: eventType?.slug ?? "",
    description: eventType?.description ?? "",
    durations: eventType?.lengthInMinutesOptions ?? [eventType?.lengthInMinutes ?? 30],
    slotInterval: eventType?.slotInterval ?? 15,
    timezone: eventType?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    lockTimezone: eventType?.lockTimeZoneToggle ?? false,
    locations: eventType?.locations ?? [{ type: "in_person" }],
    bufferBefore: eventType?.bufferBefore ?? 0,
    bufferAfter: eventType?.bufferAfter ?? 15,
    minNotice: eventType?.minNoticeMinutes ?? 60,
    maxFuture: eventType?.maxFutureMinutes ?? 60 * 24 * 60,
    requiresConfirmation: eventType?.requiresConfirmation ?? false,
    isActive: eventType?.isActive ?? true,
    resourceIds: initialResourceIds ?? [],
  }), [eventType, initialResourceIds]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventTypeFormData>({
    resolver: zodResolver(eventTypeFormSchema),
    defaultValues,
  });

  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({
    control,
    name: "locations",
  });

  // Use useWatch instead of watch for isolated re-renders
  const durations = useWatch({ control, name: "durations" }) ?? [];
  const resourceIds = useWatch({ control, name: "resourceIds" }) ?? [];

  // Auto-generate slug from title (only for new event types)
  const handleTitleChange = (value: string, onChange: (value: string) => void) => {
    onChange(value);
    if (!eventType) {
      setValue("slug", generateSlug(value));
    }
  };

  const addDuration = (duration: number) => {
    if (!durations.includes(duration)) {
      setValue("durations", [...durations, duration].sort((a, b) => a - b));
    }
  };

  const removeDuration = (duration: number) => {
    if (durations.length > 1) {
      setValue("durations", durations.filter((d) => d !== duration));
    }
  };

  const toggleResource = useCallback((resourceId: string) => {
    const newIds = resourceIds.includes(resourceId)
      ? resourceIds.filter((id) => id !== resourceId)
      : [...resourceIds, resourceId];
    setValue("resourceIds", newIds);
  }, [resourceIds, setValue]);

  const onSubmit = async (data: EventTypeFormData) => {
    try {
      let eventTypeId: string;

      const payload = {
        title: data.title,
        slug: data.slug,
        description: data.description || undefined,
        lengthInMinutes: data.durations[0],
        lengthInMinutesOptions: data.durations.length > 1 ? data.durations : undefined,
        slotInterval: data.slotInterval,
        timezone: data.timezone,
        lockTimeZoneToggle: data.lockTimezone,
        locations: data.locations,
        bufferBefore: data.bufferBefore,
        bufferAfter: data.bufferAfter,
        minNoticeMinutes: data.minNotice,
        maxFutureMinutes: data.maxFuture,
        requiresConfirmation: data.requiresConfirmation,
        isActive: data.isActive,
      };

      if (eventType) {
        await updateEventType({ id: eventType.id, ...payload });
        eventTypeId = eventType.id;
        toast.success("Event type updated");
      } else {
        eventTypeId = `et_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await createEventType({ id: eventTypeId, ...payload });
        toast.success("Event type created");
      }

      // Save resource links
      await setResourcesForEventType({
        eventTypeId,
        resourceIds: data.resourceIds,
      });

      router.push("/demo/event-types");
    } catch (error: any) {
      toast.error(error.message || "Failed to save event type");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
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
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <Input
                  id="title"
                  {...field}
                  onChange={(e) => handleTitleChange(e.target.value, field.onChange)}
                  placeholder="e.g., 30 Minute Meeting"
                />
              )}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <Controller
                name="slug"
                control={control}
                render={({ field }) => (
                  <Input
                    id="slug"
                    {...field}
                    onChange={(e) => field.onChange(generateSlug(e.target.value))}
                    placeholder="30-minute-meeting"
                  />
                )}
              />
            </div>
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="description"
                  {...field}
                  placeholder="Describe what this event is about..."
                  rows={3}
                />
              )}
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
                <Badge key={duration} variant="secondary" className="px-3 py-1">
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
            <Select onValueChange={(v) => addDuration(Number(v))} value="">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Add duration..." />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.filter((d) => !durations.includes(d)).map((duration) => (
                  <SelectItem key={duration} value={duration.toString()}>
                    {formatDuration(duration)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slotInterval">Slot Interval</Label>
            <Controller
              name="slotInterval"
              control={control}
              render={({ field }) => (
                <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
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
              )}
            />
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
          <CardDescription>Where will this event take place?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {locationFields.map((field, index) => (
            <LocationField
              key={field.id}
              index={index}
              control={control}
              onRemove={() => removeLocation(index)}
              canRemove={locationFields.length > 1}
            />
          ))}
          <Button type="button" variant="outline" onClick={() => appendLocation({ type: "in_person" })}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </CardContent>
      </Card>

      {/* Resource Linking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Linked Resources
          </CardTitle>
          <CardDescription>
            Select which resources this event type can be booked with.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableResources.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">No resources available</p>
              <Button type="button" variant="outline" size="sm" onClick={() => router.push("/demo/resources")}>
                Create Resources
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {availableResources.map((resource) => (
                <label
                  key={resource._id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resourceIds.includes(resource.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={resourceIds.includes(resource.id)}
                    onCheckedChange={() => toggleResource(resource.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{resource.name}</span>
                      <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                      {!resource.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      {resource.isStandalone === false && <Badge variant="secondary" className="text-xs">Add-on only</Badge>}
                    </div>
                    {resource.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{resource.description}</p>
                    )}
                  </div>
                </label>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                {resourceIds.length} resource{resourceIds.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buffers & Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Buffers & Limits</CardTitle>
          <CardDescription>Set up buffer time and booking restrictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buffer Before</Label>
              <Controller
                name="bufferBefore"
                control={control}
                render={({ field }) => (
                  <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
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
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Buffer After</Label>
              <Controller
                name="bufferAfter"
                control={control}
                render={({ field }) => (
                  <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
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
                )}
              />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum Notice</Label>
              <Controller
                name="minNotice"
                control={control}
                render={({ field }) => (
                  <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
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
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Book Up To</Label>
              <Controller
                name="maxFuture"
                control={control}
                render={({ field }) => (
                  <Select value={field.value.toString()} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[7, 14, 30, 60, 90, 180, 365].map((days) => (
                        <SelectItem key={days} value={(days * 24 * 60).toString()}>
                          {days} days in advance
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
            <Controller
              name="requiresConfirmation"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
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
            <Controller
              name="lockTimezone"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-sm text-muted-foreground">
                Deactivated event types cannot be booked
              </p>
            </div>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/demo/event-types")}>
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
