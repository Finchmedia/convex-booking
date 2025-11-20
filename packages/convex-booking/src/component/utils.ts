export const SLOT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const SLOTS_PER_DAY = 24 * 4; // 96

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
