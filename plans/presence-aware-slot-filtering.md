# Presence-Aware Slot Filtering Implementation Plan

## 🎯 Problem Statement

**Critical Bug:** Multi-duration bookings show slots as available even when they conflict with active presence holds.

### Example Scenario
```
User A: Selects 1h duration, holds 13:00 slot
User B: Selects 5h duration, views calendar

Current Behavior (BUG):
- User B sees: [10:00, 11:00, 12:00, 13:00 (Reserved), 14:00]
- User B clicks 10:00 (5h booking: 10:00-15:00)
- Result: OVERLAPS with User A's 13:00 hold!
- Frontend validation missing ❌

Expected Behavior (FIXED):
- User B sees: [14:00, 15:00, ...] (10:00-13:00 filtered out)
- Cannot click conflicting slots
- Clear UX: No misleading options ✅
```

### Additional Critical Bug: Cross-Resource Contamination

**Discovered Issue:** Presence table missing `resourceId` field!

```
Current Schema:
presence: {
  room: v.string(),    // "2025-11-28T10:00:00.000Z" ← Just timestamp!
  user: v.string(),
  updated: v.number(),
}

Problem:
User A books StudioA at 10:00 → room = "2025-11-28T10:00:00.000Z"
User B books StudioB at 10:00 → room = "2025-11-28T10:00:00.000Z" ← SAME!
Result: They conflict! ❌ StudioA booking blocks StudioB slot!
```

**Also:** Field name "room" is confusing when we have resourceId (which IS a room like "studio-a")

---

## 🚨 Prerequisites: Schema Fixes (MUST DO FIRST)

Before implementing presence-aware filtering, we must fix two critical schema issues:

### Fix 1: Add ResourceId to Presence

**Why:** Prevent cross-resource contamination (StudioA bookings shouldn't block StudioB)

**Solution:** Add `resourceId` field + compound index

### Fix 2: Rename "room" → "slot"

**Why:** Avoid confusion between:
- `resourceId` = actual room/resource ("studio-a")
- `room` = time slot timestamp ("2025-11-28T10:00")

**Better naming:**
- `resourceId` = which resource
- `slot` = which time slot on that resource

**Impact:** 38 occurrences across 6 files need updating

---

## 🏗️ Architectural Decision: Frontend Derivation Pattern

### Why Frontend Logic is Correct for Convex

**Pattern: Reactive Data Derivation**
```
Backend (Source of Truth):
├─ getDaySlots(date, duration) → [10:00, 11:00, 12:00, 13:00]
│   └─ Returns slots free from CONFIRMED bookings (stable, rarely changes)
│
└─ getDatePresence(date) → [{ room: "13:00", user: "abc", updated: 123 }]
    └─ Returns active presence holds (volatile, changes every 5s)

Frontend (Derived State):
└─ Merges daySlots + presence → filters based on span overlap
    └─ Fast, local computation (no backend round-trip)
```

### Query Invalidation Analysis

**Backend Approach (Rejected):**
```
getDaySlots includes presence check:

Heartbeat every 5s:
→ Presence updated
→ Invalidates getDaySlots(Nov28, 60)   ← 1h viewer query
→ Invalidates getDaySlots(Nov28, 300)  ← 5h viewer query
→ Invalidates getDaySlots(Nov28, 120)  ← 2h viewer query
→ Result: O(n) query invalidations per heartbeat (n = unique durations)
→ Query thrashing! ❌
```

**Frontend Approach (Chosen):**
```
Separate queries:

Heartbeat every 5s:
→ Presence updated
→ Invalidates getDatePresence(Nov28)   ← SINGLE shared query
→ getDaySlots queries untouched (remain cached)
→ Frontend recalculates locally (instant, <1ms)
→ Result: O(1) query invalidation regardless of viewers ✅
```

**Key Insight:** Different durations share the SAME presence query but have DIFFERENT slot queries. Separation = massive performance win.

---

## 🚀 Implementation Plan

### Phase 0: Schema Migration (PREREQUISITE)

**CRITICAL:** Must be completed before all other phases!

#### Part A: Add ResourceId Field

**File:** `packages/convex-booking/src/component/schema.ts`

**Current schema:**
```typescript
presence: defineTable({
  room: v.string(),
  user: v.string(),
  updated: v.number(),
  data: v.optional(v.any()),
})
.index("by_room_updated", ["room", "updated"])
.index("by_user_room", ["user", "room"]),
```

**Updated schema:**
```typescript
presence: defineTable({
  resourceId: v.string(),  // NEW: Which resource (e.g., "studio-a")
  slot: v.string(),        // RENAMED: Which time slot (e.g., "2025-11-28T10:00:00.000Z")
  user: v.string(),
  updated: v.number(),
  data: v.optional(v.any()),
})
.index("by_resource_slot_updated", ["resourceId", "slot", "updated"])  // NEW compound index
.index("by_user_slot", ["user", "slot"]),  // RENAMED for cleanup
```

**Same changes for `presence_heartbeats` table:**
```typescript
presence_heartbeats: defineTable({
  user: v.string(),
  resourceId: v.string(),  // NEW
  slot: v.string(),        // RENAMED
  markAsGone: v.id("_scheduled_functions"),
})
.index("by_user_slot", ["user", "slot"]),  // RENAMED
```

---

#### Part B: Rename "room" → "slot" (38 Occurrences)

**Complete Rename Checklist:**

**1. Schema (2 files, 8 occurrences)**
- [ ] `schema.ts:79` - Field name: `room:` → `slot:`
- [ ] `schema.ts:84` - Index name: `"by_room_updated"` → `"by_resource_slot_updated"`
- [ ] `schema.ts:84` - Index fields: `["room", ...]` → `["resourceId", "slot", ...]`
- [ ] `schema.ts:86` - Index name: `"by_user_room"` → `"by_user_slot"`
- [ ] `schema.ts:86` - Index fields: `["user", "room"]` → `["user", "slot"]`
- [ ] `schema.ts:91` - Field name: `room:` → `slot:`
- [ ] `schema.ts:93` - Index name: `"by_user_room"` → `"by_user_slot"`
- [ ] `schema.ts:93` - Index fields: `["user", "room"]` → `["user", "slot"]`

**2. Presence Backend (`presence.ts`, 17 occurrences)**
- [ ] Line 7-9: Update comments (3x "rooms" → "slots")
- [ ] Line 13: Arg name: `rooms: v.array(v.string())` → `slots: v.array(v.string())`
- [ ] Line 20: Loop variable: `for (const room of args.rooms)` → `for (const slot of args.slots)`
- [ ] Line 25-26: Index & condition: `"by_user_room"` + `.eq("room", room)` → `"by_user_slot"` + `.eq("slot", slot)`
- [ ] Line 38: Insert field: `room: room` → `slot: slot`
- [ ] Line 47-48: Index & condition (same as above)
- [ ] Line 59: Scheduler arg: `room: room` → `slot: slot`
- [ ] Line 65: Insert field: `room: room` → `slot: slot`
- [ ] Line 74-76: Update comments (2x "rooms" → "slots")
- [ ] Line 80: Arg name: `rooms:` → `slots:`
- [ ] Line 85: Loop variable: `for (const room of` → `for (const slot of`
- [ ] Line 88-89: Index & conditions
- [ ] Line 95-96: Index & conditions
- [ ] Line 115: Comment: "room" → "slot"
- [ ] Line 120: Arg name: `room:` → `slot:`
- [ ] Line 125: Index name + condition: `"by_room_updated"` → `"by_resource_slot_updated"` + `.eq("slot", args.slot)`
- [ ] Line 143: Arg name: `room:` → `slot:`
- [ ] Line 149-150: Index & conditions
- [ ] Line 156-157: Index & conditions

**3. Client API (`client/index.ts`, 5 occurrences)**
- [ ] Line 130: Comment: "slot locking" (keep, just verify)
- [ ] Line 133: Arg + comment: `rooms:` → `slots:` + "Array of Slot IDs"
- [ ] Line 144: Arg + comment: `rooms:` → `slots:` + "Array of Slot IDs"
- [ ] Line 153: Arg name: `room:` → `slot:`

**4. Frontend Hooks (`use-slot-hold.ts`, 3 occurrences)**
- [ ] Line 45: Object key: `{ rooms: affectedSlots }` → `{ slots: affectedSlots }`
- [ ] Line 49: Object key: `{ rooms: affectedSlots }` → `{ slots: affectedSlots }`
- [ ] Line 55: Object key: `{ rooms: affectedSlots }` → `{ slots: affectedSlots }`

**5. Frontend Hooks (`use-slot-presence.ts`, 1 occurrence)**
- [ ] Line 11: Object key: `{ room: slotId }` → `{ slot: slotId }`

---

#### Part C: Add ResourceId to All Presence Operations

**Files to update with resourceId parameter:**

**1. `presence.ts` mutations:**
```typescript
// heartbeat
export const heartbeat = mutation({
  args: {
    resourceId: v.string(),  // ADD
    slots: v.array(v.string()),
    user: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    for (const slot of args.slots) {
      // Query with resourceId
      const existingPresence = await ctx.db
        .query("presence")
        .withIndex("by_user_slot", (q) =>
          q.eq("user", args.user).eq("slot", slot)
        )
        .filter(p => p.resourceId === args.resourceId)  // ADD filter
        .first();

      // Insert with resourceId
      await ctx.db.insert("presence", {
        resourceId: args.resourceId,  // ADD
        slot: slot,
        user: args.user,
        ...
      });

      // presence_heartbeats also needs resourceId
      await ctx.db.insert("presence_heartbeats", {
        resourceId: args.resourceId,  // ADD
        slot: slot,
        user: args.user,
        ...
      });
    }
  },
});

// leave - same pattern
// cleanup - same pattern
// list - add resourceId filter
```

**2. `client/index.ts` - Add resourceId to API:**
```typescript
heartbeat: mutation({
  args: {
    resourceId: v.string(),  // ADD
    slots: v.array(v.string()),
    user: v.string(),
    data: v.optional(v.any()),
  },
  // ... same for leave
});

getPresence: query({
  args: {
    resourceId: v.string(),  // ADD
    slot: v.string(),
  },
  // ...
});
```

**3. Frontend hooks - Thread resourceId through:**
```typescript
// use-slot-hold.ts
export function useSlotHold(
  slotId: string | null,
  durationMinutes: number,
  intervalMinutes: number,
  resourceId: string  // ADD
) {
  heartbeat({ resourceId, slots: affectedSlots, user: userId });
  leave({ resourceId, slots: affectedSlots, user: userId });
}

// use-slot-presence.ts
export function useSlotPresence(
  slotId: string,
  resourceId: string  // ADD
) {
  const presence = useQuery(api.booking.getPresence, {
    resourceId,  // ADD
    slot: slotId,
  });
}
```

**4. Update all callsites:**
- `components/booker/booker.tsx` - Pass resourceId to useSlotHold
- `components/booking-calendar/time-slot-button.tsx` - Pass resourceId to useSlotPresence
- Pass resourceId prop through Calendar and TimeSlotsPanel

---

### Phase 1: Add Backend Query for Date-Scoped Presence

**File:** `packages/convex-booking/src/component/public.ts`

**Add new query (after getDaySlots):**

```typescript
/**
 * Gets all active presence holds for a specific date and resource
 * Used by frontend to filter slots based on span conflicts
 *
 * Optimization: Uses range query on compound index for efficient filtering
 */
export const getDatePresence = query({
    args: {
        resourceId: v.string(),
        date: v.string(), // "2025-11-28"
    },
    handler: async (ctx, args) => {
        const { resourceId, date } = args;
        const now = Date.now();
        const TIMEOUT_MS = 10_000; // Same as presence.ts

        // Range query: Fetch all slots for this resource starting with date prefix
        // Example: resourceId="studio-a", date="2025-11-28" matches slot="2025-11-28T10:00:00.000Z"
        // Uses compound index by_resource_slot_updated from Phase 0!
        const allPresence = await ctx.db
            .query("presence")
            .withIndex("by_resource_slot_updated", (q) =>
                q.eq("resourceId", resourceId)
                 .gte("slot", date)
                 .lt("slot", date + "\u{FFFF}")
            )
            .collect();

        // Filter to active presence only (< 10s old)
        const activePresence = allPresence.filter(
            (p) => now - p.updated <= TIMEOUT_MS
        );

        return activePresence.map((p) => ({
            slot: p.slot,
            user: p.user,
            updated: p.updated,
        }));
    },
});
```

**Why Range Query Works:**
- `slot` field stores ISO timestamps: `"2025-11-28T10:00:00.000Z"`
- All slots for Nov 28 start with `"2025-11-28"`
- Compound index: `["resourceId", "slot", "updated"]` allows efficient filtering by BOTH resource AND date
- `eq("resourceId", "studio-a")` + range on `slot` = only StudioA slots for this date
- `gte("2025-11-28")` + `lt("2025-11-28\u{FFFF}")` captures date range
- No cross-resource contamination! ✅

---

### Phase 2: Export Query in Client API

**File:** `packages/convex-booking/src/client/index.ts`

**Add after `getPresence` (around line 157):**

```typescript
getDatePresence: query({
  args: {
    resourceId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(component.public.getDatePresence, args);
  },
}),
```

---

### Phase 3: Add Frontend Filtering Logic

**File:** `lib/hooks/use-convex-slots.ts`

**Import helper at top:**

```typescript
import { timestampToSlot } from "@/packages/convex-booking/src/component/utils";
```

**Add presence query after daySlots query (around line 50):**

```typescript
const daySlots = useQuery(
  api.booking.getDaySlots,
  enabled && selectedDateStr
    ? {
        resourceId,
        date: selectedDateStr,
        eventLength,
        slotInterval: effectiveInterval,
      }
    : "skip"
);

// NEW: Fetch active presence for selected date
const datePresence = useQuery(
  api.booking.getDatePresence,
  enabled && selectedDateStr
    ? {
        resourceId,
        date: selectedDateStr,
      }
    : "skip"
);
```

**Add helper function before `useConvexSlots` export (around line 20):**

```typescript
/**
 * Calculates which 15-min slot indices a booking would occupy
 * Example: 10:00 with 90min duration and 60min interval → [40, 41, 42, 43, 44, 45]
 */
function calculateRequiredSlots(
  slotTime: string,
  durationMinutes: number,
  intervalMinutes: number
): number[] {
  const startTimestamp = new Date(slotTime).getTime();
  const slots: number[] = [];

  // Calculate how many 15-min slots are needed
  const slotsNeeded = Math.ceil(durationMinutes / 15);

  // Get starting slot index
  const startDate = new Date(startTimestamp);
  const hours = startDate.getUTCHours();
  const minutes = startDate.getUTCMinutes();
  const startSlot = hours * 4 + Math.floor(minutes / 15);

  // Collect all slot indices
  for (let i = 0; i < slotsNeeded; i++) {
    slots.push(startSlot + i);
  }

  return slots;
}

/**
 * Checks if a slot conflicts with any active presence holds
 * Returns true if the booking span overlaps with held slots
 */
function hasPresenceConflict(
  slotTime: string,
  durationMinutes: number,
  intervalMinutes: number,
  presence: any[]
): boolean {
  if (!presence || presence.length === 0) return false;

  // Calculate which slots this booking would occupy
  const requiredSlots = calculateRequiredSlots(slotTime, durationMinutes, intervalMinutes);

  // Convert presence rooms to slot indices
  const heldSlots = presence.map((p) => {
    const timestamp = new Date(p.room).getTime();
    const date = new Date(timestamp);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return hours * 4 + Math.floor(minutes / 15);
  });

  // Check for overlap
  return requiredSlots.some((slot) => heldSlots.includes(slot));
}
```

**Update slot processing logic (around line 72):**

```typescript
// Process new data if available
const currentSlots = useMemo<TimeSlot[] | undefined>(() => {
  if (!daySlots) return undefined;

  const formatted = (daySlots as any[])
    .filter((slot) => {
      // NEW: Filter out slots that would conflict with presence
      return !hasPresenceConflict(
        slot.time,
        eventLength,
        effectiveInterval,
        datePresence || []
      );
    })
    .map((slot) => ({
      time: slot.time,
      attendees: 0,
    }));

  formatted.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  return formatted;
}, [daySlots, datePresence, eventLength, effectiveInterval]);
```

**Update loading state to account for presence (around line 88):**

```typescript
// Loading states
// 1. First load: We have no data at all (neither current nor prev)
const isLoading =
  enabled &&
  selectedDateStr !== null &&
  !currentSlots &&
  prevSlotsRef.current.length === 0 &&
  datePresence === undefined; // Wait for presence too

// 2. Reloading: We have prev data, but are waiting for new data
const isReloading =
  enabled &&
  selectedDateStr !== null &&
  !currentSlots &&
  prevSlotsRef.current.length > 0;
```

---

### Phase 4: Update Empty State Message (UX Enhancement)

**File:** `components/booking-calendar/time-slots-panel.tsx`

**Update empty state (around line 60):**

```typescript
{!loading && availableSlots.length === 0 && selectedDate && (
  <div className="text-center py-8 text-neutral-500">
    <p>No available times for this date and duration.</p>
    <p className="text-sm mt-2 text-neutral-600">
      Try selecting a shorter booking length or different date.
    </p>
  </div>
)}
```

---

## 🧪 Testing Plan

### Test Scenario 1: Basic Conflict Detection

**Setup:**
- User A: 1h duration, holds 13:00

**User B Actions:**
1. Select 5h duration
2. View Nov 28

**Expected:**
- Slots 09:00-12:00 NOT shown (would overlap 13:00)
- Slots 14:00+ shown (no conflict)

**Verify:**
- Check browser DevTools → Network → `getDatePresence` called once
- Check `getDaySlots` not invalidated on User A's heartbeat

---

### Test Scenario 2: Multi-User Interference

**Setup:**
- User A: Holds 10:00 (1h)
- User B: Holds 14:00 (1h)

**User C Actions:**
1. Select 5h duration
2. View Nov 28

**Expected:**
- Only 15:00+ shown (earlier slots conflict with A or B)

---

### Test Scenario 3: Hold Release

**Setup:**
- User A: Holds 13:00 (1h)

**User B:**
1. Select 5h duration
2. Sees slots filtered (no 09:00-12:00)

**User A:**
3. Clicks "Back" → releases hold

**User B:**
4. Slots immediately reappear (09:00-12:00 now available)

**Expected:**
- Real-time reactivity works
- User B sees slots update without manual refresh

---

### Test Scenario 4: Same Duration = No Filter

**Setup:**
- User A: Holds 13:00 (1h)

**User B:**
1. Select 1h duration
2. View Nov 28

**Expected:**
- All slots shown EXCEPT 13:00
- 13:00 shows "Reserved" (per-slot presence UI)

---

### Test Scenario 5: Performance (Query Caching)

**Setup:**
- 10 users viewing Nov 28 with various durations (1h, 2h, 5h)

**Verify in Convex Dashboard:**
- `getDaySlots(Nov28, 60)` - Called once, cached
- `getDaySlots(Nov28, 120)` - Called once, cached
- `getDaySlots(Nov28, 300)` - Called once, cached
- `getDatePresence(Nov28)` - Called once, pushed to all 10 users

**On User A heartbeat:**
- Only `getDatePresence` invalidates
- `getDaySlots` queries remain cached ✅

---

## 📊 Performance Comparison

### Before (Current Architecture)

**Query Patterns:**
```
Per User:
- getDaySlots(date, duration) → 1 query
- getPresence(slot1) → 1 query per visible slot
- getPresence(slot2) → 1 query per visible slot
- ... (12 slots × 1 query = 12 queries per user)

Total: 13 queries per user
```

**With 10 concurrent users:**
- 130 total queries
- High query count
- But individual slot presence is granular ✅

---

### After (Frontend Derivation)

**Query Patterns:**
```
Per User:
- getDaySlots(date, duration) → 1 query (cached across users with same duration)
- getDatePresence(date) → 1 query (cached across ALL users viewing this date)
- Per-slot presence check → Still runs (for "Reserved" UI)

Total: 2 presence queries per user (shared) + individual slot checks
```

**With 10 concurrent users:**
- getDaySlots: 3 unique queries (if 3 different durations) - cached
- getDatePresence: 1 query - cached and shared by all 10 users
- Per-slot presence: 12 queries per user (unchanged, for UI state)

**Key Improvement:**
- Heartbeats only invalidate `getDatePresence` (1 shared query)
- No cross-duration contamination
- `getDaySlots` stays stable (only changes on real bookings)

---

## 🔒 Backend Safety Layer

**Important:** Frontend filtering is for UX only. Backend MUST still validate on booking:

**File:** `packages/convex-booking/src/component/public.ts` (createBooking mutation)

**Already exists (around line 230), but verify:**

```typescript
// Check availability (reuse existing logic from createReservation)
const available = await isAvailable(ctx, args.resourceId, args.start, args.end);
if (!available) {
  throw new Error("Time slot no longer available");
}
```

**This checks BOTH:**
- daily_availability (confirmed bookings)
- Would need presence check too for full safety

**Future enhancement (out of scope for this plan):**
Add presence check in `createBooking` mutation for defense-in-depth.

---

## 🎯 Success Criteria

### Functional Requirements

- [ ] User B with 5h duration cannot see slots that overlap with held slots
- [ ] Slots reappear immediately when hold is released
- [ ] Per-slot "Reserved" UI still works (individual useSlotPresence)
- [ ] Empty state shows helpful message about duration
- [ ] No conflicting bookings possible (frontend prevents + backend validates)

### Performance Requirements

- [ ] `getDaySlots` queries remain cached during heartbeats
- [ ] Only `getDatePresence` invalidates every 5 seconds
- [ ] Frontend filtering completes in < 1ms (synchronous, local)
- [ ] No full table scans (range query uses existing index)

### Code Quality

- [ ] Clear separation of concerns (source vs derived state)
- [ ] Helper functions are testable
- [ ] Follows Convex reactive patterns
- [ ] No new database columns required

---

## 📁 Files Modified Summary

**Backend:**
1. `packages/convex-booking/src/component/public.ts` - Add getDatePresence query
2. `packages/convex-booking/src/client/index.ts` - Export query in API

**Frontend:**
3. `lib/hooks/use-convex-slots.ts` - Add filtering logic
4. `components/booking-calendar/time-slots-panel.tsx` - Update empty state

**Total:** 4 files modified, no schema changes needed!

---

## 🚀 Implementation Checklist

**Phase 1: Backend (15 min)**
- [ ] Add `getDatePresence` query to public.ts
- [ ] Add client API export in index.ts
- [ ] Test range query in Convex dashboard

**Phase 2: Frontend Logic (20 min)**
- [ ] Import utils in use-convex-slots.ts
- [ ] Add helper functions (calculateRequiredSlots, hasPresenceConflict)
- [ ] Add datePresence query
- [ ] Update currentSlots memo with filtering
- [ ] Update loading states

**Phase 3: UX Polish (5 min)**
- [ ] Update empty state message in time-slots-panel.tsx

**Phase 4: Testing (20 min)**
- [ ] Test scenario 1-5
- [ ] Verify query caching in Convex dashboard
- [ ] Test with 2+ concurrent users

**Total Estimated Time:** 60 minutes

---

## 🎓 Key Learnings

### Reactive Data Derivation Pattern

**Core Principle:**
```
Backend = Source of Truth (stable, authoritative)
Frontend = Derived Views (reactive, optimistic)
```

**When to use:**
- Data changes at different rates (bookings vs presence)
- Multiple views need same source data
- Performance requires cache optimization
- Real-time updates are critical

**Convex makes this pattern trivial:**
- Backend: Just return the data
- Frontend: useQuery + useMemo = reactive derivation
- Framework handles subscription/invalidation magic

### Performance Optimization via Separation

**Anti-pattern:** Put everything in one query
- Single query = convenient
- But: Mixed concerns = frequent invalidations

**Pattern:** Separate stable from volatile
- Stable data = rare invalidations = better caching
- Volatile data = isolated invalidations = no contamination

**Result:** O(1) invalidation regardless of number of viewers

---

## 🔮 Future Enhancements (Out of Scope)

1. **Presence check in createBooking mutation**
   - Add safety layer: Check presence before creating booking
   - Defense-in-depth pattern

2. **Optimistic hold confirmation**
   - Show "Holding..." state immediately on click
   - Cancel if presence conflict detected

3. **Presence batching v2**
   - Batch getDatePresence results across multiple dates
   - Useful for multi-month calendar views

4. **Analytics**
   - Track conflict rate (how often users click unavailable slots)
   - Measure query cache hit rates

---

## ✅ Conclusion

This plan implements presence-aware slot filtering using the **Reactive Data Derivation** pattern. By separating stable data (booked slots) from volatile data (presence holds) and performing conflict detection in the frontend, we achieve:

- ✅ **Correct UX** - No misleading slot options
- ✅ **High Performance** - O(1) query invalidations
- ✅ **Scalability** - Cache sharing across all viewers
- ✅ **Clean Architecture** - Clear separation of concerns
- ✅ **Convex Best Practice** - Follows framework patterns

**Ready to implement!** 🚀
