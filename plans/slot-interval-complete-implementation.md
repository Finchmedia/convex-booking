# Complete Slot Interval Implementation + Multi-Slot Hold Fix

## 🎯 Overview

This plan addresses TWO critical issues discovered in the booking system:

1. **Incomplete Slot Interval Implementation** - Backend supports `slotInterval` but frontend never passes it
2. **Multi-Slot Hold Bug** - When `duration > interval`, only the first slot is held, allowing race conditions

**Impact:** Users see incorrect slot spacing (15-min instead of desired intervals), and multi-hour bookings fail to lock all required slots.

---

## 🧠 Core UX Principle: Duration Lock at Slot Selection

**CRITICAL DESIGN DECISION:**

Duration selection happens in **two distinct phases**:

```
Phase 1: Calendar View (Duration Flexible)
├─ User sees duration options: [1h] [2h] [5h]
├─ User can change selection freely
├─ Available slots update based on selected duration
└─ Duration is NOT committed yet

Phase 2: Slot Selected (Duration LOCKED)
├─ User clicks a time slot (e.g., 10:00 AM)
├─ Duration becomes READ-ONLY immediately
├─ Booking = (slot: "10:00", duration: 120) ← ATOMIC
├─ User navigates to booking form
└─ Duration shown as locked ("2Std" only option)

Phase 3: Booking Form (Duration Display Only)
├─ Duration displayed but NOT editable
├─ User fills name, email, notes
└─ To change duration → Must go back to Phase 1
```

**Why This Matters:**

Allowing duration changes AFTER slot selection creates impossible edge cases:

```typescript
// Scenario: User A on booking form
Selected slot: 10:00 AM
Selected duration: 1 hour (10:00-11:00)

// Available slots: 10:00 ✅, 11:00 ✅, 12:00 ✅, 13:00 ❌ (taken)

// If user could change duration to 5 hours on form:
// Would need 10:00, 11:00, 12:00, 13:00, 14:00
// But 13:00 is TAKEN!
// → Now what? Show error? Re-check availability? Block the action?
// → Nightmare of edge cases ❌
```

**Solution:** Duration is selected BEFORE slot click. Slot click COMMITS that duration.

**Code Implication:**
```typescript
// ❌ WRONG: Duration as reactive dependency
useEffect(() => {
  // Hold logic
}, [slotId, durationMinutes]); // Duration CAN'T change!

// ✅ CORRECT: Duration captured at selection time
useEffect(() => {
  // Hold logic
}, [slotId]); // Only slot changes trigger this
```

---

## 🔍 Problem Analysis

### Issue 1: Slot Interval Not Wired Up

**Backend Status:** ✅ Complete
- Schema has `slotInterval` field
- Queries accept `slotInterval` parameter
- Utils support `intervalMinutes` parameter

**Frontend Status:** ❌ Incomplete
- `useConvexSlots` never passes `slotInterval` to queries
- Calendar component doesn't extract `slotInterval` from eventType
- Mock data missing `slotInterval` field

**Result:** All slots generate every 15 minutes regardless of event configuration.

**Example:**
```typescript
// Event Configuration
{
  lengthInMinutes: 60,
  slotInterval: 60 // Hourly slots
}

// Expected Slots: 09:00, 10:00, 11:00, 12:00...
// Actual Slots:   09:00, 09:15, 09:30, 09:45, 10:00... ❌
```

---

### Issue 2: Multi-Slot Hold Bug

**Current Behavior:**
When a user selects a time slot, `useSlotHold` only sends presence heartbeats to ONE room (the start time).

**The Problem:**
If `selectedDuration > slotInterval`, the booking spans multiple interval slots, but only the first one is held.

**Critical Scenario:**
```typescript
// Event Configuration
slotInterval: 60         // Slots: 10:00, 11:00, 12:00...
lengthInMinutesOptions: [60, 120, 180]

// User Action (Phase 1: Calendar)
User selects 2-hour duration (120 min)
Slots display: 10:00, 11:00, 12:00...

// User Action (Phase 2: Slot Selection)
User clicks 10:00 AM
→ Duration LOCKS to 120 min
→ Booking = (10:00, 120 min)

// Current Hold Behavior ❌
Holds room: "2024-11-24T10:00:00.000Z"
Does NOT hold: "2024-11-24T11:00:00.000Z"

// Result for User B (simultaneous)
10:00 AM slot: ❌ Held (correct)
11:00 AM slot: ✅ Available (WRONG! This causes race condition)

// What Happens
User B: Selects 11:00 with 1h duration → Gets "available" status
User B: Submits booking → Backend REJECTS (busySlots check)
User B: Sees error "Slot no longer available" → Bad UX 😞
```

**Root Cause (use-slot-hold.ts:20):**
```typescript
heartbeat({ room: slotId, user: userId }); // Only ONE room!
```

**Required Fix:**
```typescript
// Calculate affected slots
const intervalsNeeded = Math.ceil(120 / 60); // = 2 slots
const affectedSlots = ["10:00", "11:00"];

// Hold ALL affected slots
affectedSlots.forEach(slot => {
  heartbeat({ room: slot, user: userId });
});
```

---

## 🏗️ Architecture Deep Dive

### Data Flow (Current - Broken)

```
1. app/page.tsx
   └─> selectedDuration (120) - selected in Phase 1
   └─> eventType (has slotInterval: 60)

2. User clicks slot → setSelectedSlot("10:00")

3. Calendar component
   └─> useConvexSlots(resourceId, eventLength) ❌ Missing slotInterval
   └─> useSlotHold(selectedSlot) ❌ Missing duration + interval

4. useConvexSlots hook
   └─> getDaySlots({ eventLength }) ❌ No slotInterval passed
   └─> Backend defaults to 15-min intervals

5. useSlotHold
   └─> heartbeat({ room: "10:00" }) ❌ Only ONE room
```

### Data Flow (Fixed)

```
1. app/page.tsx
   └─> User selects 2h duration in EventMetaPanel
   └─> selectedDuration = 120
   └─> eventType.slotInterval = 60

2. Calendar component
   └─> Extracts slotInterval from eventType
   └─> useConvexSlots(resourceId, eventLength, slotInterval) ✅
   └─> Slots display at 60-min intervals

3. User clicks 10:00 AM slot
   └─> setSelectedSlot("10:00")
   └─> Duration LOCKS to 120
   └─> useSlotHold("10:00", 120, 60) called ✅

4. useSlotHold hook
   └─> Calculates: Math.ceil(120 / 60) = 2 slots needed
   └─> Generates: ["10:00", "11:00"]
   └─> heartbeat({ room: "10:00" }) ✅
   └─> heartbeat({ room: "11:00" }) ✅

5. Booking form
   └─> Duration shown as "2Std" (read-only)
   └─> User fills name, email
   └─> Submit creates booking
```

---

## 🧮 Mathematical Model

### Slot Calculation Logic

```typescript
// Given (captured at slot selection time)
const startTime = "2024-11-24T10:00:00.000Z";
const durationMinutes = 120; // Locked when slot selected
const intervalMinutes = 60;  // From event type config

// Calculate affected slots (done ONCE at selection)
const intervalsNeeded = Math.ceil(durationMinutes / intervalMinutes);
// Math.ceil(120 / 60) = 2 slots

// Generate timestamps
const affectedSlots = [];
for (let i = 0; i < intervalsNeeded; i++) {
  const slotTime = new Date(startTime).getTime() + (i * intervalMinutes * 60 * 1000);
  affectedSlots.push(new Date(slotTime).toISOString());
}

// Result: ["2024-11-24T10:00:00.000Z", "2024-11-24T11:00:00.000Z"]
// These slots are held until user navigates away or submits booking
```

### Edge Case Matrix

| Duration | Interval | Slots Needed | Example Start | Affected Slots |
|----------|----------|--------------|---------------|----------------|
| 60 min   | 60 min   | 1            | 10:00         | [10:00]        |
| 120 min  | 60 min   | 2            | 10:00         | [10:00, 11:00] |
| 180 min  | 60 min   | 3            | 10:00         | [10:00, 11:00, 12:00] |
| 90 min   | 60 min   | 2 (ceil!)    | 10:00         | [10:00, 11:00] |
| 30 min   | 60 min   | 1 (ceil!)    | 10:00         | [10:00]        |
| 45 min   | 30 min   | 2 (ceil!)    | 10:00         | [10:00, 10:30] |

**Key Insight:** Use `Math.ceil()` to handle non-aligned durations. If booking is 90 minutes with 60-minute intervals, it MUST block both the first AND second interval slots.

---

## 📋 Implementation Plan

### Phase 1: Frontend Hook - useConvexSlots (Slot Interval Wiring)

**File:** `lib/hooks/use-convex-slots.ts`

**Changes:**
1. Add `slotInterval` parameter to hook signature
2. Pass `slotInterval` to both query calls
3. Handle undefined `slotInterval` (default to MINIMUM of all duration options)

**Implementation:**

```typescript
export const useConvexSlots = (
  resourceId: string,
  eventLength: number,
  slotInterval?: number, // NEW: Optional interval parameter
  allDurationOptions?: number[], // NEW: All possible durations for smart defaulting
  enabled: boolean = true
): UseConvexSlotsResult => {
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Default slotInterval to MINIMUM of all duration options if not provided
  // This ensures maximum flexibility - all duration options can book at any slot
  const effectiveInterval = slotInterval ?? (
    allDurationOptions && allDurationOptions.length > 0
      ? Math.min(...allDurationOptions)
      : eventLength
  );

  const monthAvailability = useQuery(
    api.booking.getMonthAvailability,
    enabled && dateRange
      ? {
          resourceId,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          eventLength,
          slotInterval: effectiveInterval, // NEW: Pass interval
        }
      : "skip"
  );

  const daySlots = useQuery(
    api.booking.getDaySlots,
    enabled && selectedDateStr
      ? {
          resourceId,
          date: selectedDateStr,
          eventLength,
          slotInterval: effectiveInterval, // NEW: Pass interval
        }
      : "skip"
  );

  // ... rest of hook logic unchanged
};
```

**Why Default to Minimum Duration?**
- **Maximum Flexibility:** All duration options can be booked at any available slot
- **Cal.com Best Practice:** Matches industry standard behavior
- **Example:** `[60, 90, 120]` defaults to 60-min slots → All durations bookable at any hour
- **Backward Compatible:** Single duration events still work (min of 1 value = that value)

---

### Phase 2: Frontend Hook - useSlotHold (Multi-Slot Hold Fix)

**File:** `lib/hooks/use-slot-hold.ts`

**Changes:**
1. Add `durationMinutes` parameter (CAPTURED at slot selection, never changes)
2. Add `intervalMinutes` parameter (with smart default)
3. Calculate all affected interval slots ONCE
4. Loop heartbeat/leave operations over all slots
5. **CRITICAL:** Remove `durationMinutes` from dependency array

**Complete Implementation:**

```typescript
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "../booking/session";

/**
 * Automatically maintains a "hold" on a slot AND all subsequent slots
 * covered by the event duration when duration > interval.
 *
 * IMPORTANT: Duration is LOCKED at slot selection time and never changes.
 * Users cannot change duration after selecting a slot - they must go back
 * to the calendar to select a different duration.
 *
 * @param slotId - The starting slot timestamp (e.g., "2024-11-24T10:00:00.000Z")
 * @param durationMinutes - Total duration of the booking (LOCKED at selection)
 * @param intervalMinutes - Slot interval spacing (e.g., 60). Defaults to durationMinutes.
 */
export function useSlotHold(
  slotId: string | null,
  durationMinutes: number,
  intervalMinutes: number = durationMinutes // Default to duration if not specified
) {
  const heartbeat = useMutation(api.booking.heartbeat);
  const leave = useMutation(api.booking.leave);
  const [userId] = useState(() => getSessionId());

  useEffect(() => {
    if (!slotId) return;

    // Calculate how many interval blocks this booking spans
    // This is done ONCE when slot is selected - duration cannot change after
    const intervalsNeeded = Math.ceil(durationMinutes / intervalMinutes);
    const startTime = new Date(slotId).getTime();

    // Generate all affected slot timestamps
    const affectedSlots: string[] = [];
    for (let i = 0; i < intervalsNeeded; i++) {
      const slotTime = new Date(startTime + i * intervalMinutes * 60 * 1000);
      affectedSlots.push(slotTime.toISOString());
    }

    console.log(
      `[Hold] Locking ${intervalsNeeded} slots for ${durationMinutes}min booking:`,
      affectedSlots.map(s => new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    );

    // 1. Immediate heartbeat to ALL affected slots
    affectedSlots.forEach((slot) => {
      heartbeat({ room: slot, user: userId }).catch((err) => {
        console.error(`[Hold] Failed to hold slot ${slot}:`, err);
      });
    });

    // 2. Periodic heartbeat every 5 seconds to ALL slots
    const interval = setInterval(() => {
      affectedSlots.forEach((slot) => {
        heartbeat({ room: slot, user: userId }).catch((err) => {
          console.error(`[Hold] Heartbeat failed for slot ${slot}:`, err);
        });
      });
    }, 5000);

    // 3. Cleanup: Leave ALL rooms when unmounting or changing slots
    return () => {
      clearInterval(interval);
      console.log(
        `[Hold] Releasing ${affectedSlots.length} slots:`,
        affectedSlots.map(s => new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
      );
      affectedSlots.forEach((slot) => {
        leave({ room: slot, user: userId }).catch((err) => {
          console.error(`[Hold] Failed to leave slot ${slot}:`, err);
        });
      });
    };
  }, [slotId, intervalMinutes, userId, heartbeat, leave]);
  // ☝️ NOTE: durationMinutes intentionally NOT in deps
  // Duration is locked at slot selection and cannot change

  return userId;
}
```

**Critical Dependency Array Decision:**

```typescript
// ❌ WRONG (unnecessary reactivity)
}, [slotId, durationMinutes, intervalMinutes, userId, heartbeat, leave]);

// ✅ CORRECT (reflects actual UX)
}, [slotId, intervalMinutes, userId, heartbeat, leave]);
```

**Why `durationMinutes` is NOT in dependencies:**

1. **UX Reality:** Duration cannot change after slot selection
2. **Code Clarity:** Dependencies should reflect what CAN actually change
3. **Performance:** Avoids unnecessary re-renders/re-holds
4. **Correctness:** Duration is captured in closure at selection time

**If duration were in deps, and somehow changed:**
- useEffect would re-run
- Cleanup would release old holds
- New holds would be created
- But this NEVER HAPPENS in our UX flow!

---

### Phase 3: Calendar Component Integration

**File:** `components/booking-calendar/calendar.tsx`

**Changes:**
1. Extract `slotInterval` from eventType
2. Calculate all duration options (including base duration)
3. Pass slotInterval AND duration options to `useConvexSlots` hook

**Implementation:**

```typescript
export const Calendar: React.FC<CalendarProps> = ({
  resourceId,
  eventTypeId,
  onSlotSelect,
  // ... other props
}) => {
  // ... existing state ...

  // Fetch event type configuration
  const eventType = useQuery(api.booking.getEventType, { eventTypeId });

  // Duration management
  const [selectedDuration, setSelectedDuration] = useState<number>(
    eventType?.lengthInMinutes || 30
  );

  const eventLength = selectedDuration;

  // Extract slot interval AND all duration options (NEW)
  const slotInterval = eventType?.slotInterval;
  const allDurationOptions = eventType
    ? [
        eventType.lengthInMinutes,
        ...(eventType.lengthInMinutesOptions || [])
      ]
    : undefined;

  // ... timezone state ...

  // Use Convex hook for slots data - NOW WITH INTERVAL + DURATION OPTIONS (NEW)
  const { monthSlots, availableSlots, isLoading, isReloading, fetchMonthSlots, fetchSlots } =
    useConvexSlots(
      resourceId,
      eventLength,
      slotInterval,         // NEW: Pass extracted interval (or undefined)
      allDurationOptions,   // NEW: Pass all possible durations for smart defaulting
      hasIntersected
    );

  // ... rest of component unchanged
};
```

**Why Pass All Duration Options?**
- Hook needs all durations to calculate minimum for smart defaulting
- Ensures `[60, 90, 120]` defaults to 60-min intervals
- Provides maximum booking flexibility

---

### Phase 4: App Integration (page.tsx)

**File:** `app/page.tsx`

**Changes:**
1. Add `slotInterval` to MOCK_EVENT_TYPE
2. Update `useSlotHold` call with duration and interval
3. Handle interval from eventType query

**Implementation:**

```typescript
// Update mock data (NEW slotInterval field)
const MOCK_EVENT_TYPE = {
  id: "studio-session",
  slug: "studio-session",
  title: "Studio Session",
  lengthInMinutes: 60,
  lengthInMinutesOptions: [60, 120, 300], // 1h, 2h, 5h
  slotInterval: 60, // NEW: Hourly slots
  description: "Book a recording session at Studio A. Includes engineer and basic mixing.",
  locations: [{ type: "address", address: "123 Studio St, Berlin, Germany", public: true }],
  timezone: "Europe/Berlin",
  lockTimeZoneToggle: false,
};

export default function Home() {
  // Step state
  const [bookingStep, setBookingStep] = useState<BookingStep>("event-meta");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Fetch real event type from DB
  const eventTypeData = useQuery(api.booking.getEventType, { eventTypeId: "studio-session" });
  const eventType = eventTypeData || MOCK_EVENT_TYPE;

  // Extract slot interval with smart defaulting (NEW)
  const slotInterval = eventType.slotInterval ?? (
    eventType.lengthInMinutesOptions && eventType.lengthInMinutesOptions.length > 0
      ? Math.min(...eventType.lengthInMinutesOptions, eventType.lengthInMinutes)
      : eventType.lengthInMinutes
  );

  // Real-time Hold: UPDATED to pass duration and interval
  // Duration is LOCKED once slot is selected
  useSlotHold(
    selectedSlot,
    selectedDuration,    // NEW: Locked at slot selection
    slotInterval         // NEW: From event type config
  );

  // Step 1: Calendar slot selection
  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot); // This LOCKS the duration
    setBookingStep("booking-form");
  };

  // Back to calendar
  const handleBack = () => {
    setBookingStep("event-meta");
    setSelectedSlot(null); // Releases all holds, allows new duration selection
  };

  // ... rest of component unchanged
};
```

**Key Flow:**
1. User picks duration in EventMetaPanel → `setSelectedDuration(120)`
2. User clicks slot → `handleSlotSelect("10:00")` → `setSelectedSlot("10:00")`
3. useSlotHold triggers → Locks 2 slots (10:00, 11:00)
4. User sees booking form with duration read-only
5. User clicks "Zurück" → `handleBack()` → `setSelectedSlot(null)` → Cleanup releases holds

---

## 🧪 Testing Strategy

### Test Scenario 1: Basic Slot Interval

**Setup:**
```typescript
lengthInMinutes: 60
slotInterval: 60
```

**Expected Behavior:**
- ✅ Slots display at: 09:00, 10:00, 11:00, 12:00...
- ✅ No slots at: 09:15, 09:30, 09:45

**Test Steps:**
1. Load calendar
2. Verify slot spacing matches 60 minutes
3. Verify month view dots appear on correct dates

---

### Test Scenario 2: Multi-Slot Hold (2 hours)

**Setup:**
```typescript
lengthInMinutes: 60
lengthInMinutesOptions: [60, 120, 180]
slotInterval: 60
```

**Test Steps:**
1. User selects 2-hour duration option in EventMetaPanel
2. User clicks 10:00 AM slot
3. Verify console log shows: "Locking 2 slots: ['10:00', '11:00']"
4. Open second browser window
5. Verify 10:00 shows "held"
6. Verify 11:00 shows "held" ✅ (This is the fix!)
7. Verify 12:00 shows "available"
8. Verify booking form shows "2Std" (read-only)

**Expected Console Output:**
```
[Hold] Locking 2 slots for 120min booking: ['10:00', '11:00']
```

---

### Test Scenario 3: Multi-Slot Hold (5 hours)

**Setup:**
```typescript
lengthInMinutesOptions: [60, 120, 300]
slotInterval: 60
```

**Test Steps:**
1. User selects 5-hour (300 min) duration
2. User clicks 09:00 AM slot
3. Verify console log shows: "Locking 5 slots: [09:00, 10:00, 11:00, 12:00, 13:00]"
4. In second browser, verify ALL 5 slots show "held"

---

### Test Scenario 4: Non-Aligned Duration

**Setup:**
```typescript
lengthInMinutes: 90
slotInterval: 60
```

**Expected:**
- Slots at: 09:00, 10:00, 11:00...
- User books 09:00 for 90 minutes (09:00-10:30)
- Should hold: [09:00, 10:00] (2 slots via `Math.ceil(90/60) = 2`)

**Test Steps:**
1. User selects 90-minute duration
2. User clicks 09:00 AM slot
3. Verify 2 slots are held (09:00, 10:00)
4. Verify actual booking time: 09:00-10:30

**Rationale:** Even though only 30 minutes of the 10:00 slot is used, the entire 10:00-11:00 block must be reserved to prevent conflicts.

---

### Test Scenario 5: Duration < Interval

**Setup:**
```typescript
lengthInMinutes: 30
slotInterval: 60
```

**Expected:**
- Slots at: 09:00, 10:00, 11:00...
- User books 09:00 for 30 minutes (09:00-09:30)
- Should hold: [09:00] (1 slot via `Math.ceil(30/60) = 1`)

**Test Steps:**
1. Load calendar with 30-min event, 60-min slots
2. User clicks 09:00 AM
3. Verify only 1 slot is held
4. Verify 10:00 shows "available"

---

### Test Scenario 6: Back Button Releases All Holds

**Setup:**
```typescript
lengthInMinutesOptions: [60, 120, 180]
slotInterval: 60
```

**Test Steps:**
1. User selects 2-hour duration
2. User clicks 10:00 AM
3. Verify 2 slots held (10:00, 11:00)
4. User clicks "Zurück" button
5. Verify console shows: "Releasing 2 slots: ['10:00', '11:00']"
6. In second browser, verify both slots now show "available"
7. User selects 1-hour duration
8. User clicks 11:00 AM
9. Verify only 1 slot held (11:00)

**Expected Console Output:**
```
[Hold] Locking 2 slots for 120min booking: ['10:00', '11:00']
[Hold] Releasing 2 slots: ['10:00', '11:00']
[Hold] Locking 1 slots for 60min booking: ['11:00']
```

---

### Test Scenario 7: Missing slotInterval (Backward Compat - Single Duration)

**Setup:**
```typescript
// Old event type without slotInterval field
{
  lengthInMinutes: 60,
  // slotInterval: undefined
  // lengthInMinutesOptions: undefined (no options)
}
```

**Expected Behavior:**
- Default to `lengthInMinutes` (60)
- Slots display at 60-minute intervals
- No errors or warnings

**Test Steps:**
1. Comment out `slotInterval` in mock data
2. Remove `lengthInMinutesOptions`
3. Verify slots still generate correctly at 60-min intervals
4. Verify hold logic works with default

---

### Test Scenario 8: Missing slotInterval with Multiple Durations (Smart Default)

**Setup:**
```typescript
{
  lengthInMinutes: 90,
  lengthInMinutesOptions: [60, 90, 120],
  // slotInterval: undefined (missing!)
}
```

**Expected Behavior:**
- Default to **MINIMUM** duration (60 minutes)
- Slots display at: 09:00, 10:00, 11:00, 12:00...
- All duration options can be booked at any slot

**Test Steps:**
1. Comment out `slotInterval` in mock data
2. Keep `lengthInMinutesOptions: [60, 90, 120]`
3. Verify slots display at 60-min intervals (not 90!)
4. Select 60-min duration, click 10:00 → Verify 1 slot held
5. Go back, select 90-min duration, click 10:00 → Verify 2 slots held
6. Go back, select 120-min duration, click 10:00 → Verify 2 slots held

**Why This Matters:**
- Demonstrates Cal.com best practice
- Shows all durations work at any slot
- Maximum flexibility for bookers

---

## 🚨 Edge Cases & Gotchas

### Edge Case 1: Interval Larger Than Duration
**Scenario:** 30-minute event with 60-minute slots

**What Happens:**
- Slots: 09:00, 10:00, 11:00
- User books 09:00
- Actual time: 09:00-09:30 (only 30 mins)
- Held slots: [09:00]

**Is This Correct?** ✅ YES
- The entire 09:00-10:00 slot must be blocked
- No one else can book at 09:00 (which is the only visible slot anyway)

---

### Edge Case 2: Very Long Booking
**Scenario:** 8-hour event with 60-minute slots

**What Happens:**
- User books 09:00 with 480-minute duration
- `Math.ceil(480 / 60) = 8` slots
- Holds: [09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00]
- 8 heartbeat calls every 5 seconds

**Performance Impact:**
- 8 simultaneous mutations every 5s
- Convex can handle this easily
- If needed, could batch into single mutation with array

**Optimization (Future):**
```typescript
// Instead of:
affectedSlots.forEach(slot => heartbeat({ room: slot, user: userId }))

// Could do:
heartbeatMultiple({ rooms: affectedSlots, user: userId })
```

---

### Edge Case 3: User Navigates Away Quickly
**Scenario:** User clicks slot, immediately closes tab

**What Happens:**
- React cleanup runs
- `leave()` called for all slots
- Presence records deleted
- Other users see slots as available again

**Timing Issue:**
- If tab closes before first heartbeat completes, no hold is created
- This is acceptable (sub-second race condition)

---

### Edge Case 4: slotInterval Not Multiple of 15
**Scenario:** `slotInterval: 40` (not aligned with 15-min chunks)

**What Happens:**
- `generateDaySlots` calculates: `step = Math.ceil(40 / 15) = 3`
- Slots generate every 3 chunks (45 minutes)
- Close enough, but not exact

**Solution (If Needed):**
- Validate slotInterval is multiple of 15 on schema insert
- Or: Add validation in frontend

**Recommendation:** Document that slotInterval should be multiple of 15 (15, 30, 45, 60, 90, 120...).

---

## 📊 Success Criteria

### Functional Requirements
- ✅ Slots display at correct intervals (not defaulting to 15 min)
- ✅ Multi-slot bookings hold ALL affected interval slots
- ✅ Other users see ALL affected slots as locked/held
- ✅ Cleanup removes ALL slot holds on unmount
- ✅ Back button releases ALL holds correctly
- ✅ Duration is read-only on booking form
- ✅ Missing slotInterval defaults to MINIMUM duration (maximum flexibility)

### Technical Requirements
- ✅ No breaking changes to existing bookings table
- ✅ No changes needed to backend schema/queries
- ✅ Backward compatible with events lacking slotInterval
- ✅ Console logs show multi-slot hold operations
- ✅ `durationMinutes` NOT in useEffect dependencies (code reflects UX)

### UX Requirements
- ✅ No visual glitches when slots generate
- ✅ Time slot buttons show correct state (held/available)
- ✅ No race conditions in multi-user scenarios
- ✅ Duration locked on booking form (matches Cal.com)
- ✅ Back button properly resets flow

---

## 🗂️ Files Modified Summary

| File | Changes | Status |
|------|---------|--------|
| `lib/hooks/use-convex-slots.ts` | Add `slotInterval` parameter, pass to queries | 📝 To Modify |
| `lib/hooks/use-slot-hold.ts` | Add multi-slot hold logic, EXCLUDE duration from deps | 📝 To Modify |
| `components/booking-calendar/calendar.tsx` | Extract slotInterval, pass to hook | 📝 To Modify |
| `app/page.tsx` | Update mock data, update useSlotHold call | 📝 To Modify |
| `packages/convex-booking/src/component/schema.ts` | No changes needed | ✅ Already Complete |
| `packages/convex-booking/src/component/public.ts` | No changes needed | ✅ Already Complete |
| `packages/convex-booking/src/component/utils.ts` | No changes needed | ✅ Already Complete |

**Total Files to Modify:** 4 files

---

## 🚀 Implementation Checklist

### Phase 1: Hook Updates (Core Logic)
- [ ] Update `lib/hooks/use-convex-slots.ts`
  - [ ] Add `slotInterval?: number` parameter
  - [ ] Add `allDurationOptions?: number[]` parameter
  - [ ] Implement smart defaulting: `Math.min(...allDurationOptions)` if no slotInterval
  - [ ] Pass `effectiveInterval` to `getMonthAvailability` query
  - [ ] Pass `effectiveInterval` to `getDaySlots` query
  - [ ] Test with explicit interval value
  - [ ] Test with undefined + single duration (should default to that duration)
  - [ ] Test with undefined + multiple durations (should default to minimum)

- [ ] Update `lib/hooks/use-slot-hold.ts`
  - [ ] Add `durationMinutes: number` parameter
  - [ ] Add `intervalMinutes: number` parameter with default
  - [ ] Implement `intervalsNeeded = Math.ceil(duration / interval)`
  - [ ] Implement loop to generate affected slots
  - [ ] Update heartbeat to loop over all slots
  - [ ] Update cleanup to leave all slots
  - [ ] Add console logging for debugging
  - [ ] **CRITICAL:** Remove `durationMinutes` from dependency array
  - [ ] Add JSDoc explaining why duration not in deps
  - [ ] Test with 1 slot (60/60)
  - [ ] Test with 2 slots (120/60)
  - [ ] Test with 5 slots (300/60)
  - [ ] Test with non-aligned (90/60)

### Phase 2: Component Integration
- [ ] Update `components/booking-calendar/calendar.tsx`
  - [ ] Extract `slotInterval` from eventType
  - [ ] Calculate `allDurationOptions` array (base + options)
  - [ ] Pass both `slotInterval` and `allDurationOptions` to `useConvexSlots` hook
  - [ ] Verify slots display at correct spacing (minimum of durations if no explicit interval)

- [ ] Update `app/page.tsx`
  - [ ] Add `slotInterval: 60` to MOCK_EVENT_TYPE
  - [ ] Extract `slotInterval` from eventType query result
  - [ ] Implement smart defaulting with `Math.min(...lengthInMinutesOptions, lengthInMinutes)`
  - [ ] Update `useSlotHold` call with 3 parameters (slot, duration, interval)
  - [ ] Test seed button with new data

### Phase 3: Testing & Validation
- [ ] Test Scenario 1: Basic slot interval (60-min slots)
- [ ] Test Scenario 2: Multi-slot hold (2-hour booking)
- [ ] Test Scenario 3: Multi-slot hold (5-hour booking)
- [ ] Test Scenario 4: Non-aligned duration (90-min event)
- [ ] Test Scenario 5: Duration < Interval (30-min event, 60-min slots)
- [ ] Test Scenario 6: Back button releases all holds
- [ ] Test Scenario 7: Missing slotInterval (backward compat - single duration)
- [ ] Test Scenario 8: Missing slotInterval with multiple durations (smart default to min)
- [ ] Test Edge Case 1: Interval larger than duration
- [ ] Test Edge Case 2: Very long booking (8+ hours)
- [ ] Test Multi-user: User A holds, User B sees locked

### Phase 4: Documentation
- [ ] Update README with slotInterval behavior
- [ ] Document multi-slot hold mechanism
- [ ] Add comments explaining Math.ceil logic
- [ ] Document duration lock UX pattern
- [ ] Add JSDoc to useSlotHold explaining dependency decision

---

## 🎓 Key Learnings / Design Decisions

### 1. Why Duration NOT in useEffect Dependencies?

**Decision:** `}, [slotId, intervalMinutes, userId, heartbeat, leave]);`

**Rationale:**
- **UX Reality:** Duration cannot change after slot selection
- **Code Clarity:** Dependencies should reflect what CAN actually change
- **Performance:** Avoids unnecessary re-renders
- **Correctness:** Duration is captured in closure at selection time

**Alternative Considered:** Include `durationMinutes` in deps "just in case"
- ❌ Violates principle: code should reflect intent
- ❌ Misleads future developers about UX constraints
- ❌ Unnecessary reactivity
- Rejected

**The Rule:** If something CAN'T change in your UX, don't pretend it can in your code.

---

### 2. Why Default slotInterval to MINIMUM Duration?

**Decision:**
```typescript
const effectiveInterval = slotInterval ?? (
  allDurationOptions && allDurationOptions.length > 0
    ? Math.min(...allDurationOptions)
    : eventLength
)
```

**Rationale:**
- **Maximum Flexibility:** All duration options can be booked at any slot
- **Cal.com Best Practice:** Industry standard approach
- **Example Scenario:**
  ```
  lengthInMinutesOptions: [60, 90, 120]
  Default: 60-min intervals

  Slots: 09:00, 10:00, 11:00, 12:00...

  ✅ 60-min booking at 10:00 → Holds [10:00]
  ✅ 90-min booking at 10:00 → Holds [10:00, 11:00]
  ✅ 120-min booking at 10:00 → Holds [10:00, 11:00]
  ```
- **Backward Compatible:** Single duration events use that duration (min of 1 value)

**Alternative Considered:** Default to selected duration
```typescript
const effectiveInterval = slotInterval ?? selectedDuration
```
- ❌ Creates availability gaps: 120-min duration → 2-hour slots
- ❌ 60-min booking can't fit at 10:00 if slots are [09:00, 11:00, 13:00]
- ❌ Loses flexibility
- Rejected

---

### 3. Why Use Math.ceil() Instead of Math.floor()?

**Decision:** `const intervalsNeeded = Math.ceil(durationMinutes / intervalMinutes)`

**Rationale:**
- 90-minute booking with 60-minute slots = 1.5 → **Must round UP to 2**
- If we used `Math.floor()`, would only hold 1 slot
- Second slot (11:00-12:00) would show available
- Race condition occurs

**Example:**
```typescript
// Wrong:
Math.floor(90 / 60) = 1 slot held
// Booking at 10:00 for 90 min (10:00-11:30)
// 11:00 slot shows available → RACE CONDITION ❌

// Correct:
Math.ceil(90 / 60) = 2 slots held
// Booking at 10:00 for 90 min (10:00-11:30)
// Both 10:00 and 11:00 slots show held → SAFE ✅
```

---

### 4. Why Not Batch Heartbeats Into Single Mutation?

**Decision:** Call `heartbeat()` separately for each slot

**Current Approach:**
```typescript
affectedSlots.forEach(slot => {
  heartbeat({ room: slot, user: userId });
});
```

**Alternative (Batched):**
```typescript
heartbeatMultiple({ rooms: affectedSlots, user: userId });
```

**Why Current Approach:**
- Simpler to implement (no backend changes)
- Reuses existing presence logic
- Performance is acceptable (8 mutations every 5s is trivial for Convex)
- Can optimize later if needed

**Future Optimization Path:**
- Add `heartbeatMultiple` mutation to component
- Loop inside backend (single transaction)
- Reduces network overhead

---

## 🔮 Future Enhancements

### 1. Batch Heartbeat Mutation
Add `heartbeatMultiple` to reduce network calls:

```typescript
// Backend: presence.ts
export const heartbeatMultiple = mutation({
  args: {
    rooms: v.array(v.string()),
    user: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const room of args.rooms) {
      // Same logic as heartbeat, but in loop
    }
  },
});
```

### 2. Visual Indicator for Multi-Slot Bookings
Show which slots are part of the same booking:

```typescript
// In time-slot-button.tsx
{isPartOfMultiSlotBooking && (
  <div className="absolute top-1 right-1">
    <LinkIcon className="h-3 w-3 text-blue-400" />
  </div>
)}
```

### 3. slotInterval Validation
Prevent invalid intervals at creation time:

```typescript
// In createEventType mutation
if (args.slotInterval && args.slotInterval % 15 !== 0) {
  throw new Error("slotInterval must be multiple of 15 minutes");
}
```

---

## ⚠️ Breaking Changes

**None.** This implementation is fully backward compatible:

- ✅ Events without `slotInterval` default to MINIMUM of all durations (or single duration if no options)
- ✅ Existing bookings table unchanged
- ✅ Existing queries work without changes
- ✅ Frontend components work with old event types
- ✅ Single-duration events behave identically (min of 1 value = that value)

---

## 🎯 Definition of Done

This implementation is **COMPLETE** when:

1. ✅ User loads calendar with `slotInterval: 60` → Sees slots at 10:00, 11:00, 12:00 (not every 15 min)
2. ✅ User selects 2-hour duration, clicks 10:00 → Console shows "Locking 2 slots"
3. ✅ Second user opens calendar → Sees 10:00 AND 11:00 as "held"
4. ✅ First user clicks "Zurück" → Console shows "Releasing 2 slots", both become available
5. ✅ Booking form shows duration as read-only ("2Std" only)
6. ✅ User changes duration before slot selection → New duration used for next selection
7. ✅ Event with `lengthInMinutesOptions: [60, 90, 120]` and no slotInterval → Slots display at 60-min intervals (minimum)
8. ✅ All three durations (60, 90, 120) can be booked at any 60-min slot → Maximum flexibility
9. ✅ 90-minute booking with 60-minute slots → Correctly holds 2 slots (Math.ceil)
10. ✅ All tests pass without race conditions

---

**End of Plan** ✅
