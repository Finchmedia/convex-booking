import { describe, it, expect } from "vitest";
import {
  timestampToSlot,
  getRequiredSlots,
  slotToTimestamp,
  generateDaySlots,
  areSlotsAvailable,
  isDayAvailable,
  SLOT_DURATION_MS,
  SLOTS_PER_DAY,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
} from "./utils";

describe("Constants", () => {
  it("should have correct slot duration", () => {
    expect(SLOT_DURATION_MS).toBe(15 * 60 * 1000); // 15 minutes in ms
  });

  it("should have 96 slots per day", () => {
    expect(SLOTS_PER_DAY).toBe(96);
  });

  it("should have correct business hours", () => {
    expect(BUSINESS_HOURS_START).toBe(36); // 9:00 AM = slot 36
    expect(BUSINESS_HOURS_END).toBe(68); // 5:00 PM = slot 68
  });
});

describe("timestampToSlot", () => {
  it("should convert midnight to slot 0", () => {
    const midnight = new Date("2025-06-17T00:00:00.000Z").getTime();
    const result = timestampToSlot(midnight);
    expect(result.date).toBe("2025-06-17");
    expect(result.slot).toBe(0);
  });

  it("should convert 9:00 AM to slot 36", () => {
    const nineAM = new Date("2025-06-17T09:00:00.000Z").getTime();
    const result = timestampToSlot(nineAM);
    expect(result.date).toBe("2025-06-17");
    expect(result.slot).toBe(36);
  });

  it("should convert 2:00 PM to slot 56", () => {
    const twoPM = new Date("2025-06-17T14:00:00.000Z").getTime();
    const result = timestampToSlot(twoPM);
    expect(result.date).toBe("2025-06-17");
    expect(result.slot).toBe(56);
  });

  it("should convert 5:00 PM to slot 68", () => {
    const fivePM = new Date("2025-06-17T17:00:00.000Z").getTime();
    const result = timestampToSlot(fivePM);
    expect(result.date).toBe("2025-06-17");
    expect(result.slot).toBe(68);
  });

  it("should convert 11:45 PM to slot 95", () => {
    const lastSlot = new Date("2025-06-17T23:45:00.000Z").getTime();
    const result = timestampToSlot(lastSlot);
    expect(result.date).toBe("2025-06-17");
    expect(result.slot).toBe(95);
  });

  it("should handle mid-slot times by flooring", () => {
    // 9:07 should still be slot 36 (floored from 9:00-9:15)
    const midSlot = new Date("2025-06-17T09:07:00.000Z").getTime();
    const result = timestampToSlot(midSlot);
    expect(result.slot).toBe(36);
  });
});

describe("slotToTimestamp", () => {
  it("should convert slot 0 to midnight", () => {
    const result = slotToTimestamp("2025-06-17", 0);
    expect(result).toBe("2025-06-17T00:00:00.000Z");
  });

  it("should convert slot 36 to 9:00 AM", () => {
    const result = slotToTimestamp("2025-06-17", 36);
    expect(result).toBe("2025-06-17T09:00:00.000Z");
  });

  it("should convert slot 56 to 2:00 PM", () => {
    const result = slotToTimestamp("2025-06-17", 56);
    expect(result).toBe("2025-06-17T14:00:00.000Z");
  });

  it("should convert slot 95 to 11:45 PM", () => {
    const result = slotToTimestamp("2025-06-17", 95);
    expect(result).toBe("2025-06-17T23:45:00.000Z");
  });

  it("should handle quarter hours correctly", () => {
    expect(slotToTimestamp("2025-06-17", 37)).toBe("2025-06-17T09:15:00.000Z");
    expect(slotToTimestamp("2025-06-17", 38)).toBe("2025-06-17T09:30:00.000Z");
    expect(slotToTimestamp("2025-06-17", 39)).toBe("2025-06-17T09:45:00.000Z");
  });
});

describe("getRequiredSlots", () => {
  it("should return slots for a 30-minute booking", () => {
    const start = new Date("2025-06-17T09:00:00.000Z").getTime();
    const end = new Date("2025-06-17T09:30:00.000Z").getTime();
    const result = getRequiredSlots(start, end);

    expect(result.has("2025-06-17")).toBe(true);
    expect(result.get("2025-06-17")).toEqual([36, 37]);
  });

  it("should return slots for a 1-hour booking", () => {
    const start = new Date("2025-06-17T10:00:00.000Z").getTime();
    const end = new Date("2025-06-17T11:00:00.000Z").getTime();
    const result = getRequiredSlots(start, end);

    expect(result.get("2025-06-17")).toEqual([40, 41, 42, 43]);
  });

  it("should handle multi-day bookings", () => {
    const start = new Date("2025-06-17T23:00:00.000Z").getTime();
    const end = new Date("2025-06-18T01:00:00.000Z").getTime();
    const result = getRequiredSlots(start, end);

    expect(result.has("2025-06-17")).toBe(true);
    expect(result.has("2025-06-18")).toBe(true);
    expect(result.get("2025-06-17")).toEqual([92, 93, 94, 95]);
    expect(result.get("2025-06-18")).toEqual([0, 1, 2, 3]);
  });

  it("should return empty map for same start and end time", () => {
    const time = new Date("2025-06-17T09:00:00.000Z").getTime();
    const result = getRequiredSlots(time, time);
    expect(result.size).toBe(0);
  });
});

describe("generateDaySlots", () => {
  it("should generate slots for a 30-minute event with default interval", () => {
    const result = generateDaySlots("2025-06-17", 30);

    // 30 min = 2 slots needed
    // From slot 36 to 68, we can fit slots starting at 36, 37, ..., 66
    // But with 15 min interval (step=1), we get: 36,37,38... up to slot 66
    // That's 31 possible starting positions
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].start).toBe("2025-06-17T09:00:00.000Z");
    expect(result[0].slots).toEqual([36, 37]);
  });

  it("should generate slots for a 1-hour event with 30-minute interval", () => {
    const result = generateDaySlots("2025-06-17", 60, 30);

    // 60 min = 4 slots needed
    // 30 min interval = step of 2
    // From slot 36, with 4 slots needed, we can start up to slot 64
    // That means slots at 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64
    expect(result.length).toBe(15);
    expect(result[0].start).toBe("2025-06-17T09:00:00.000Z");
    expect(result[0].slots).toEqual([36, 37, 38, 39]);
    expect(result[1].start).toBe("2025-06-17T09:30:00.000Z");
    expect(result[1].slots).toEqual([38, 39, 40, 41]);
  });

  it("should generate slots for a 2-hour event", () => {
    const result = generateDaySlots("2025-06-17", 120, 60);

    // 120 min = 8 slots needed
    // 60 min interval = step of 4
    // From slot 36 to 68, with 8 slots needed, we can start at 36, 40, 44, 48, 52, 56, 60
    expect(result[0].slots.length).toBe(8);
    expect(result[0].start).toBe("2025-06-17T09:00:00.000Z");
  });

  it("should not generate slots that exceed business hours", () => {
    const result = generateDaySlots("2025-06-17", 60);

    // All slots should end by 5:00 PM (slot 68)
    for (const slot of result) {
      const lastSlot = slot.slots[slot.slots.length - 1];
      expect(lastSlot).toBeLessThanOrEqual(67); // Last slot index should be at most 67 (ends at 68)
    }
  });
});

describe("areSlotsAvailable", () => {
  it("should return true when no slots are busy", () => {
    const requiredSlots = [36, 37, 38, 39];
    const busySlots: number[] = [];
    expect(areSlotsAvailable(requiredSlots, busySlots)).toBe(true);
  });

  it("should return true when required slots don't overlap with busy slots", () => {
    const requiredSlots = [36, 37, 38, 39];
    const busySlots = [40, 41, 42, 43];
    expect(areSlotsAvailable(requiredSlots, busySlots)).toBe(true);
  });

  it("should return false when any required slot is busy", () => {
    const requiredSlots = [36, 37, 38, 39];
    const busySlots = [38, 44, 45]; // Slot 38 overlaps
    expect(areSlotsAvailable(requiredSlots, busySlots)).toBe(false);
  });

  it("should return false when all required slots are busy", () => {
    const requiredSlots = [36, 37, 38, 39];
    const busySlots = [36, 37, 38, 39, 40];
    expect(areSlotsAvailable(requiredSlots, busySlots)).toBe(false);
  });
});

describe("isDayAvailable", () => {
  it("should return true for an empty day", () => {
    const busySlots: number[] = [];
    expect(isDayAvailable(30, busySlots)).toBe(true);
    expect(isDayAvailable(60, busySlots)).toBe(true);
    expect(isDayAvailable(120, busySlots)).toBe(true);
  });

  it("should return true when at least one slot is available", () => {
    // Block all but the first slot (9:00-9:30)
    const busySlots = Array.from({ length: BUSINESS_HOURS_END - BUSINESS_HOURS_START }, (_, i) =>
      i >= 2 ? BUSINESS_HOURS_START + i : -1
    ).filter((s) => s >= 0);

    expect(isDayAvailable(30, busySlots)).toBe(true);
  });

  it("should return false when no slots fit the event length", () => {
    // Block most of the day, leaving only fragmented 15-min slots
    const busySlots = [];
    for (let i = BUSINESS_HOURS_START; i < BUSINESS_HOURS_END; i += 2) {
      busySlots.push(i);
    }
    // This creates gaps of 1 slot (15 min) between busy slots
    // A 1-hour event (4 slots) won't fit
    expect(isDayAvailable(60, busySlots)).toBe(false);
  });

  it("should return false when day is completely booked", () => {
    const busySlots = Array.from(
      { length: BUSINESS_HOURS_END - BUSINESS_HOURS_START },
      (_, i) => BUSINESS_HOURS_START + i
    );
    expect(isDayAvailable(30, busySlots)).toBe(false);
    expect(isDayAvailable(60, busySlots)).toBe(false);
  });

  it("should respect interval parameter", () => {
    // Create busy slots that would block 30-min-interval slots but allow 15-min
    const busySlots = [37, 39, 41, 43]; // Block every other slot starting at 9:15
    expect(isDayAvailable(30, busySlots, 15)).toBe(true); // 9:00 is available
    expect(isDayAvailable(30, busySlots, 30)).toBe(true); // 9:00 is available with 30-min interval too
  });
});

describe("Multi-duration conflict scenarios", () => {
  it("should correctly identify overlap for 5h booking when 1h slot is held", () => {
    // User A holds 1h at 13:00 (slot 52-55)
    const presenceSlots = [52, 53, 54, 55];

    // User B wants 5h starting at 10:00 (slot 40)
    // 5h = 20 slots, so they need slots 40-59
    const fiveHourSlots = Array.from({ length: 20 }, (_, i) => 40 + i);

    // Check for conflict - do any of fiveHourSlots overlap with presenceSlots?
    const hasConflict = fiveHourSlots.some((slot) => presenceSlots.includes(slot));

    expect(hasConflict).toBe(true);
  });

  it("should correctly identify no overlap when slots don't intersect", () => {
    // User A holds 1h at 14:00 (slot 56-59)
    const presenceSlots = [56, 57, 58, 59];

    // User B wants 1h at 10:00 (slot 40-43)
    const userBSlots = [40, 41, 42, 43];

    const hasConflict = userBSlots.some((slot) => presenceSlots.includes(slot));

    expect(hasConflict).toBe(false);
  });

  it("should calculate required slots correctly for multi-duration", () => {
    // 5h booking = 300 minutes = 20 slots
    const slotsNeeded = Math.ceil(300 / 15);
    expect(slotsNeeded).toBe(20);

    // If starting at 10:00 (slot 40), booking ends at 15:00 (slot 60)
    const startSlot = 40;
    const requiredSlots = Array.from({ length: slotsNeeded }, (_, i) => startSlot + i);

    expect(requiredSlots).toHaveLength(20);
    expect(requiredSlots[0]).toBe(40);
    expect(requiredSlots[19]).toBe(59);
  });
});
