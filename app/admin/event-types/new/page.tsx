"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { EventTypeForm } from "../_components/event-type-form";
import { Skeleton } from "@/components/ui/skeleton";

const DEMO_ORG_ID = "demo-org";

export default function NewEventTypePage() {
  // Fetch all resources for the form
  const allResources = useQuery(api.booking.listResources, {
    organizationId: DEMO_ORG_ID,
    activeOnly: false,
  });

  // Wait for resources to load
  if (!allResources) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64 mt-2" />
        </div>
        <div className="space-y-6 max-w-2xl">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Event Type</h1>
        <p className="text-muted-foreground">
          Set up a new booking type with custom duration and settings
        </p>
      </div>
      <EventTypeForm availableResources={allResources} />
    </div>
  );
}
