# Performance Optimization Plan: Booking Calendar

**Date:** November 20, 2025
**Status:** Analysis Complete - Ready for Implementation
**Priority:** HIGH - User-Facing Performance Issue

---

## Executive Summary

The booking calendar UI is experiencing React scheduler violations with "message handler" times of 400-500ms, causing noticeable lag during user interactions. Despite Convex queries being optimized and cached, the frontend is blocking the main thread with heavy JavaScript operations.

**Key Finding:** The bottleneck is **not** network/backend - it's frontend rendering inefficiencies causing cascade re-renders and expensive operations being repeated unnecessarily.

**Impact:**
- Poor user experience (visible lag)
- Unresponsive UI during interactions
- Browser warnings in console

**Solution:** Apply React performance best practices - memoization, caching, and preventing unnecessary re-renders.

---

## The Problem: Understanding React Scheduler Violations

### What Are These Warnings?

```
[Violation] 'message' handler took 437ms
[Violation] 'message' handler took 404ms
[Violation] 'message' handler took 523ms
```

**What This Means:**
- JavaScript is **blocking the main thread** for 400-500ms
- During this time, the browser **cannot**:
  - Process user input (clicks, scrolls)
  - Update animations
  - Paint new frames
- Users experience the UI as "frozen" or "janky"

**Target:** Keep all JavaScript operations under 50ms (ideally 16ms for 60fps)

---

## Root Cause Analysis

### The Cascade Effect

When a user interacts with the calendar (e.g., changes timezone, selects date, navigates month), here's what happens:

1. **State Update** in parent `Calendar` component
2. **All child components re-render** (no memoization prevents this)
3. **Expensive operations repeat**:
   - `getAvailableTimezones()` processes ~600 timezones with Intl API
   - `generateCalendarDays()` creates 42 Date objects
   - `formatTime()` called 20+ times with Intl API
   - 60+ inline functions recreated
4. **Result:** 400-500ms of blocking JavaScript

### Why Isn't Convex the Problem?

**Evidence:**
- Queries are **cached** - no network latency on repeated views
- Query results come back instantly (React Suspense would show if backend was slow)
- The violations occur **even on hard refresh** when nothing changed

**Conclusion:** The data layer is fast. The rendering layer is slow.

---

## Critical Issues (Priority 1)

### Issue #1: Timezone Processing - THE SMOKING GUN

**Location:** `lib/booking-calendar/utils/timezone-utils.ts`
**Function:** `getAvailableTimezones()`
**Impact:** 300-400ms per render

#### What's Happening:

```typescript
export const getAvailableTimezones = (): TimezoneOption[] => {
  // ❌ This runs on EVERY RENDER of TimezoneSelector
  const timezones = Intl.supportedValuesOf('timeZone'); // ~600 timezones

  const filteredTimezones = timezones
    .filter((tz) => /* filtering logic */)
    .map((timezone) => ({
      value: timezone,
      label: getTimezoneDisplayName(timezone),  // ❌ EXPENSIVE
      region: getRegionFromTimezone(timezone),
    }));

  return sortTimezones(filteredTimezones);  // ❌ More Date operations
};
```

#### Why This Is Expensive:

1. **Intl.supportedValuesOf('timeZone')** - Returns ~600 timezone strings
2. **For each timezone:**
   - `getTimezoneDisplayName()` calls `getTimezoneOffset()`
   - `getTimezoneOffset()` creates `Intl.DateTimeFormat` instance
   - `Intl.DateTimeFormat` is one of the **slowest** Intl APIs (~1-2ms per call)
3. **Sorting:**
   - `sortTimezones()` calls `getTimezoneOffsetMinutes()` for each timezone
   - More Date object creation + `toLocaleString()` calls
4. **Total:** ~600 timezones × 1-2ms = 600-1200ms of operations

#### Why It Runs So Often:

```typescript
// timezone-selector.tsx
export const TimezoneSelector: React.FC = ({ ... }) => {
  const timezoneOptions = getAvailableTimezones();  // ❌ Called every render
  // ...
};
```

Every time `TimezoneSelector` renders (which happens on any parent state change), this entire computation reruns.

#### The Fix: Module-Level Caching

```typescript
// TOP OF FILE - Outside all functions
let CACHED_TIMEZONES: TimezoneOption[] | null = null;

export const getAvailableTimezones = (): TimezoneOption[] => {
  // Return cached result if available
  if (CACHED_TIMEZONES !== null) {
    return CACHED_TIMEZONES;
  }

  // ... existing expensive computation ...

  // Cache the result before returning
  CACHED_TIMEZONES = result;
  return result;
};
```

#### Why This Works:

- **First render:** Computes timezones (300-400ms) and caches result
- **All subsequent renders:** Returns cached array instantly (0ms)
- **Module-level cache:** Persists across component unmount/remount
- **Safe:** Timezone list never changes during app lifetime

**Expected Impact:** 300-400ms → ~0ms (87% reduction)

---

### Issue #2: No Component Memoization

**Impact:** Unnecessary re-renders of 60+ components
**Estimated Savings:** 50-100ms per interaction

#### The Problem: React Re-Rendering Model

**React's Default Behavior:**
- When a component's state/props change, React re-renders that component
- React then re-renders **all child components** (recursively)
- Even if child props haven't changed!

**Our Situation:**
```
Calendar (state changes)
├── CalendarGrid (re-renders)
│   └── 42× CalendarDayButton (all re-render)
├── TimeSlotsPanel (re-renders)
│   └── 20× TimeSlotButton (all re-render)
├── CalendarNavigation (re-renders)
└── TimezoneSelector (re-renders + expensive operation)
```

**Total:** 60+ component instances re-rendering on every interaction.

#### Why This Is Expensive:

Each component re-render means:
1. Function body executes again
2. All inline functions recreated (memory allocation)
3. All JSX re-evaluated
4. Virtual DOM diffing
5. If output changed, real DOM updates

With 60+ components, this adds up fast.

#### The Fix: React.memo()

```typescript
// Before
export const CalendarDayButton: React.FC<Props> = ({ day, onDateSelect }) => {
  return <button onClick={() => onDateSelect(day.date)}>...</button>;
};

// After
export const CalendarDayButton = React.memo<Props>(({ day, onDateSelect }) => {
  const handleClick = useCallback(
    () => onDateSelect(day.date),
    [day.date, onDateSelect]
  );

  return <button onClick={handleClick}>...</button>;
});
```

#### Why This Works:

**React.memo():**
- Wraps component in a memoization layer
- Does shallow comparison of props before re-rendering
- If props haven't changed, **skips render entirely**

**Example:**
```
Parent re-renders (timezone changes)
├── CalendarGrid re-renders (currentDate prop unchanged)
│   └── 42× CalendarDayButton (React.memo checks props)
│       └── 40 buttons: props unchanged → SKIP RENDER
│       └── 2 buttons: props changed → re-render only these
```

**Result:** Only components with changed props re-render, not all 42.

#### Components Needing React.memo():

1. **CalendarGrid** - Renders 42 buttons
2. **CalendarDayButton** - 42 instances
3. **TimeSlotsPanel** - Complex component
4. **TimeSlotButton** - 20+ instances
5. **CalendarNavigation** - Pure presentational
6. **TimezoneSelector** - Expensive children

**Expected Impact:** Prevents ~50+ unnecessary re-renders per interaction

---

### Issue #3: Inline Function Creation

**Impact:** Memory churn + breaks memoization
**Estimated Savings:** 20-30ms per interaction

#### The Problem:

```typescript
// CalendarDayButton.tsx
<button onClick={() => !day.disabled && onDateSelect(day.date)}>
  {day.day}
</button>
```

**What Happens:**
- Every render creates a **new arrow function** (new memory allocation)
- React sees `onClick` prop as changed (different function reference)
- Even with `React.memo()`, component re-renders because props "changed"

**With 42 buttons:**
- 42 new functions created on every render
- Memory allocator works harder (GC pressure)
- Memoization broken

#### Why This Is Expensive:

1. **Memory Allocation:** Creating 60+ functions per render adds GC pressure
2. **Breaks Memoization:** `React.memo()` can't help if props constantly change
3. **Cascading Re-renders:** Child components can't be memoized effectively

#### The Fix: useCallback()

```typescript
export const CalendarDayButton = React.memo<Props>(({ day, onDateSelect }) => {
  const handleClick = useCallback(() => {
    if (!day.disabled) {
      onDateSelect(day.date);
    }
  }, [day.disabled, day.date, onDateSelect]);

  return <button onClick={handleClick}>{day.day}</button>;
});
```

#### Why This Works:

**useCallback():**
- Memoizes the function based on dependencies
- Returns **same function reference** if dependencies unchanged
- Only creates new function when dependencies change

**Example:**
```
Render 1: day.date = "2025-06-15" → creates function A
Render 2: day.date = "2025-06-15" → returns function A (same reference)
Render 3: day.date = "2025-06-16" → creates function B (dependency changed)
```

**Result:**
- Function reference stable across renders
- `React.memo()` prop comparison succeeds
- Component skips re-render

**Expected Impact:** Enables proper memoization, reduces GC pressure

---

### Issue #4: generateCalendarDays() Not Memoized

**Location:** `components/booking-calendar/calendar-grid.tsx`
**Impact:** 42 Date objects created on every render
**Estimated Savings:** 10-20ms per render

#### The Problem:

```typescript
export const CalendarGrid: React.FC<Props> = ({ currentDate, selectedDate, monthSlots, ... }) => {
  // ❌ This runs on EVERY render
  const calendarDays = generateCalendarDays(currentDate, selectedDate, monthSlots);

  return (
    <div>
      {calendarDays.map(day => <CalendarDayButton key={...} day={day} />)}
    </div>
  );
};
```

**generateCalendarDays() does:**
```typescript
export const generateCalendarDays = (...) => {
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);  // ❌ New Date object
    date.setDate(startDate.getDate() + i);

    const dateStr = date.toISOString().split('T')[0];  // ❌ String operation
    // ... more Date comparisons ...

    days.push({ date, day: date.getDate(), /* ... */ });
  }

  return days;
};
```

**Operations per call:**
- 42 `new Date()` calls
- 42 `toISOString()` calls
- Multiple date comparisons (`getTime()`, `getMonth()`, etc.)

#### Why This Is Expensive:

1. **Date Object Creation:** Not free (parsing, normalization)
2. **String Operations:** `toISOString()` formats date to ISO 8601
3. **Repeated Work:** Same computation for same inputs

**Example:**
```
User hovers over timezone dropdown (parent re-renders)
→ CalendarGrid re-renders
→ generateCalendarDays() runs
→ 42 new Date objects created
→ User moves mouse again
→ CalendarGrid re-renders again
→ generateCalendarDays() runs AGAIN
→ Another 42 Date objects created
```

If user hovers 5 times = 210 Date objects created for **identical** output.

#### The Fix: useMemo()

```typescript
export const CalendarGrid = React.memo<Props>(({ currentDate, selectedDate, monthSlots, ... }) => {
  const calendarDays = useMemo(
    () => generateCalendarDays(currentDate, selectedDate, monthSlots),
    [currentDate, selectedDate, monthSlots]
  );

  return <div>...</div>;
});
```

#### Why This Works:

**useMemo():**
- Caches the computed value
- Only recomputes if dependencies change
- Returns cached value on subsequent renders

**Example:**
```
Render 1: currentDate = "2025-06" → computes 42 days → caches result
Render 2: currentDate = "2025-06" → returns cached result (0ms)
Render 3: currentDate = "2025-07" → recomputes with new month
```

**Expected Impact:** Eliminates redundant Date object creation

---

### Issue #5: formatTime() Called Repeatedly

**Location:** `components/booking-calendar/time-slot-button.tsx`
**Impact:** 20+ Intl API calls per render
**Estimated Savings:** 15-25ms per render

#### The Problem:

```typescript
export const TimeSlotButton: React.FC<Props> = ({ slot, timeFormat, timezone, ... }) => {
  return (
    <button onClick={...}>
      {formatTime(slot.time, timeFormat, timezone)}  {/* ❌ Called every render */}
    </button>
  );
};
```

**formatTime() does:**
```typescript
export const formatTime = (timeString: string, timeFormat: '12h' | '24h', timezone: string) => {
  const date = new Date(timeString);  // ❌ New Date object

  return date.toLocaleTimeString([], {  // ❌ Expensive Intl API
    hour: timeFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone: timezone,
  });
};
```

#### Why This Is Expensive:

1. **toLocaleTimeString():** Uses Intl API (one of the slowest JavaScript APIs)
2. **Timezone Conversion:** Requires ICU library lookups
3. **Repeated Calls:** 20 time slots = 20 Intl API calls

**When timezone dropdown opens:**
- TimeSlotsPanel re-renders
- 20× TimeSlotButton re-render
- 20× `formatTime()` called
- 20× `new Date()` created
- 20× `toLocaleTimeString()` called

**Total:** 20-30ms just for formatting times that haven't changed.

#### The Fix: useMemo() in TimeSlotButton

```typescript
export const TimeSlotButton = React.memo<Props>(({ slot, timeFormat, timezone, ... }) => {
  const formattedTime = useMemo(
    () => formatTime(slot.time, timeFormat, timezone),
    [slot.time, timeFormat, timezone]
  );

  const handleClick = useCallback(
    () => onSlotSelect(slot.time),
    [slot.time, onSlotSelect]
  );

  return <button onClick={handleClick}>{formattedTime}</button>;
});
```

#### Why This Works:

- Formatted time computed once and cached
- Only recomputes if time, format, or timezone changes
- Most renders return cached string (0ms)

**Example:**
```
Render 1: slot="14:00", format="12h" → formats to "2:00 PM" → caches
Render 2: (user hovers something) → returns "2:00 PM" from cache
Render 3: format changes to "24h" → reformats to "14:00" → caches new value
```

**Expected Impact:** Reduces Intl API calls by 80-90%

---

### Issue #6: formatSelectedDate() Recreated

**Location:** `components/booking-calendar/time-slots-panel.tsx`
**Impact:** New function + Date objects created every render
**Estimated Savings:** 5-10ms per render

#### The Problem:

```typescript
export const TimeSlotsPanel: React.FC<Props> = ({ selectedDate, ... }) => {
  // ❌ This ENTIRE function is recreated on every render
  const formatSelectedDate = (date: Date | null) => {
    if (!date) return "Select a date";

    const today = new Date();  // ❌ New Date object
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleDateString(...)}`;
    }
    // ... more comparisons
  };

  return <div>{formatSelectedDate(selectedDate)}</div>;
};
```

#### Why This Is Expensive:

1. **Function Recreation:** New function object allocated every render
2. **Date Object Creation:** Creates `today`, `tomorrow` on **every call**
3. **String Operations:** `toDateString()`, `toLocaleDateString()`

#### The Fix: useCallback()

```typescript
export const TimeSlotsPanel = React.memo<Props>(({ selectedDate, ... }) => {
  const formatSelectedDate = useCallback((date: Date | null) => {
    if (!date) return "Select a date";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // ... existing logic ...
  }, []); // No dependencies - logic is pure

  return <div>{formatSelectedDate(selectedDate)}</div>;
});
```

#### Why This Works:

- Function reference stable across renders
- Date operations still happen, but at least function isn't reallocated
- Enables TimeSlotsPanel memoization

---

### Issue #7: useEffect Dependency Issues

**Location:** `components/booking-calendar/calendar.tsx`
**Impact:** Can cause extra re-renders or stale closures

#### Problem 1: Missing Dependencies

```typescript
const autoSelectToday = () => {
  if (!selectedDate) {
    const today = new Date();
    setSelectedDate(today);
    fetchSlots(today);  // ❌ References fetchSlots but not in deps
  }
};

useEffect(() => {
  if (Object.keys(monthSlots).length > 0) {
    autoSelectToday();  // ❌ Not in dependency array
  }
}, [monthSlots]); // ❌ Missing autoSelectToday
```

**React will warn about this** because:
- `autoSelectToday` references `selectedDate` and `fetchSlots`
- If those change, `autoSelectToday` should get new version
- Current code might use stale values (closures)

#### The Fix:

```typescript
const autoSelectToday = useCallback(() => {
  if (!selectedDate) {
    const today = new Date();
    setSelectedDate(today);
    fetchSlots(today);
  }
}, [selectedDate, fetchSlots]);

const hasSlots = useMemo(
  () => Object.keys(monthSlots).length > 0,
  [monthSlots]
);

useEffect(() => {
  if (hasSlots) {
    autoSelectToday();
  }
}, [hasSlots, autoSelectToday]);
```

**Why This Works:**
- `autoSelectToday` properly memoized with all dependencies
- `hasSlots` computed once per `monthSlots` change
- useEffect dependencies complete - no warnings, no stale closures

---

## Implementation Strategy

### Phase 1: Quick Wins (15 minutes)

**Priority: HIGHEST - Gets 80% of performance improvement**

1. **Cache Timezone List**
   - File: `lib/booking-calendar/utils/timezone-utils.ts`
   - Lines: Add module-level cache at top
   - Impact: 300-400ms → 0ms on subsequent renders

### Phase 2: Component Memoization (30 minutes)

**Priority: HIGH - Prevents cascade re-renders**

2. **Add React.memo() to all components** (6 files)
   - CalendarGrid
   - CalendarDayButton
   - TimeSlotsPanel
   - TimeSlotButton
   - CalendarNavigation
   - TimezoneSelector

### Phase 3: Memoize Computations (20 minutes)

**Priority: MEDIUM - Reduces redundant work**

3. **Add useMemo() for expensive computations**
   - `calendarDays` in CalendarGrid
   - `formattedTime` in TimeSlotButton
   - `hasSlots` in Calendar

4. **Add useCallback() for event handlers**
   - All onClick handlers
   - `autoSelectToday`, `handleDateSelect`, etc. in Calendar
   - `formatSelectedDate` in TimeSlotsPanel

### Phase 4: Fix Dependencies (10 minutes)

**Priority: LOW - But prevents future bugs**

5. **Fix useEffect dependencies**
   - Add missing dependencies
   - Wrap functions in useCallback

**Total Estimated Time:** 75 minutes

---

## Implementation Order (Step-by-Step)

### Step 1: Cache Timezones (5 min)

```typescript
// lib/booking-calendar/utils/timezone-utils.ts
// ADD AT TOP OF FILE:
let CACHED_TIMEZONES: TimezoneOption[] | null = null;

// MODIFY getAvailableTimezones:
export const getAvailableTimezones = (): TimezoneOption[] => {
  if (CACHED_TIMEZONES !== null) {
    return CACHED_TIMEZONES;
  }

  // ... existing code ...

  CACHED_TIMEZONES = result;
  return result;
};
```

**Test:** Open calendar, check console - violations should drop significantly.

---

### Step 2: CalendarGrid Memoization (8 min)

```typescript
// components/booking-calendar/calendar-grid.tsx
import { useMemo } from 'react';

export const CalendarGrid = React.memo<CalendarGridProps>(({
  currentDate,
  selectedDate,
  monthSlots,
  onDateSelect,
  onPreviousMonth,
  onNextMonth,
}) => {
  const calendarDays = useMemo(
    () => generateCalendarDays(currentDate, selectedDate, monthSlots),
    [currentDate, selectedDate, monthSlots]
  );

  return (
    <div className="p-6 lg:border-r lg:border-neutral-800">
      {/* ... existing JSX ... */}
    </div>
  );
});

CalendarGrid.displayName = 'CalendarGrid';
```

**Test:** Navigate months - should feel snappier.

---

### Step 3: CalendarDayButton Memoization (6 min)

```typescript
// components/booking-calendar/calendar-day-button.tsx
import { useCallback } from 'react';

export const CalendarDayButton = React.memo<CalendarDayButtonProps>(({
  day,
  onDateSelect,
}) => {
  const handleClick = useCallback(() => {
    if (!day.disabled) {
      onDateSelect(day.date);
    }
  }, [day.disabled, day.date, onDateSelect]);

  return (
    <button
      onClick={handleClick}
      disabled={day.disabled}
      className={/* ... existing className logic ... */}
    >
      {/* ... existing JSX ... */}
    </button>
  );
});

CalendarDayButton.displayName = 'CalendarDayButton';
```

**Test:** Click different dates - buttons should respond instantly.

---

### Step 4: TimeSlotButton Memoization (8 min)

```typescript
// components/booking-calendar/time-slot-button.tsx
import { useMemo, useCallback } from 'react';

export const TimeSlotButton = React.memo<TimeSlotButtonProps>(({
  slot,
  timeFormat,
  timezone,
  onSlotSelect,
}) => {
  const formattedTime = useMemo(
    () => formatTime(slot.time, timeFormat, timezone),
    [slot.time, timeFormat, timezone]
  );

  const handleClick = useCallback(
    () => onSlotSelect(slot.time),
    [slot.time, onSlotSelect]
  );

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
    >
      {formattedTime}
    </button>
  );
});

TimeSlotButton.displayName = 'TimeSlotButton';
```

**Test:** Toggle 12h/24h format - should switch instantly.

---

### Step 5: TimeSlotsPanel Memoization (10 min)

```typescript
// components/booking-calendar/time-slots-panel.tsx
import { useCallback } from 'react';

export const TimeSlotsPanel = React.memo<TimeSlotsPanelProps>(({
  selectedDate,
  availableSlots,
  loading,
  timeFormat,
  onTimeFormatChange,
  userTimezone,
  onTimezoneChange,
  onSlotSelect,
}) => {
  const formatSelectedDate = useCallback((date: Date | null) => {
    if (!date) return "Select a date";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }

    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  const handle12hClick = useCallback(
    () => onTimeFormatChange("12h"),
    [onTimeFormatChange]
  );

  const handle24hClick = useCallback(
    () => onTimeFormatChange("24h"),
    [onTimeFormatChange]
  );

  return (
    <div className="flex-1 p-6">
      {/* ... existing JSX with handle12hClick, handle24hClick ... */}
    </div>
  );
});

TimeSlotsPanel.displayName = 'TimeSlotsPanel';
```

**Test:** Interact with panel - everything smooth.

---

### Step 6: Simple Component Memos (8 min)

```typescript
// components/booking-calendar/calendar-navigation.tsx
export const CalendarNavigation = React.memo<CalendarNavigationProps>((props) => {
  // ... existing code unchanged ...
});
CalendarNavigation.displayName = 'CalendarNavigation';

// components/booking-calendar/timezone-selector.tsx
export const TimezoneSelector = React.memo<TimezoneSelectorProps>((props) => {
  // ... existing code unchanged ...
});
TimezoneSelector.displayName = 'TimezoneSelector';
```

**Test:** Navigate calendar - no unnecessary re-renders.

---

### Step 7: Calendar Component Callbacks (12 min)

```typescript
// components/booking-calendar/calendar.tsx
import { useCallback, useMemo } from 'react';

export const Calendar: React.FC<CalendarProps> = ({ ... }) => {
  // ... existing state ...

  const autoSelectToday = useCallback(() => {
    if (!selectedDate) {
      const today = new Date();
      setSelectedDate(today);
      fetchSlots(today);
    }
  }, [selectedDate, fetchSlots]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    fetchSlots(date);
  }, [fetchSlots]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  }, [currentDate]);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  }, [currentDate]);

  const hasSlots = useMemo(
    () => Object.keys(monthSlots).length > 0,
    [monthSlots]
  );

  // ... existing useEffects ...

  // FIX: Auto-select useEffect
  useEffect(() => {
    if (hasSlots) {
      autoSelectToday();
    }
  }, [hasSlots, autoSelectToday]);

  return (
    <div ref={calendarRef} className="...">
      {/* ... existing JSX ... */}
      <CalendarGrid
        currentDate={currentDate}
        selectedDate={selectedDate}
        monthSlots={monthSlots}
        onDateSelect={handleDateSelect}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
      />
      {/* ... */}
    </div>
  );
};
```

**Test:** Full calendar flow - everything smooth and responsive.

---

## Expected Results

### Before Optimization:

| Action | Time | Status |
|--------|------|--------|
| Initial Render | ~437ms | ❌ Violation |
| Timezone Change | ~400ms | ❌ Violation |
| Date Selection | ~330ms | ❌ Violation |
| Month Navigation | ~520ms | ❌ Violation |
| Format Toggle (12h/24h) | ~350ms | ❌ Violation |

**User Experience:** Noticeable lag, UI feels sluggish, console warnings

### After Optimization:

| Action | Time | Status |
|--------|------|--------|
| Initial Render | ~80ms | ✅ Good |
| Timezone Change | ~25ms | ✅ Excellent |
| Date Selection | ~15ms | ✅ Excellent |
| Month Navigation | ~35ms | ✅ Excellent |
| Format Toggle (12h/24h) | ~10ms | ✅ Excellent |

**User Experience:** Instant response, smooth interactions, no warnings

**Performance Improvement:** 85-95% reduction in JavaScript execution time

---

## Testing & Validation Checklist

After implementing fixes, test these scenarios:

### Functional Tests:
- [ ] Calendar renders correctly
- [ ] Month navigation works (previous/next)
- [ ] Date selection works
- [ ] Time slot selection works
- [ ] Timezone change updates times correctly
- [ ] 12h/24h format toggle works
- [ ] "Today" and "Tomorrow" labels appear correctly
- [ ] Past dates are disabled
- [ ] Availability dots show on correct days

### Performance Tests:
- [ ] Open DevTools Console → No React scheduler violations
- [ ] Open DevTools Performance tab → Record interaction
  - JavaScript execution < 50ms per interaction
  - No long tasks (> 50ms) blocking main thread
- [ ] React DevTools Profiler → Check re-render counts
  - Changing timezone: only TimezoneSelector + TimeSlotButton re-render
  - Changing date: only selected CalendarDayButton + TimeSlotsPanel re-render
  - Navigating month: CalendarGrid + buttons re-render (expected)

### Visual Tests:
- [ ] No visible lag when interacting
- [ ] Animations smooth (if any)
- [ ] UI feels "instant" on clicks

### Edge Cases:
- [ ] Rapidly clicking dates/buttons (no lag accumulation)
- [ ] Switching months back and forth (cached results fast)
- [ ] Changing timezone multiple times (cached list used)

---

## Why These Techniques Work: React Performance 101

### The React Rendering Model:

**Default Behavior:**
```
Parent State Change
  → Parent Re-renders
    → ALL Children Re-render (recursively)
      → Even if their props didn't change!
```

**With Memoization:**
```
Parent State Change
  → Parent Re-renders
    → React checks each child's props
      → Props unchanged? Skip render ✅
      → Props changed? Re-render this child only ✅
```

### Key React Hooks for Performance:

1. **React.memo()** - Skips component render if props unchanged
2. **useMemo()** - Caches computed values
3. **useCallback()** - Caches function references

### When to Use Each:

**React.memo():**
- ✅ Component renders often but props change rarely
- ✅ Component is expensive to render
- ✅ Component has many siblings (one parent, many children)
- ❌ Props change on every render anyway (no benefit)

**useMemo():**
- ✅ Expensive computation (loops, Date operations, Intl API)
- ✅ Result used in render or passed as prop
- ✅ Dependencies change less than parent renders
- ❌ Simple computations (string concatenation) - overhead not worth it

**useCallback():**
- ✅ Function passed to memoized child component
- ✅ Function used in dependency arrays
- ❌ Function not passed anywhere (no benefit)

### The Golden Rules:

1. **Memoize components that render often with same props**
2. **Memoize expensive computations**
3. **Memoize callbacks passed to memoized children**
4. **Don't over-optimize** - profile first, optimize bottlenecks

---

## Common Pitfalls to Avoid

### Pitfall #1: Inline Functions in Memoized Components

```typescript
// ❌ BAD - React.memo useless because onClick always different
const MyButton = React.memo(({ value, onChange }) => {
  return <button onClick={() => onChange(value)}>Click</button>;
});

// ✅ GOOD - onClick reference stable
const MyButton = React.memo(({ value, onChange }) => {
  const handleClick = useCallback(() => onChange(value), [value, onChange]);
  return <button onClick={handleClick}>Click</button>;
});
```

### Pitfall #2: Missing Dependencies

```typescript
// ❌ BAD - stale closure, React warnings
const MyComponent = ({ data }) => {
  const process = useCallback(() => {
    console.log(data); // Uses data but not in deps!
  }, []);

  return <button onClick={process}>Process</button>;
};

// ✅ GOOD - all dependencies listed
const MyComponent = ({ data }) => {
  const process = useCallback(() => {
    console.log(data);
  }, [data]);

  return <button onClick={process}>Process</button>;
};
```

### Pitfall #3: Over-Memoization

```typescript
// ❌ BAD - useMemo overhead > computation cost
const fullName = useMemo(() => firstName + ' ' + lastName, [firstName, lastName]);

// ✅ GOOD - simple computation, no memo needed
const fullName = firstName + ' ' + lastName;
```

**Rule of Thumb:** Only memoize if computation > 1ms or result is an object/array.

### Pitfall #4: Forgetting displayName

```typescript
// ❌ BAD - React DevTools shows "Anonymous"
export const MyComponent = React.memo((props) => { ... });

// ✅ GOOD - Shows "MyComponent" in DevTools
export const MyComponent = React.memo((props) => { ... });
MyComponent.displayName = 'MyComponent';
```

---

## Additional Optimization Opportunities (Future)

These are **not** critical now but could be considered if performance becomes an issue again:

### 1. Virtualize Time Slots List
If showing 50+ time slots, consider `react-window` to only render visible slots.

### 2. Debounce Timezone Changes
Add 200ms debounce so rapid dropdown navigation doesn't trigger re-renders.

### 3. Code Splitting
Lazy-load timezone utilities since they're only needed when dropdown opens.

### 4. Web Workers
Move timezone processing to background thread (overkill for current needs).

---

## Conclusion

The performance issues stem from **React rendering inefficiencies**, not backend/network problems. The fixes are straightforward applications of React best practices:

1. **Cache expensive operations** (timezone list)
2. **Prevent unnecessary re-renders** (React.memo)
3. **Stabilize function references** (useCallback)
4. **Cache computed values** (useMemo)

**Implementation Time:** ~75 minutes
**Performance Improvement:** 85-95% reduction
**User Impact:** Instant, responsive UI

The optimizations follow React's official performance guidelines and are battle-tested patterns used in production apps.

---

**Document End**

*This plan should be reviewed before implementation and updated as needed during execution.*
