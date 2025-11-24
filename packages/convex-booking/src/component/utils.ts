export const SLOT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const SLOTS_PER_DAY = 24 * 4; // 96

// Business hours (in slot indices, 0-95)
// 9:00 AM = slot 36 (9 * 4)
// 5:00 PM = slot 68 (17 * 4)
export const BUSINESS_HOURS_START = 36; // 9:00 AM
export const BUSINESS_HOURS_END = 68; // 5:00 PM

export function timestampToSlot(timestamp: number): {
    date: string;
    slot: number;
} {
    const dateObj = new Date(timestamp);
    const date = dateObj.toISOString().split("T")[0];

    // Calculate minutes since midnight UTC
    const hours = dateObj.getUTCHours();
    const minutes = dateObj.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    const slot = Math.floor(totalMinutes / 15);

    return { date, slot };
}

export function getRequiredSlots(
    start: number,
    end: number
): Map<string, number[]> {
    const slots = new Map<string, number[]>();
    let current = start;

    // Normalize start to the beginning of the slot? 
    // For now, let's assume inputs are already aligned or we just take the containing slot.
    // Actually, if start is 14:05, it occupies the 14:00-14:15 slot.

    while (current < end) {
        const { date, slot } = timestampToSlot(current);

        if (!slots.has(date)) {
            slots.set(date, []);
        }

        const daySlots = slots.get(date)!;
        if (!daySlots.includes(slot)) {
            daySlots.push(slot);
        }

        // Move to next slot
        current += SLOT_DURATION_MS;

        // Align current to exact slot boundary to avoid drift
        const remainder = current % SLOT_DURATION_MS;
        if (remainder !== 0) {
            current -= remainder;
        }
    }

    return slots;
}

/**
 * Converts a slot index to a time string in ISO format
 * @param date - ISO date string (e.g., "2025-06-17")
 * @param slotIndex - Slot index (0-95)
 * @returns ISO timestamp string (e.g., "2025-06-17T14:00:00.000Z")
 */
export function slotToTimestamp(date: string, slotIndex: number): string {
    const hours = Math.floor(slotIndex / 4);
    const minutes = (slotIndex % 4) * 15;
    return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000Z`;
}

/**
 * Generates all possible time slots for a given day within business hours
 * @param date - ISO date string (e.g., "2025-06-17")
 * @param eventLengthMinutes - Event duration in minutes
 * @param intervalMinutes - Step between slots in minutes (default: 15)
 * @returns Array of { start: ISO timestamp, slot indices }
 */
export function generateDaySlots(
    date: string,
    eventLengthMinutes: number,
    intervalMinutes: number = 15
): Array<{ start: string; slots: number[] }> {
    const slotsNeeded = Math.ceil(eventLengthMinutes / 15);
    const step = Math.ceil(intervalMinutes / 15);
    const possibleSlots: Array<{ start: string; slots: number[] }> = [];

    // Generate slots from business hours start to end, ensuring we don't go past business hours
    // We increment by `step` instead of 1
    for (let slotIndex = BUSINESS_HOURS_START; slotIndex + slotsNeeded <= BUSINESS_HOURS_END; slotIndex += step) {
        const slots = Array.from({ length: slotsNeeded }, (_, i) => slotIndex + i);
        const startTime = slotToTimestamp(date, slotIndex);
        possibleSlots.push({ start: startTime, slots });
    }

    return possibleSlots;
}

/**
 * Checks if a set of slots are available (not in busySlots array)
 */
export function areSlotsAvailable(
    requiredSlots: number[],
    busySlots: number[]
): boolean {
    return !requiredSlots.some(slot => busySlots.includes(slot));
}

/**
 * Checks if a day has any available slots for a given event length
 * Optimized to exit early and avoid object generation
 * @param eventLengthMinutes - Duration in minutes
 * @param busySlots - Array of busy slot indices
 * @param intervalMinutes - Step between slots in minutes (default: 15)
 * @returns boolean
 */
export function isDayAvailable(
    eventLengthMinutes: number,
    busySlots: number[],
    intervalMinutes: number = 15
): boolean {
    const slotsNeeded = Math.ceil(eventLengthMinutes / 15);
    const step = Math.ceil(intervalMinutes / 15);
    
    // Iterate through potential start times
    // We use the same loop logic as generateDaySlots but without object creation
    for (let slotIndex = BUSINESS_HOURS_START; slotIndex + slotsNeeded <= BUSINESS_HOURS_END; slotIndex += step) {
        // Check if this specific block is free
        let isBlockFree = true;
        for (let i = 0; i < slotsNeeded; i++) {
            if (busySlots.includes(slotIndex + i)) {
                isBlockFree = false;
                break;
            }
        }
        
        // If we found ONE valid block, the day has availability. Return true immediately.
        if (isBlockFree) {
            return true;
        }
    }
    
    return false;
}
