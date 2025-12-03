# ConvexBooking: Real-Time Booking System Documentation

> **Project Status**: Production-Ready Core Component
> **Last Major Update**: November 26, 2025 (Form Architecture & Schema Simplification)
> **Philosophy**: Deep-diving beyond "hello world" into production-grade, scalable systems

---

## 🎯 Project Identity

### What Is This?
A **Universal Booking Component** for Convex that handles complex inventory booking (recording studios, meeting rooms, equipment) with:
- Real-time presence-aware slot locking
- Multi-duration support with intelligent conflict prevention
- O(1) availability checks regardless of historical data size
- ACID transaction guarantees (no race conditions)

### Why We Built This
**Evolution from fragile stacks:** Next.js + Supabase + Cal.com APIs felt cumbersome. Cal.com optimizes for "user appointments," not "inventory/room management." We needed something better.

**The Convex Advantage:** By leveraging Convex's reactivity + ACID transactions, we built a system that is **superior to traditional SQL** for this use case—no complex locking, no scan limits, instant real-time updates.

### Current Capabilities
✅ Multi-resource bookings (StudioA, StudioB, etc.)
✅ Multi-duration support (1h, 2h, 5h options)
✅ Real-time presence holds (10-second timeout)
✅ Reserved slots shown chronologically inline
✅ Cross-resource isolation (StudioA holds don't block StudioB)
✅ Scalable to millions of historical bookings (O(1) queries)

---

## 🏗️ Core Architecture: "The Traffic Controller Pattern"

### The Fundamental Problem: Convex Scan Limits
Traditional SQL booking systems use range queries:
```sql
SELECT * FROM bookings WHERE start < end_date AND end > start_date
```

**Convex Problem:** With 50,000 past bookings, this scans ALL documents to find 3 active ones → hits 16k scan limit → crashes.

### Our Solution: Discrete Time Buckets (Bitmap Pattern)

Instead of calculating availability on-the-fly, we **pre-compute and store** availability in discrete buckets.

#### 1. Daily Availability Document
```typescript
daily_availability: {
  resourceId: "studio-a",
  date: "2025-11-24",           // ISO date string
  busySlots: [32, 33, 34, ...]  // Array of occupied 15-min chunk indices (0-95)
}
```

#### 2. The 96-Slot Quantum System
Time normalized into 15-minute chunks:
- `00:00` → Slot 0
- `14:00` → Slot 56
- `23:45` → Slot 95

**Benefits:**
- Fast integer math (no complex date logic)
- Fixed-size arrays (predictable memory)
- O(1) lookups

#### 3. O(1) Availability Check
To check if StudioA is free on Nov 24:
1. Fetch **ONE** document: `daily_availability` where `resourceId="studio-a"` AND `date="2025-11-24"`
2. Check if required slots are in `busySlots` array
3. **Cost:** 1 database read. Always. Even with 10 million historical bookings.

#### 4. ACID Booking Transaction
Multi-day booking (Mon 14:00 → Wed 10:00):
1. Fetch 3 documents (Mon, Tue, Wed availability)
2. Check: Any required slots already in `busySlots`?
3. **If conflict:** Throw error → Transaction aborts
4. **If clear:**
   - Update Monday's `busySlots`
   - Mark Tuesday as full day (slots 0-95)
   - Update Wednesday's `busySlots`
   - Insert booking record
5. **Transaction commits** → Atomic, no race conditions

---

## 🔥 The Presence System: Real-Time Slot Locking

### Architecture
**Integrated from `@convex-dev/presence`** - Creates "componentception" (component within component).

### How It Works
```
User selects slot → Immediate hold (heartbeat every 5s)
├─ Frontend: useSlotHold hook
├─ Backend: presence.heartbeat mutation
├─ Cleanup: Scheduled job after 10s timeout
└─ Release: Explicit on navigation OR timeout
```

### Schema
```typescript
presence: {
  resourceId: v.string(),  // "studio-a" (prevents cross-resource contamination)
  slot: v.string(),        // "2025-11-24T10:00:00.000Z" (ISO timestamp)
  user: v.string(),        // Session ID
  updated: v.number(),     // Last heartbeat timestamp
}
// Index: ["resourceId", "slot", "updated"] for range queries
```

### Multi-Slot Batching
**Problem:** 5h booking spans multiple slot intervals → Many separate mutations?
**Solution:** Batched heartbeat - single transaction for all affected slots.

```typescript
// 5h booking starting at 10:00 with 60min intervals
affectedSlots = ["10:00", "11:00", "12:00", "13:00", "14:00"]
heartbeat({ resourceId, slots: affectedSlots, user })  // Single call!
```

**Performance:** 50-87% fewer network requests compared to individual calls.

---

## 🐛 Critical Bug Fixes: The Multi-Duration Saga

### Bug #1: Multi-Duration Overlap (FIXED Nov 24)
**Scenario:**
```
User A: 1h duration, holds 13:00
User B: 5h duration, views calendar
  → Sees 10:00 as available
  → Books 10:00-15:00
  → OVERLAPS with User A's 13:00 hold! ❌
```

**Root Cause:** Frontend only checked per-slot presence, not span conflicts.

**Solution:** Frontend Derivation Pattern
- Backend: `getDatePresence(resourceId, date)` → All active holds for that day
- Frontend: `calculateRequiredSlots(slot, duration)` → Which 15-min chunks needed
- Frontend: `hasPresenceConflict(slot, duration, presence)` → Check overlap
- Result: Slots filtered before display ✅

### Bug #2: Cross-Resource Contamination (FIXED Nov 24)
**Problem:** Presence schema missing `resourceId` field!
```
User A books StudioA at 10:00 → presence.slot = "2025-11-24T10:00:00.000Z"
User B books StudioB at 10:00 → presence.slot = "2025-11-24T10:00:00.000Z"
  → SAME slot identifier! StudioA blocks StudioB! ❌
```

**Solution:**
1. Added `resourceId` field to presence tables
2. Compound index: `["resourceId", "slot", "updated"]`
3. Renamed `room` → `slot` (38 occurrences) to avoid confusion
   - `resourceId` = which resource ("studio-a")
   - `slot` = which time slot ("2025-11-24T10:00:00.000Z")

### Bug #3: Reserved Slot UX (ENHANCED Nov 24)
**Original:** Conflicting slots completely hidden
**Enhanced:** Show reserved slots inline chronologically
```
9:00 AM  [Available]
10:00 AM [Reserved]  ← Held by another user, may become available
11:00 AM [Available]
```

**Why Better Than Cal.com:**
- Cal.com: Slots disappear mysteriously
- Us: Transparency + hints slots might become available (10s timeout)

### Bug #4: Form Infinite Loop (FIXED Nov 26)
**Error:** `Maximum update depth exceeded` in SelectTrigger component
**Scenario:**
```
Event Type Form with resource selection
→ useQuery returns linkedResourceIds (new array reference each time)
→ useEffect syncs to form state
→ Form state change triggers re-render
→ useQuery returns new array reference
→ INFINITE LOOP! ❌
```

**Root Causes:**
1. Convex `useQuery` returns new array references on each subscription update
2. `useEffect` dependency on array triggers on every render
3. Radix UI components in React 19 require proper `React.forwardRef`

**Solution: Container/Presenter Pattern**
```typescript
// BEFORE: Queries inside form (BAD)
function EventTypeForm({ eventTypeId }) {
  const resources = useQuery(api.listResources);  // Reactive!
  const linkedIds = useQuery(api.getLinkedIds);   // Reactive!

  useEffect(() => {
    form.setValue("resourceIds", linkedIds);  // TRIGGERS LOOP!
  }, [linkedIds]);
}

// AFTER: Queries in parent, form receives props (GOOD)
function EditEventTypePage() {
  const resources = useQuery(api.listResources);
  const linkedIds = useQuery(api.getLinkedIds);

  if (!resources || !linkedIds) return <Skeleton />;

  return (
    <EventTypeForm
      availableResources={resources}      // Static prop
      initialResourceIds={linkedIds}      // Static prop
    />
  );
}
```

**Key Insight:** Forms should be "dumb" - receive data as props, not fetch reactively.

---

## 🚀 Key Architectural Pattern: Frontend Derivation

### The Performance Problem
**Naive Approach:** Include presence check in `getDaySlots` query
```
Every heartbeat (5s):
→ Presence updated
→ Invalidates getDaySlots(Nov24, 60min)   ← 1h viewer
→ Invalidates getDaySlots(Nov24, 300min)  ← 5h viewer
→ Invalidates getDaySlots(Nov24, 120min)  ← 2h viewer
→ Result: O(n) query invalidations (n = unique durations) ❌
→ Query thrashing! Database load scales with viewers!
```

### Our Solution: Separate Stable from Volatile
```
Backend (Stable):
├─ getDaySlots(date, duration)
│  └─ Returns slots free from CONFIRMED bookings
│  └─ Changes rarely (only on actual bookings)
│  └─ Duration-specific (60min ≠ 300min queries)
│
└─ getDatePresence(resourceId, date)
   └─ Returns active presence holds
   └─ Changes every 5s (heartbeats)
   └─ SHARED across all durations viewing same date

Frontend (Derived):
└─ Merges both → filters based on span conflicts
   └─ Local computation (<1ms)
```

**Performance:**
```
Every heartbeat (5s):
→ Presence updated
→ Invalidates getDatePresence(Nov24)  ← SINGLE shared query
→ getDaySlots queries untouched (remain cached)
→ Frontend recalculates locally (instant)
→ Result: O(1) invalidation regardless of viewers ✅
```

**Key Insight:** Different durations share the SAME presence query but have DIFFERENT slot queries. Separation = massive cache efficiency.

---

## 📂 File Organization & Critical Paths

### Backend Component (`packages/convex-booking/src/component/`)
```
schema.ts              - Database schema (presence, bookings, daily_availability)
presence.ts            - Heartbeat, leave, cleanup, getDatePresence (range query)
public.ts              - getDaySlots, getMonthAvailability, createBooking
utils.ts               - Slot calculations, bitmap operations, date math
availability.ts        - Core availability logic (isAvailable)
resources.ts           - Resource CRUD operations
schedules.ts           - Schedule management (availability windows)
resource_event_types.ts - Event type ↔ Resource linking (M:N relationship)
hooks.ts               - State machine hooks for booking lifecycle
multi_resource.ts      - Multi-resource booking operations
```

### Client API (`packages/convex-booking/src/client/`)
```
index.ts           - makeBookingAPI() wrapper
                     Exposes: heartbeat, leave, getPresence, getDatePresence
```

### Frontend Hooks (`lib/hooks/`)
```
use-convex-slots.ts    - ⭐ CRITICAL: Presence-aware filtering logic
                         - calculateRequiredSlots() helper
                         - hasPresenceConflict() helper
                         - Splits into availableSlots + reservedSlots
                         - Merges chronologically for display

use-slot-hold.ts       - Multi-slot hold with batching
                         - Calculates affected slots
                         - Batched heartbeat/leave calls
                         - Cleanup on unmount

use-slot-presence.ts   - Per-slot presence check (currently unused)
                         - Kept for potential future per-slot UI indicators
```

### UI Components (`components/booking-calendar/`)
```
calendar.tsx           - Main orchestrator
                         - Fetches month dots + day slots
                         - Intersection observer for lazy loading
                         - State: selectedDate, currentMonth

time-slots-panel.tsx   - Chronological slot rendering
                         - Merges available + reserved slots
                         - Sorts by time
                         - Renders inline (not grouped sections)

time-slot-button.tsx   - Individual slot UI
                         - Props: isReserved (boolean)
                         - Shows "Reserved" label or formatted time
```

### Booker Flow (`components/booker/`)
```
booker.tsx             - 3-step booking flow
                         1. event-meta: Calendar + slot selection
                         2. booking-form: User details
                         3. success: Confirmation screen

                         - Lifts state (date, month, duration, timezone)
                         - Locks duration on slot selection
                         - Triggers useSlotHold for selected slot
```

### Mounting (`convex/`)
```
booking.ts             - Exports component API to main app
                         - makeBookingAPI(components.booking)
                         - Export: getDatePresence, heartbeat, leave, etc.
```

### Admin UI (`app/demo/`)
```
page.tsx               - Dashboard overview
layout.tsx             - Sidebar navigation with shadcn/ui

event-types/
├─ page.tsx            - List all event types
├─ new/page.tsx        - Create event type (Container)
├─ [id]/page.tsx       - Edit event type (Container)
└─ _components/
   └─ event-type-form.tsx  - Shared form (Presenter, no queries!)

resources/page.tsx     - Resource management CRUD
schedules/page.tsx     - Schedule/availability management
bookings/page.tsx      - Booking list and management
```

### Public Booking (`app/book/`)
```
page.tsx               - Resource selection
[resourceId]/page.tsx  - Booker flow for specific resource
```

---

## 🧪 Testing Scenarios (Critical for Verification)

### Scenario 1: Multi-Duration Conflict Detection
**Setup:** User A (1h) holds 13:00
**Test:** User B selects 5h duration, views Nov 24
**Expected:**
- Slots 09:00-12:00 NOT shown (would overlap 13:00 hold)
- Slot 10:00 requires 10:00-15:00 → conflicts with 13:00 hold
- Slots 14:00+ shown (no conflict)

**Verify:**
- DevTools Network: `getDatePresence` called once
- `getDaySlots` NOT invalidated on User A's heartbeat

### Scenario 2: Resource Isolation
**Setup:** User A books StudioA at 10:00
**Test:** User B views StudioB calendar at 10:00
**Expected:** StudioB 10:00 slot shows as available ✅
**Verify:** No cross-contamination (check `resourceId` filtering)

### Scenario 3: Hold Release Reactivity
**Setup:** User A holds 13:00 (1h)
**Test:**
1. User B (5h) sees 10:00-12:00 filtered out
2. User A clicks "Back" → releases hold
3. User B's view updates

**Expected:** Slots 10:00-12:00 immediately reappear
**Verify:** Real-time reactivity without manual refresh

### Scenario 4: Chronological Display
**Setup:** Mixed available/reserved slots
**Expected Order:**
```
9:00 AM  [Available]
10:00 AM [Reserved]
11:00 AM [Available]
12:00 PM [Reserved]
1:00 PM  [Available]
```
NOT grouped: ~~Available section → Reserved section~~

### Scenario 5: Query Caching Performance
**Setup:** 10 users viewing Nov 24 with various durations (1h, 2h, 5h)
**Expected in Convex Dashboard:**
```
getDaySlots(Nov24, 60)  - Called once, cached
getDaySlots(Nov24, 120) - Called once, cached
getDaySlots(Nov24, 300) - Called once, cached
getDatePresence(Nov24)  - Called once, pushed to all 10 users
```

**On User A heartbeat:**
- Only `getDatePresence` invalidates
- `getDaySlots` queries remain cached ✅

---

## ⚠️ Common Pitfalls & Gotchas

### 1. Database Reset Required After Schema Changes
**Problem:** Adding `resourceId`, renaming `room→slot` = breaking schema change
**Solution:** `npx convex data clear --all` then re-seed
**Why:** Existing presence records lack new fields

### 2. Presence Timeout is Fixed at 10 Seconds
**Location:** `packages/convex-booking/src/component/presence.ts:4`
**Cannot change without:** Modifying component source
**Reason:** Hardcoded `TIMEOUT_MS = 10_000`

### 3. Slot Calculations Must Use 15-Min Chunks
**Wrong:** `hours * 60 + minutes` (gives minutes, not slot index)
**Right:** `hours * 4 + Math.floor(minutes / 15)` (gives 0-95 slot index)
**Why:** Bitmap uses 96 discrete slots per day

### 4. Range Queries Require Compound Index
**Query Pattern:**
```typescript
.withIndex("by_resource_slot_updated", (q) =>
  q.eq("resourceId", resourceId)
   .gte("slot", date)
   .lt("slot", date + "\u{FFFF}")
)
```
**Required Index:** `["resourceId", "slot", "updated"]`
**Why:** First field must be `eq()`, subsequent fields can use range

### 5. Reserved vs Available Split Happens in Hook
**Location:** `lib/hooks/use-convex-slots.ts:147-159`
**Pattern:**
```typescript
const available = formatted.filter(slot => !hasPresenceConflict(...))
const reserved = formatted.filter(slot => hasPresenceConflict(...))
return { available, reserved }
```
**Rendering:** Merged chronologically in `time-slots-panel.tsx`

### 6. Duration Lock on Slot Selection
**Critical:** Once user selects slot, duration cannot change
**Why:** Hold is batched across multiple slots
**To change duration:** User must click "Back" and reselect
**Code:** `booker.tsx:108` - `setSelectedDuration(data.duration)` locked

### 7. Radix UI Components Need forwardRef
**Error:** `Maximum update depth exceeded` or `Component is not a function`
**Problem:** Radix UI primitives (Select, Switch, Checkbox) require ref forwarding
**Wrong:**
```typescript
const Select = (props) => <SelectPrimitive.Root {...props} />
```
**Right:**
```typescript
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} {...props} />
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName
```
**Why:** React 19 + Radix UI 2.x requires explicit ref forwarding

### 8. Forms Should Not Have Reactive Queries
**Anti-pattern:** `useQuery` inside form component
**Pattern:** Container/Presenter - parent fetches, form receives props
**Why:** Convex queries return new references → useEffect loops → infinite renders
**Rule:** Forms are "dumb" components that receive initial data as props

---

## 🎓 Key Learnings & Patterns

### Pattern 1: Reactive Data Derivation
**Principle:**
```
Backend = Source of Truth (stable, authoritative)
Frontend = Derived Views (reactive, optimistic)
```

**When to use:**
- Data changes at different rates (bookings vs presence)
- Multiple views need same source data
- Performance requires cache optimization
- Real-time updates are critical

**Convex makes this trivial:**
- Backend: Just return the data
- Frontend: `useQuery + useMemo` = reactive derivation
- Framework handles subscription/invalidation automatically

### Pattern 2: Separation of Concerns for Performance
**Anti-pattern:** Put everything in one query → Convenient but brittle
**Pattern:** Separate stable from volatile → Better caching

**Result:** O(1) invalidation regardless of number of viewers

### Pattern 3: Smart Defaulting
**Problem:** User hasn't selected duration yet, what slot interval to use?
**Solution:**
```typescript
const effectiveInterval = slotInterval ?? (
  allDurationOptions?.length > 0
    ? Math.min(...allDurationOptions)
    : eventLength
)
```
**Logic:** Use minimum duration for maximum booking flexibility (Cal.com best practice)

### Pattern 4: Staleness Management
**Problem:** Query invalidates → UI flashes to loading state → Bad UX
**Solution:** Keep previous data while loading new data
```typescript
const prevSlotsRef = useRef({ available: [], reserved: [] })

useEffect(() => {
  if (processedSlots) {
    prevSlotsRef.current = processedSlots
  }
}, [processedSlots])

const currentData = processedSlots ?? prevSlotsRef.current
```

### Pattern 5: Container/Presenter for Forms
**Problem:** Forms with `useQuery` cause infinite loops due to array reference changes
**Solution:** Separate data fetching (Container) from form rendering (Presenter)

```typescript
// Container: Handles data fetching and loading states
function EditPage({ id }) {
  const data = useQuery(api.getData, { id });
  const related = useQuery(api.getRelated, { id });

  if (!data || !related) return <Skeleton />;

  return <Form initialData={data} relatedItems={related} />;
}

// Presenter: Pure form logic, no queries
function Form({ initialData, relatedItems }) {
  const form = useForm({ defaultValues: initialData });
  // Form never re-renders due to query updates!
}
```

**When to use:**
- Edit forms that load existing data
- Forms with related data (dropdowns, multi-select)
- Any form where you'd be tempted to sync query → state

**Benefits:**
- No useEffect sync needed
- No infinite loop risk
- Clear separation of concerns
- Form only mounts when data is ready

---

## 🚀 Recent Major Work

### Commit 0de2e40: Form Architecture & Schema Simplification (Nov 26, 2025)
**Impact:** 27 files changed, 2,017 insertions, 1,419 deletions

**What We Fixed:**
1. **Form Infinite Loop**
   - Moved queries from `event-type-form.tsx` to parent pages
   - Form now receives `availableResources` and `initialResourceIds` as props
   - Eliminated useEffect sync that caused render loops

2. **Radix UI forwardRef**
   - Fixed Select, Switch, Checkbox components with proper `React.forwardRef`
   - Added `displayName` for React DevTools
   - Compatible with React 19 + Radix UI 2.x

3. **Schema Simplification**
   - Changed `organizationId` from `v.id("organizations")` to `v.string()`
   - Removed deprecated `organizations.ts` (consolidated into resources)
   - Added `resource_event_types.ts` for M:N event type linking

4. **New Public Booking Routes**
   - Added `app/book/` for public-facing booking pages
   - Added `app/book/[resourceId]/page.tsx` for resource-specific booking

**Architecture Pattern Established:**
```
Container (Page)          Presenter (Form)
├─ useQuery(resources)    ├─ Receives props
├─ useQuery(linkedIds)    ├─ No queries
├─ Loading skeleton       ├─ Pure form logic
└─ Passes data as props   └─ Submits mutations
```

---

### Commit 9309894: Presence-Aware Slot Filtering (Nov 24, 2025)
**Impact:** 14 files changed, 1,139 insertions, 86 deletions

**What We Built:**
1. **Schema Migration**
   - Added `resourceId` to presence tables
   - Renamed `room` → `slot` (38 occurrences across 6 files)
   - Updated indexes to compound `["resourceId", "slot", "updated"]`

2. **Backend Query**
   - `getDatePresence` with range query optimization
   - Uses `\u{FFFF}` for efficient date-prefix matching
   - Returns all active holds for a resource+date

3. **Frontend Filtering**
   - `calculateRequiredSlots()` - Maps time+duration → slot indices
   - `hasPresenceConflict()` - Detects span overlaps
   - Dual-state split: `availableSlots` + `reservedSlots`
   - Chronological merge for inline display

4. **UX Enhancement**
   - Reserved slots shown at correct time position
   - "Reserved" label hints at temporary state
   - Real-time reactivity as holds expire

**Before vs After:**
```
BEFORE:
User A: 1h holds 13:00
User B: 5h sees 10:00 → Books → OVERLAP! ❌

AFTER:
User A: 1h holds 13:00
User B: 5h sees [9:00, Reserved 10:00, Reserved 11:00, ...] → No overlap ✅
User B: Slots reactively available when hold expires (10s)
```

---

## 📖 Quick Reference

### Key Concepts
- **Slot:** 15-min time chunk (index 0-95 in a day)
- **Presence:** Temporary 10s hold while user is viewing/selecting
- **Resource:** Bookable entity (e.g., "studio-a", "conference-room-b")
- **Span:** Range of slots a booking occupies (`Math.ceil(duration / 15)`)
- **Quantum:** Atomic time unit (15 minutes)

### Query Hierarchy
```
getMonthAvailability(dateFrom, dateTo, duration)
  ↓ Returns boolean map

getDaySlots(resourceId, date, duration, slotInterval)
  ↓ Returns detailed slots for one day
  ↓ Filtered by CONFIRMED bookings only

getDatePresence(resourceId, date)
  ↓ Returns active holds (presence) for one day
  ↓ Changes every 5s (heartbeats)

Frontend Derivation:
  ↓ Merges getDaySlots + getDatePresence
  ↓ Filters based on span conflicts
  ↓ Splits into availableSlots + reservedSlots
  ↓ Renders chronologically
```

### State Flow
```
User selects slot
  ↓
handleSlotSelect({ slot, duration })
  ↓
setSelectedSlot + setSelectedDuration (LOCKED)
  ↓
useSlotHold triggers (batched heartbeat for all affected slots)
  ↓
Presence created in database
  ↓
getDatePresence invalidates
  ↓
Frontend recalculates conflicts (<1ms)
  ↓
Other users see slot as [Reserved]
  ↓
User clicks "Back" OR timeout (10s)
  ↓
Presence deleted
  ↓
Slot becomes [Available] again
```

---

## 🛠️ Development Workflow

### User Preferences (From `~/.claude/CLAUDE.md`)
- Dev server runs in **separate terminal** (manually started)
- Python runs in venv (manual)
- Use `AskUserQuestion` tool for plan clarifications
- German language ok for communication
- Never auto-start dev servers

### Common Commands
```bash
# Start Convex dev server (in separate terminal)
npx convex dev

# Clear database after schema changes
npx convex data clear --all

# Run Next.js dev server (in separate terminal)
npm run dev

# View Convex dashboard
https://dashboard.convex.dev
```

### Debugging Tips
1. **Check presence records:** Convex Dashboard → `presence` table → filter by `resourceId`
2. **Verify index usage:** Query logs should show "using index by_resource_slot_updated"
3. **Test reactivity:** Open two browser windows, hold slot in one, verify update in other
4. **Invalidation tracking:** Network tab → Watch for `getDatePresence` updates every 5s

---

## 🎯 Philosophy & Vision

### "Vibe-Coder" to Systems Architect
**Who This Is For:** Developers transitioning from No-Code/Low-Code to production-grade systems. Not satisfied with "hello world" demos—wants to understand the **edge** of technology.

### The Convex Paradigm
**Why We Chose Convex:** Eliminates "backend glue" fatigue. Reactivity + ACID transactions = future of database interaction.

### Component Ambition
This is not just app logic—it's a **reusable Convex component** (`@convex-dev/booking`).
**Goal:** Contribute to ecosystem, practice advanced patterns (data boundaries, API design, component composition).

### Superior to Cal.com
- **Cal.com:** User appointments, fragile stack, mysterious slot disappearance
- **Us:** Inventory management, ACID guarantees, real-time transparency, O(1) scaling

---

## 📦 Convex Components Ecosystem (December 2025)

### Component Architecture Overview

Convex supports **composable components** - self-contained packages with their own schemas, tables, and functions that can be nested within each other.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         APP (convexbooking)                          │
│                         convex/convex.config.ts                      │
│                                                                      │
│    app.use(workOSAuthKit)              app.use(booking)              │
│           ↓                                   ↓                      │
│    ┌─────────────────┐              ┌─────────────────────────┐     │
│    │     WorkOS      │              │     Booking Component    │     │
│    │  (NPM package)  │              │      (NPM package)      │     │
│    │  @convex-dev/   │              │     @mrfinch/booking    │     │
│    │  workos-authkit │              │                         │     │
│    │                 │              │  component.use(resend)  │     │
│    │  Own tables:    │              │          ↓              │     │
│    │  • users        │              │   ┌─────────────┐       │     │
│    │  • webhooks     │              │   │   Resend    │       │     │
│    └─────────────────┘              │   │  (nested)   │       │     │
│                                     │   └─────────────┘       │     │
│                                     │                         │     │
│                                     │  Hooks → Emails:        │     │
│                                     │  • booking.created      │     │
│                                     │  • booking.cancelled    │     │
│                                     └─────────────────────────┘     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Definition | Example |
|---------|------------|---------|
| **NPM Component** | Installed via `npm install`, self-contained with own tables | `@convex-dev/workos-authkit`, `@mrfinch/booking` |
| **Local/Sibling Component** | Defined next to `convex/` folder in same repo | Custom component in project |
| **Component Nesting** | `component.use()` for embedding components within components | Resend inside Booking |
| **App Mounting** | `app.use()` for mounting NPM components at app level | Both WorkOS and Booking at Level 1 |

### Nesting Levels

```
Level 0: App (defineApp)
├─ convex/convex.config.ts
├─ Uses: app.use(component)
└─ Mounts NPM components

Level 1: NPM Components (direct mount)
├─ @convex-dev/workos-authkit
├─ @mrfinch/booking
└─ Each has own tables, isolated from app schema

Level 2+: Nested Components (component.use)
├─ @convex-dev/resend (inside booking)
└─ Tables isolated within parent component
```

### Component Configuration Files

**App Level (`convex/convex.config.ts`):**
```typescript
import { defineApp } from "convex/server";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import booking from "@mrfinch/booking/convex.config";

const app = defineApp();
app.use(workOSAuthKit);
app.use(booking);

export default app;
```

**Component Level (`src/component/convex.config.ts`):**
```typescript
import { defineComponent } from "convex/server";
import resend from "@convex-dev/resend/convex.config.js";

const component = defineComponent("booking");
component.use(resend);  // Nesting!

export default component;
```

### Accessing Nested Component APIs

**From component code:**
```typescript
import { components } from "./_generated/api";

// Access nested Resend component
const resend = new Resend(components.resend, { testMode: false });
await resend.sendEmail(ctx, { from, to, subject, html });
```

**From app code:**
```typescript
import { components } from "./_generated/api";

// Access first-level component
const result = await ctx.runQuery(components.booking.resources.listResources, args);

// For WorkOS AuthKit, use the client wrapper
import { authKit } from "./authClient";
const user = await authKit.getAuthUser(ctx);
```

### Component Development Workflow

1. **Build component**: `npm run build` (uses `tsconfig.build.json`)
2. **Generate types**: `npx convex codegen --component-dir ./src/component`
3. **Pack**: `npm pack --ignore-scripts`
4. **Install in app**: `npm install path/to/component-0.x.x.tgz`
5. **Regenerate app types**: `npx convex dev` (runs once to sync)

### WorkOS AuthKit Integration

**Required Setup:**
1. Install: `npm install @convex-dev/workos-authkit`
2. Mount in `convex/convex.config.ts`
3. Create `convex/authClient.ts`:
   ```typescript
   import { AuthKit } from "@convex-dev/workos-authkit";
   import { components } from "./_generated/api";
   export const authKit = new AuthKit(components.workOSAuthKit);
   ```
4. Create `convex/http.ts`:
   ```typescript
   import { httpRouter } from "convex/server";
   import { authKit } from "./authClient";
   const http = httpRouter();
   authKit.registerRoutes(http);
   export default http;
   ```
5. Configure webhook in WorkOS Dashboard:
   - URL: `https://<deployment>.convex.site/workos/webhook`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Set `WORKOS_WEBHOOK_SECRET` env var

### Key Learnings

1. **Components are isolated**: Each component has its own database tables, invisible to parent/siblings
2. **Type generation is critical**: Always run codegen after changing component structure
3. **Webhooks for sync**: NPM components often use webhooks (HTTP routes) for external data sync
4. **Import paths matter**: Use `.js` extensions for component imports due to ESM requirements
5. **Build vs Typecheck**: Build (`tsc --project`) may succeed while typecheck (`tsc --noEmit`) fails - different configs

---

## 📚 References & Inspiration

- **Redis Bitmaps:** O(1) presence checking via bitmasks
- **Ticketmaster Inventory Service:** Separating "Inventory" from "Orders"
- **Cal.com:** Time slot generation logic (adapted to be persisted)
- **Convex Sharded Counter:** Breaking large datasets into write-shards
- **@convex-dev/presence:** Real-time user tracking (integrated directly)

---

## 🔮 Future Enhancements (Out of Scope)

1. **Presence Check in createBooking Mutation**
   - Add backend safety layer: Check presence before booking
   - Defense-in-depth pattern

2. **Optimistic Hold Confirmation**
   - Show "Holding..." state immediately on click
   - Cancel if presence conflict detected

3. **Multi-Date Presence Batching**
   - Batch `getDatePresence` across multiple dates
   - Useful for multi-month calendar views

4. **Analytics & Monitoring**
   - Track conflict rate (how often users click unavailable slots)
   - Measure query cache hit rates
   - Monitor heartbeat performance

5. **NPM Publication**
   - Package `convex-booking` for community use
   - Write comprehensive documentation
   - Create example implementations

---

**Built with 🎵 for the future of booking systems**
*Last Updated: December 3, 2025*
