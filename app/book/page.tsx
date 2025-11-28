"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import type { Resource } from "@mrfinch/booking/react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, MapPin, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

// Demo organization ID - in production, this would come from URL or auth
const DEMO_ORG_ID = "demo-org";

export default function BookPage() {
  // Query all active resources
  const resources = useQuery(api.booking.listResources, {
    organizationId: DEMO_ORG_ID,
    activeOnly: true,
  });

  // Filter to standalone resources only (can be booked directly)
  const standaloneResources = resources?.filter((r: Resource) => r.isStandalone !== false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "room":
        return <MapPin className="h-5 w-5" />;
      case "equipment":
        return <Clock className="h-5 w-5" />;
      case "person":
        return <Users className="h-5 w-5" />;
      default:
        return <Calendar className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      room: "Room",
      equipment: "Equipment",
      person: "Person",
      vehicle: "Vehicle",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Book a Resource
          </h1>
          <p className="text-lg text-muted-foreground">
            Select a resource to view available booking options
          </p>
        </div>

        {/* Resource Grid */}
        {resources === undefined ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full bg-muted" />
            ))}
          </div>
        ) : standaloneResources?.length === 0 ? (
          <div className="text-center py-16">
            <Users className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-6 text-xl font-semibold text-foreground">
              No resources available
            </h3>
            <p className="text-muted-foreground mt-2">
              There are no bookable resources at this time.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {standaloneResources?.map((resource: Resource) => (
              <Link key={resource._id} href={`/book/${resource.id}`}>
                <Card className="h-full bg-card/50 border-border hover:border-border hover:bg-card/80 transition-all cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                          {getTypeIcon(resource.type)}
                        </div>
                        <div>
                          <CardTitle className="text-foreground">
                            {resource.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="mt-1 text-muted-foreground border-border"
                          >
                            {getTypeLabel(resource.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {resource.description && (
                      <CardDescription className="text-muted-foreground line-clamp-2">
                        {resource.description}
                      </CardDescription>
                    )}
                    <div className="mt-4 flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{resource.timezone}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Footer Links */}
        <div className="text-center mt-12 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
          <span className="text-border">|</span>
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
