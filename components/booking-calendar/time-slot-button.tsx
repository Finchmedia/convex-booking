"use client";

import React from "react";
import type { CalcomSlot } from "@/types/booking";
import { formatTime } from "@/lib/booking-calendar/utils/date-utils";
import { useSlotPresence } from "@/lib/hooks/use-slot-presence";

interface TimeSlotButtonProps {
  slot: CalcomSlot;
  timeFormat: "12h" | "24h";
  timezone: string;
  onSlotSelect: (slotTime: string) => void;
}

export const TimeSlotButton: React.FC<TimeSlotButtonProps> = ({
  slot,
  timeFormat,
  timezone,
  onSlotSelect,
}) => {
  const { isLocked, isLoading } = useSlotPresence(slot.time);
  
  // Optional: Visual indicator for loading state, or just default to enabled
  // For now, we only disable if we are sure it's locked.
  
  return (
    <button
      disabled={isLocked}
      onClick={() => onSlotSelect(slot.time)}
      className={`w-full rounded-md border px-3 py-2 text-center text-sm font-medium transition-all
        ${isLocked
          ? "border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed opacity-50"
          : "border-neutral-600 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700"
        }
      `}
    >
      {isLocked ? "Reserved" : formatTime(slot.time, timeFormat, timezone)}
    </button>
  );
};
