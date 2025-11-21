"use client";

import React from "react";
import { Clock, MapPin, Globe, User } from "lucide-react";
import { getTimezoneDisplayName } from "@/lib/booking-calendar/utils/timezone-utils";

interface EventType {
  title: string;
  description?: string;
  lengthInMinutes: number;
  lengthInMinutesOptions?: number[];
  locations: Array<{
    type: string;
    address?: string;
    public?: boolean;
  }>;
  timezone: string;
  lockTimeZoneToggle: boolean;
}

interface EventMetaPanelProps {
  eventType: EventType | undefined;
  selectedDuration: number;
  onDurationChange: (duration: number) => void;
  userTimezone: string;
  onTimezoneChange: (timezone: string) => void;
  timezoneLocked: boolean;
  organizerName?: string; // Optional organizer name
  organizerAvatar?: string; // Optional organizer avatar URL
}

export const EventMetaPanel: React.FC<EventMetaPanelProps> = ({
  eventType,
  selectedDuration,
  onDurationChange,
  userTimezone,
  onTimezoneChange,
  timezoneLocked,
  organizerName = "Daniel Finke",
  organizerAvatar,
}) => {
  if (!eventType) {
    return (
      <div className="w-full p-4 border-b border-neutral-800 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-neutral-700 animate-pulse rounded" />
          <div className="h-6 w-full bg-neutral-700 animate-pulse rounded" />
          <div className="h-16 w-full bg-neutral-700 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  // Format duration for display (e.g., 60 → "1h", 90 → "1h 30min")
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  // Get public address from locations
  const publicAddress = eventType.locations.find(
    (loc) => loc.type === "address" && loc.public
  )?.address;

  return (
    <div className="w-full p-4 border-b border-neutral-800 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="space-y-4">
        {/* Avatar and Organizer Name */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden">
              {organizerAvatar ? (
                <img src={organizerAvatar} alt={organizerName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-neutral-400" />
              )}
            </div>
          </div>
          <p className="text-xs font-medium text-neutral-400">{organizerName}</p>
        </div>

        {/* Event Title */}
        <div>
          <h1 className="text-lg font-semibold text-neutral-100 break-words leading-tight">
            {eventType.title}
          </h1>
        </div>

        {/* Description */}
        {eventType.description && (
          <div className="text-xs text-neutral-400 max-h-[140px] overflow-y-auto pr-2 break-words leading-relaxed">
            <p>{eventType.description}</p>
          </div>
        )}

        {/* Duration Options */}
        <div className="flex items-start text-xs text-neutral-300">
          <Clock className="mr-2 mt-[2px] h-3.5 w-3.5 flex-shrink-0" />
          <div className="flex-1">
            {eventType.lengthInMinutesOptions && eventType.lengthInMinutesOptions.length > 1 ? (
              <div className="border border-neutral-700 rounded-md p-0.5">
                <ul className="flex items-center gap-0.5 overflow-x-auto">
                  {eventType.lengthInMinutesOptions.map((duration) => (
                    <li
                      key={duration}
                      onClick={() => onDurationChange(duration)}
                      className={`cursor-pointer rounded px-2 py-1 text-xs font-medium transition ${
                        selectedDuration === duration
                          ? "bg-neutral-700 text-neutral-100"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {formatDuration(duration)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="text-xs">{formatDuration(eventType.lengthInMinutes)}</span>
            )}
          </div>
        </div>

        {/* Location */}
        {publicAddress && (
          <div className="flex items-start text-xs text-neutral-300">
            <MapPin className="mr-2 mt-[2px] h-3.5 w-3.5 flex-shrink-0" />
            <p className="break-words line-clamp-2 text-xs">{publicAddress}</p>
          </div>
        )}

        {/* Timezone Display (Cal.com style) */}
        {userTimezone && (
          <div className="flex items-center text-xs text-neutral-300 cursor-pointer hover:text-neutral-200 transition">
            <Globe className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
            <div className="flex-1 flex items-center justify-between py-1.5 px-2.5 rounded-lg border border-neutral-700 bg-neutral-800/30">
              <span className="font-medium text-neutral-200 text-xs">{getTimezoneDisplayName(userTimezone)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
