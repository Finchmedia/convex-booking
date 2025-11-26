"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EventTypeForm } from "../_components/event-type-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";

const DEMO_ORG_ID = "demo-org";

export default function EditEventTypePage() {
  const params = useParams();
  const eventTypeId = params.id as string;

  const eventType = useQuery(api.booking.getEventType, {
    eventTypeId,
  });

  // Fetch all resources for the form
  const allResources = useQuery(api.booking.listResources, {
    organizationId: DEMO_ORG_ID,
    activeOnly: false,
  });

  // Fetch linked resource IDs for this event type
  const linkedResourceIds = useQuery(api.booking.getResourceIdsForEventType, {
    eventTypeId,
  });

  // Wait for ALL data before rendering form
  if (eventType === undefined || !allResources || linkedResourceIds === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64 mt-2" />
        </div>
        <div className="space-y-6 max-w-2xl">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!eventType) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Event Type Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The event type you are looking for does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Event Type</h1>
        <p className="text-muted-foreground">
          Update settings for {eventType.title}
        </p>
      </div>
      <EventTypeForm
        eventType={{
          id: eventType.id,
          slug: eventType.slug,
          title: eventType.title,
          description: eventType.description,
          lengthInMinutes: eventType.lengthInMinutes,
          lengthInMinutesOptions: eventType.lengthInMinutesOptions,
          slotInterval: eventType.slotInterval,
          timezone: eventType.timezone,
          lockTimeZoneToggle: eventType.lockTimeZoneToggle,
          locations: eventType.locations,
          bufferBefore: eventType.bufferBefore,
          bufferAfter: eventType.bufferAfter,
          minNoticeMinutes: eventType.minNoticeMinutes,
          maxFutureMinutes: eventType.maxFutureMinutes,
          requiresConfirmation: eventType.requiresConfirmation,
          isActive: eventType.isActive,
        }}
        availableResources={allResources}
        initialResourceIds={linkedResourceIds}
      />
    </div>
  );
}
