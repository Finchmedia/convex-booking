"use client";

import { useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Booker } from "@/components/booker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, MapPin, ChevronRight, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

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
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="container max-w-4xl mx-auto py-8">
          <Skeleton className="h-8 w-48 bg-muted mb-8" />
          <Skeleton className="h-64 w-full bg-muted" />
        </div>
      </div>
    );
  }

  // Resource not found
  if (resource === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Resource Not Found</h1>
          <p className="text-muted-foreground mb-8">
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
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background p-4">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="container max-w-5xl mx-auto py-8">
          {/* Back to Event Types */}
          <button
            onClick={() => setSelectedEventType(null)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
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

          {/* Real-time presence demo */}
          <div className="mt-8 text-center">
            <button
              onClick={() => window.open(window.location.href, '_blank', 'noopener')}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-5 py-2.5 rounded-lg border border-border hover:border-border bg-muted/50 hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab to test real-time presence
            </button>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Select a time slot in both tabs to see live conflict detection
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Event Type Selection View
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container max-w-4xl mx-auto py-12 px-4">
        {/* Back to Resources */}
        <Link
          href="/book"
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All Resources
        </Link>

        {/* Resource Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-muted text-muted-foreground">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{resource.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="text-muted-foreground border-border">
                  {resource.type}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {resource.timezone}
                </span>
              </div>
            </div>
          </div>
          {resource.description && (
            <p className="text-muted-foreground text-lg">{resource.description}</p>
          )}
        </div>

        {/* Event Types Section */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Select a Booking Type
          </h2>

          {eventTypes.length === 0 ? (
            <Card className="bg-card/50 border-border">
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    No Booking Types Available
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    This resource doesn't have any booking types configured yet.
                  </p>
                  <Link href="/admin/event-types" className="mt-4 inline-block">
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
                  className="bg-card/50 border-border hover:border-border hover:bg-card/80 transition-all cursor-pointer group"
                  onClick={() => setSelectedEventType(eventType)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-foreground">
                          {eventType.title}
                        </CardTitle>
                        {eventType.description && (
                          <CardDescription className="text-muted-foreground mt-1">
                            {eventType.description}
                          </CardDescription>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {/* Duration Options */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {eventType.lengthInMinutesOptions?.length > 0 ? (
                          <div className="flex gap-2">
                            {eventType.lengthInMinutesOptions.map((duration: number) => (
                              <Badge
                                key={duration}
                                variant="secondary"
                                className="bg-muted text-muted-foreground"
                              >
                                {formatDuration(duration)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-muted text-muted-foreground"
                          >
                            {formatDuration(eventType.lengthInMinutes)}
                          </Badge>
                        )}
                      </div>

                      {/* Location */}
                      {eventType.locations?.[0]?.address && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
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
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
