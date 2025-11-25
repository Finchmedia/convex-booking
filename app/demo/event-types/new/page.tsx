"use client";

import { EventTypeForm } from "../_components/event-type-form";

export default function NewEventTypePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Event Type</h1>
        <p className="text-muted-foreground">
          Set up a new booking type with custom duration and settings
        </p>
      </div>
      <EventTypeForm />
    </div>
  );
}
