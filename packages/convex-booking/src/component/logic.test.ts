import { describe, it, expect } from "vitest";
import { timestampToSlot, getRequiredSlots } from "./utils";

describe("Slot Math", () => {
    it("converts timestamp to slot correctly", () => {
        // 2024-05-20 14:00 UTC
        const ts = new Date("2024-05-20T14:00:00Z").getTime();
        const result = timestampToSlot(ts);
        expect(result).toEqual({ date: "2024-05-20", slot: 56 }); // 14 * 4 = 56
    });

    it("handles slot boundaries", () => {
        // 2024-05-20 14:14 UTC -> Still slot 56
        const ts = new Date("2024-05-20T14:14:59Z").getTime();
        expect(timestampToSlot(ts)).toEqual({ date: "2024-05-20", slot: 56 });

        // 2024-05-20 14:15 UTC -> Slot 57
        const ts2 = new Date("2024-05-20T14:15:00Z").getTime();
        expect(timestampToSlot(ts2)).toEqual({ date: "2024-05-20", slot: 57 });
    });

    it("calculates required slots for a range", () => {
        // 14:00 to 15:00 (4 slots: 56, 57, 58, 59)
        const start = new Date("2024-05-20T14:00:00Z").getTime();
        const end = new Date("2024-05-20T15:00:00Z").getTime();

        const slots = getRequiredSlots(start, end);

        expect(slots.size).toBe(1);
        expect(slots.get("2024-05-20")).toEqual([56, 57, 58, 59]);
    });

    it("handles multi-day ranges", () => {
        // 23:45 to 00:30 next day
        const start = new Date("2024-05-20T23:45:00Z").getTime();
        const end = new Date("2024-05-21T00:30:00Z").getTime();

        const slots = getRequiredSlots(start, end);

        expect(slots.size).toBe(2);
        expect(slots.get("2024-05-20")).toEqual([95]); // Last slot of day 1
        expect(slots.get("2024-05-21")).toEqual([0, 1]); // First 2 slots of day 2
    });
});
