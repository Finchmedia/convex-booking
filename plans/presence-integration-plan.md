# Plan: Integrating Presence for "Real-Time Hold" 👻🔒

## Goal
Integrate "Presence" functionality directly into the `convex-booking` component. This will allow us to implement a "Soft Lock" mechanism where selecting a time slot instantly reserves it for the user, preventing race conditions and improving UX.

The integration will strictly follow our existing **Client API Pattern** (`makeBookingAPI`), treating Presence as an internal capability of the Booking Component.

---

## 1. Database Schema Extension
**File:** `packages/convex-booking/src/component/schema.ts`

We will add two tables required for the Presence logic. These tables will live inside the component's schema, isolated from the main app.

```typescript
// ... existing schema ...
export default defineSchema({
  // ... event_types, daily_availability, bookings ...

  // NEW: Presence tables
  presence: defineTable({
    user: v.string(),      // "session_id" or "user_id"
    room: v.string(),      // "slot_2024-11-24T10:00"
    present: v.boolean(),  // Is currently online?
    latestJoin: v.number(),// Timestamp of last activity
    data: v.any(),         // Extra metadata (e.g. "Typing...")
  })
    .index("room_present_join", ["room", "present", "latestJoin"])
    .index("room_user", ["room", "user"]),

  presence_heartbeats: defineTable({
    user: v.string(),
    room: v.string(),
    markAsGone: v.id("_scheduled_functions"), // Reference to the cleanup job
  }).index("by_room_user", ["room", "user"]),
});
```

---

## 2. Backend Implementation (Component Side)
**File:** `packages/convex-booking/src/component/presence.ts` (New File)

We will port the core logic from the `@convex-dev/presence` component but adapt it to our codebase.

*   `heartbeat`: Public mutation. Called by client to say "I'm here". Schedules cleanup.
*   `markAsGone`: Internal mutation. The "Cleanup Job" run by the scheduler.
*   `getPresence`: Public query. Returns list of active users in a slot.

**File:** `packages/convex-booking/src/component/convex.config.ts`
*   No changes needed. The component will automatically pick up the new file.

---

## 3. Client API Exposure (The Bridge)
**File:** `packages/convex-booking/src/client/index.ts`

We will extend `makeBookingAPI` to include the new presence functions. This ensures the Main App consumes them exactly like `createBooking`.

```typescript
export function makeBookingAPI(component: ComponentApi) {
  return {
    // ... existing booking functions ...

    // NEW: Presence Functions
    heartbeat: mutation({
      args: {
        room: v.string(), // The Slot ID
        user: v.string(), // The User/Session ID
      },
      handler: async (ctx, args) => {
        // Delegates to component's presence logic
        return await ctx.runMutation(component.presence.heartbeat, args);
      },
    }),

    getPresence: query({
      args: { room: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.presence.list, args);
      },
    }),
  };
}
```

---

## 4. Main App Integration
**File:** `convex/booking.ts`

Update the export to include the new functions.

```typescript
export const {
  // ... existing ...
  heartbeat,
  getPresence,
} = makeBookingAPI(components.booking);
```

---

## 5. Frontend "Hold" Hook
**File:** `lib/hooks/use-slot-hold.ts` (New Hook)

This is where the magic happens. A custom React hook that:
1.  Generates a random `sessionId` (stored in `useRef` or `sessionStorage`).
2.  Accepts a `slot` (string) as input.
3.  Uses `useMutation(api.booking.heartbeat)` inside a `setInterval` loop (every 5s).
4.  Calls `heartbeat` immediately on mount (if slot selected).
5.  Clears interval on unmount.

**File:** `lib/hooks/use-slot-presence.ts` (New Hook)
1.  Uses `useQuery(api.booking.getPresence, { room: slot })`.
2.  Returns `isLocked` (boolean) if `presence.length > 0` AND `presence[0].user !== mySessionId`.

---

## 6. UI Integration
**File:** `components/booking-calendar/time-slot-button.tsx`
*   Use `useSlotPresence(slot)`.
*   If `isLocked`, disable the button and show "Held" tooltip.

**File:** `app/page.tsx`
*   Use `useSlotHold(selectedSlot)` when a slot is selected.
*   This starts the heartbeat loop, effectively "Locking" it for others.

---

## Execution Steps
1.  **Schema:** Update `schema.ts` with presence tables.
2.  **Backend:** Create `src/component/presence.ts` with heartbeat logic.
3.  **Bridge:** Update `src/client/index.ts` and `convex/booking.ts`.
4.  **Hooks:** Create frontend hooks for Heartbeat and Checking.
5.  **UI:** Wire it up to the buttons.

