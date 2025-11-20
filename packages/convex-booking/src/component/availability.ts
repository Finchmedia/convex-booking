import type { QueryCtx } from "./_generated/server";
import { getRequiredSlots } from "./utils";

export async function isAvailable(
    ctx: QueryCtx,
    resourceId: string,
    start: number,
    end: number
): Promise<boolean> {
    const requiredSlots = getRequiredSlots(start, end);

    for (const [date, slots] of requiredSlots.entries()) {
        const availability = await ctx.db
            .query("daily_availability")
            .withIndex("by_resource_date", (q) =>
                q.eq("resourceId", resourceId).eq("date", date)
            )
            .unique();

        if (availability) {
            for (const slot of slots) {
                if (availability.busySlots.includes(slot)) {
                    return false;
                }
            }
        }
    }

    return true;
}
