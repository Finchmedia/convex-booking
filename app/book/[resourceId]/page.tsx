"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Booker } from "@/components/booker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, MapPin, ChevronRight } from "lucide-react";

// Demo organization ID - in production, this would come from URL or auth
const DEMO_ORG_ID = "demo-org";

export default function ResourceBookingPage() {
  const params = useParams();
  const resourceId = params.resourceId as string;

  // State: selected event type
  const [selectedEventType, setSelectedEventType] = useState<any>(null);

  // Fetch resource details
  const resource = useQuery(api.booking.getResource, { id: resourceId });

  // Fetch event types for this resource (via mapping table)
  const eventTypes = useQuery(api.booking.getEventTypesForResource, {
    resourceId,
  });

  // Loading state
  if (resource === undefined || eventTypes === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4">
        <div className="container max-w-4xl mx-auto py-8">
          <Skeleton className="h-8 w-48 bg-neutral-800 mb-8" />
          <Skeleton className="h-64 w-full bg-neutral-800" />
        </div>
      </div>
    );
  }

  // Resource not found
  if (resource === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Resource Not Found</h1>
          <p className="text-neutral-400 mb-8">
            The resource you're looking for doesn't exist.
          </p>
          <Link href="/book">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // If event type is selected, show the Booker
  if (selectedEventType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4">
        <div className="container max-w-5xl mx-auto py-8">
          {/* Back to Event Types */}
          <button
            onClick={() => setSelectedEventType(null)}
            className="flex items-center text-neutral-400 hover:text-white transition-colors mb-6 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Event Types
          </button>

          {/* Booker Component */}
          <Booker
            eventTypeId={selectedEventType.id}
            resourceId={resourceId}
            title={resource.name}
            description={selectedEventType.description || resource.description}
            organizerName="Studio Team"
            showDevTools={false}
            onBookingComplete={(booking) => {
              console.log("Booking completed:", booking);
            }}
          />
        </div>
      </div>
    );
  }

  // Event Type Selection View
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="container max-w-4xl mx-auto py-12 px-4">
        {/* Back to Resources */}
        <Link
          href="/book"
          className="flex items-center text-neutral-400 hover:text-white transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All Resources
        </Link>

        {/* Resource Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-neutral-800 text-neutral-400">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{resource.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="text-neutral-500 border-neutral-700">
                  {resource.type}
                </Badge>
                <span className="text-neutral-500 text-sm">
                  {resource.timezone}
                </span>
              </div>
            </div>
          </div>
          {resource.description && (
            <p className="text-neutral-400 text-lg">{resource.description}</p>
          )}
        </div>

        {/* Event Types Section */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-6">
            Select a Booking Type
          </h2>

          {eventTypes.length === 0 ? (
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="mx-auto h-12 w-12 text-neutral-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    No Booking Types Available
                  </h3>
                  <p className="text-neutral-400 mt-2">
                    This resource doesn't have any booking types configured yet.
                  </p>
                  <Link href="/demo/event-types" className="mt-4 inline-block">
                    <Button variant="outline" size="sm">
                      Configure Event Types
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {eventTypes.map((eventType) => (
                <Card
                  key={eventType._id}
                  className="bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all cursor-pointer group"
                  onClick={() => setSelectedEventType(eventType)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white group-hover:text-primary transition-colors">
                          {eventType.title}
                        </CardTitle>
                        {eventType.description && (
                          <CardDescription className="text-neutral-400 mt-1">
                            {eventType.description}
                          </CardDescription>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-neutral-600 group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {/* Duration Options */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-neutral-500" />
                        {eventType.lengthInMinutesOptions?.length > 0 ? (
                          <div className="flex gap-2">
                            {eventType.lengthInMinutesOptions.map((duration: number) => (
                              <Badge
                                key={duration}
                                variant="secondary"
                                className="bg-neutral-800 text-neutral-300"
                              >
                                {formatDuration(duration)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-neutral-800 text-neutral-300"
                          >
                            {formatDuration(eventType.lengthInMinutes)}
                          </Badge>
                        )}
                      </div>

                      {/* Location */}
                      {eventType.locations?.[0]?.address && (
                        <div className="flex items-center gap-2 text-neutral-500 text-sm">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-[200px]">
                            {eventType.locations[0].address}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Admin Link */}
        <div className="text-center mt-12">
          <Link
            href="/demo"
            className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
