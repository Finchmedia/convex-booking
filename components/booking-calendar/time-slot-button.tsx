"use client";

import React from "react";
import type { CalcomSlot } from "@/types/booking";
import { formatTime } from "@/lib/booking-calendar/utils/date-utils";

interface TimeSlotButtonProps {
  slot: CalcomSlot;
  timeFormat: "12h" | "24h";
  timezone: string;
  onSlotSelect: (slotTime: string) => void;
  isReserved?: boolean; // NEW: Indicates slot is held by another user's presence
}

export const TimeSlotButton: React.FC<TimeSlotButtonProps> = ({
  slot,
  timeFormat,
  timezone,
  onSlotSelect,
  isReserved = false,
}) => {
  // NOTE: Presence filtering now happens at the list level in use-convex-slots
  // Slots are split into available (free) and reserved (held by other users)

  return (
    <button
      disabled={isReserved}
      onClick={() => !isReserved && onSlotSelect(slot.time)}
      className={`w-full rounded-md border px-3 py-2 text-center text-sm font-medium transition-all
        ${
          isReserved
            ? "cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600 opacity-60"
            : "border-neutral-600 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700"
        }
      `}
    >
      {isReserved ? "Reserved" : formatTime(slot.time, timeFormat, timezone)}
    </button>
  );
};
