# Comprehensive Mid-Booking Configuration Change Validation Plan

## Executive Summary

Design a bulletproof validation system that handles ALL possible ways the booking flow can break mid-session, using Convex's reactive queries for real-time detection without introducing excessive database load.

**Key Insight from Codebase Analysis:** The Booker component already queries `api.booking.getEventType` (line 62 in `booker.tsx`). This query is **already reactive** and will automatically update when the event type changes. We don't need a separate validation query - we just need to add validation logic around this existing subscription.

---

## Identified Edge Cases (Priority Ranked)

### Priority 1: Critical Failures (Block Booking Immediately)
1. **Event type deleted** - `useQuery` returns `null`
2. **Event type deactivated** - `isActive` becomes `false`
3. **Resource unlinked from event type** - No longer in `resource_event_types` mapping

### Priority 2: Configuration Drift (Force Re-selection)
4. **Invalid duration** - Selected duration removed from `lengthInMinutesOptions`
5. **Timezone lock changed** - `lockTimeZoneToggle` toggled while user has custom timezone

### Priority 3: Informational Warnings (Allow continuation)
6. **Event type metadata updated** - Title, description, location changed (non-breaking)

---

## Architecture Overview

### Core Principle: Single Source of Truth
- **Existing Query:** `const eventType = useQuery(api.booking.getEventType, { eventTypeId });`
- **Current Location:** `/components/booker/booker.tsx` line 62
- **Behavior:** Reactive, automatically re-runs when event type changes in DB
- **Cost:** ZERO additional queries (already exists!)

### Validation Strategy: Reactive Effect Pattern
```typescript
// In booker.tsx - Add validation effect AFTER the existing useQuery
const eventType = useQuery(api.booking.getEventType, { eventTypeId }); // EXISTING

// NEW: Validation effect (runs whenever eventType changes)
useEffect(() => {
  if (eventType === undefined) return; // Still loading, don't validate yet
  
  // Priority 1: Critical failures
  if (eventType === null) {
    handleEventTypeDeleted();
    return;
  }
  
  if (eventType.isActive === false) {
    handleEventTypeDeactivated();
    return;
  }
  
  // Priority 2: Configuration drift (only check AFTER slot selection)
  if (bookingStep === "booking-form" && selectedSlot) {
    if (!eventType.lengthInMinutesOptions?.includes(selectedDuration)) {
      handleInvalidDuration();
      return;
    }
  }
  
  // Priority 3: Informational (log only, don't block)
  // Future: Track metadata changes for analytics
  
}, [eventType, bookingStep, selectedSlot, selectedDuration]);
```

**Why This Works:**
- Convex queries are **reactive subscriptions** - they push updates when DB changes
- No polling, no additional network requests
- Validation runs automatically when admin changes config
- Zero performance overhead (just local JS logic on reactive data)

---

## Detailed Edge Case Handling

### Case 1: Event Type Deleted
**Detection:** `eventType === null` (query returns null when document doesn't exist)

**UX Flow:**
1. Show blocking dialog: "This booking type is no longer available"
2. Options:
   - "Browse Other Resources" → Redirect to `/book`
   - "Try Different Booking Type" → Fetch `getEventTypesForResource(resourceId)`, show modal with alternatives
3. Clear all state (slot, duration, form data)
4. Release presence hold

**Implementation:**
```typescript
const handleEventTypeDeleted = () => {
  // Release hold immediately
  setSelectedSlot(null); // Triggers useSlotHold cleanup
  
  // Fetch alternatives
  const alternativeEventTypes = useQuery(
    api.booking.getEventTypesForResource,
    eventType === null ? { resourceId } : "skip" // Only fetch when deleted
  );
  
  // Show dialog
  setErrorState({
    type: "event-type-deleted",
    title: "Booking Type No Longer Available",
    message: "This booking option has been removed by the administrator.",
    alternatives: alternativeEventTypes,
  });
};
```

**Dialog Component:** Use existing `/components/ui/dialog.tsx`

---

### Case 2: Event Type Deactivated
**Detection:** `eventType.isActive === false`

**UX Flow:**
1. Show blocking dialog: "This booking type is temporarily unavailable"
2. Options (same as deleted):
   - "Browse Other Resources"
   - "Try Different Booking Type"
3. Clear state and release hold

**Implementation:**
```typescript
const handleEventTypeDeactivated = () => {
  setSelectedSlot(null);
  
  // Fetch alternatives (filter to active only - already done in getEventTypesForResource)
  const alternativeEventTypes = useQuery(
    api.booking.getEventTypesForResource,
    eventType?.isActive === false ? { resourceId } : "skip"
  );
  
  setErrorState({
    type: "event-type-inactive",
    title: "Booking Type Temporarily Unavailable",
    message: "This booking option has been deactivated. Please choose another booking type.",
    alternatives: alternativeEventTypes,
  });
};
```

**Key Difference from Deleted:** Different messaging (temporary vs. permanent)

---

### Case 3: Resource Unlinked from Event Type
**Detection:** Need additional query for this specific case

**Problem:** Current `getEventType` query doesn't check resource linkage. We need:
```typescript
// NEW QUERY (only runs when eventType exists and we have a resourceId)
const isLinked = useQuery(
  api.booking.hasResourceEventTypeLink,
  eventType && eventType.isActive ? { resourceId, eventTypeId } : "skip"
);
```

**Cost Analysis:**
- Query runs: Only when eventType is active and valid
- Invalidates: Only when `resource_event_types` table changes (rare)
- Benefit: Prevents booking attempts on unlinked resources

**UX Flow:**
1. Show blocking dialog: "Resource no longer supports this booking type"
2. Options:
   - "Browse Other Resources" → `/book`
   - "View Available Booking Types" → Show `getEventTypesForResource(resourceId)`

**Implementation:**
```typescript
useEffect(() => {
  if (isLinked === false) {
    handleResourceUnlinked();
  }
}, [isLinked]);

const handleResourceUnlinked = () => {
  setSelectedSlot(null);
  
  // Fetch what IS available for this resource
  const availableEventTypes = useQuery(
    api.booking.getEventTypesForResource,
    { resourceId }
  );
  
  setErrorState({
    type: "resource-unlinked",
    title: "Resource Configuration Changed",
    message: `${eventType.title} is no longer available for ${resourceId}.`,
    alternatives: availableEventTypes,
  });
};
```

---

### Case 4: Invalid Duration (Selected Duration Removed)
**Detection:** 
```typescript
const isDurationValid = eventType?.lengthInMinutesOptions?.includes(selectedDuration) 
  ?? (selectedDuration === eventType?.lengthInMinutes);
```

**Trigger:** Only check AFTER slot selection (during "booking-form" step)

**UX Flow:**
1. Show dialog: "Duration option no longer available"
2. Force back to calendar
3. Reset to default duration (eventType.lengthInMinutes)
4. Release hold

**Implementation:**
```typescript
useEffect(() => {
  if (bookingStep === "booking-form" && selectedSlot && eventType) {
    const validDurations = [
      eventType.lengthInMinutes,
      ...(eventType.lengthInMinutesOptions || [])
    ];
    
    if (!validDurations.includes(selectedDuration)) {
      handleInvalidDuration();
    }
  }
}, [eventType, bookingStep, selectedSlot, selectedDuration]);

const handleInvalidDuration = () => {
  // Release hold
  setSelectedSlot(null);
  
  // Reset to default duration
  setSelectedDuration(eventType.lengthInMinutes);
  
  // Go back to calendar
  setBookingStep("event-meta");
  
  // Show toast notification
  toast({
    variant: "warning",
    title: "Duration Changed",
    message: `The ${selectedDuration}-minute option is no longer available. Please select a new time slot.`,
  });
};
```

**Toast Component:** Need to add Sonner or shadcn/ui toast (currently missing)

---

### Case 5: Timezone Lock Changed
**Detection:**
```typescript
const wasTimezoneLocked = useRef(eventType?.lockTimeZoneToggle);

useEffect(() => {
  if (eventType && wasTimezoneLocked.current !== eventType.lockTimeZoneToggle) {
    if (eventType.lockTimeZoneToggle && timezone !== eventType.timezone) {
      handleTimezoneLockChanged();
    }
    wasTimezoneLocked.current = eventType.lockTimeZoneToggle;
  }
}, [eventType, timezone]);
```

**UX Flow:**
1. Show informational dialog: "Timezone setting changed"
2. Auto-switch to event type timezone
3. Update displayed times
4. Allow continuation (non-blocking)

**Implementation:**
```typescript
const handleTimezoneLockChanged = () => {
  // Force to event type timezone
  setTimezone(eventType.timezone);
  
  // Show informational toast
  toast({
    variant: "info",
    title: "Timezone Updated",
    message: `Times are now shown in ${eventType.timezone} (administrator locked timezone).`,
  });
};
```

---

## Component Architecture

### New Hook: `useBookingValidation`
**Purpose:** Encapsulate all validation logic in a reusable hook

**Location:** `/lib/hooks/use-booking-validation.ts`

**Interface:**
```typescript
export interface ValidationError {
  type: 
    | "event-type-deleted" 
    | "event-type-inactive" 
    | "resource-unlinked" 
    | "invalid-duration" 
    | "timezone-locked";
  severity: "blocking" | "warning" | "info";
  title: string;
  message: string;
  alternatives?: any[]; // Alternative event types
  recoveryActions: RecoveryAction[];
}

export interface RecoveryAction {
  label: string;
  action: () => void;
  variant: "primary" | "secondary";
}

export function useBookingValidation(
  eventTypeId: string,
  resourceId: string,
  bookingStep: BookingStep,
  selectedSlot: string | null,
  selectedDuration: number,
  timezone: string
): {
  isValid: boolean;
  error: ValidationError | null;
  clearError: () => void;
}
```

**Usage in Booker:**
```typescript
const { isValid, error, clearError } = useBookingValidation(
  eventTypeId,
  resourceId,
  bookingStep,
  selectedSlot,
  selectedDuration,
  timezone
);

// Render error dialog
{error && (
  <BookingErrorDialog
    error={error}
    onClose={clearError}
    onAction={(action) => action.action()}
  />
)}
```

---

### New Component: `BookingErrorDialog`
**Purpose:** Unified error presentation with recovery options

**Location:** `/components/booker/booking-error-dialog.tsx`

**Features:**
- Dynamic rendering based on error type
- Alternative event types list (if available)
- Recovery action buttons
- Auto-dismiss for non-blocking warnings

**Props:**
```typescript
interface BookingErrorDialogProps {
  error: ValidationError;
  onClose: () => void;
  onAction: (action: RecoveryAction) => void;
}
```

**Implementation Sketch:**
```typescript
export function BookingErrorDialog({ error, onClose, onAction }: BookingErrorDialogProps) {
  return (
    <Dialog open={!!error} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{error.title}</DialogTitle>
          <DialogDescription>{error.message}</DialogDescription>
        </DialogHeader>
        
        {/* Show alternatives if available */}
        {error.alternatives && error.alternatives.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Available alternatives:</p>
            <ul className="space-y-1">
              {error.alternatives.map((alt) => (
                <li key={alt.id} className="text-sm text-muted-foreground">
                  • {alt.title} ({alt.lengthInMinutes}min)
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <DialogFooter>
          {error.recoveryActions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === "primary" ? "default" : "outline"}
              onClick={() => {
                onAction(action);
                onClose();
              }}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Additional Backend Safety

### Mutation-Level Validation
Even with frontend validation, add backend checks to `createBooking` mutation:

**Location:** `/packages/convex-booking/src/component/public.ts` (createBooking mutation)

**Add before line 228:**
```typescript
// VALIDATION: Check event type is active
if (!eventType.isActive) {
  throw new Error("Event type is not active");
}

// VALIDATION: Check resource is linked to event type
const isLinked = await ctx.db
  .query("resource_event_types")
  .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
  .filter((q) => q.eq(q.field("eventTypeId"), args.eventTypeId))
  .first();

if (!isLinked) {
  throw new Error("Resource is not linked to this event type");
}

// VALIDATION: Check duration is valid
const validDurations = [
  eventType.lengthInMinutes,
  ...(eventType.lengthInMinutesOptions || [])
];
const bookingDuration = Math.floor((args.end - args.start) / 60000);

if (!validDurations.includes(bookingDuration)) {
  throw new Error(`Invalid duration: ${bookingDuration}min`);
}
```

**Defense-in-Depth:** Frontend prevents bad UX, backend prevents data corruption

---

## Implementation Sequence

### Phase 1: Core Validation Hook (Day 1)
1. Create `use-booking-validation.ts` hook
2. Implement Priority 1 validations (deleted, inactive)
3. Add error state management
4. Test with manual DB manipulation

**Complexity:** Medium (2-3 hours)

### Phase 2: Error Dialog & Recovery (Day 1-2)
1. Create `BookingErrorDialog` component
2. Integrate with existing Dialog primitives
3. Implement recovery actions (redirect, show alternatives)
4. Add toast notifications (install Sonner if needed)

**Complexity:** Medium (3-4 hours)

### Phase 3: Advanced Validations (Day 2)
1. Add `hasResourceEventTypeLink` query check
2. Implement Priority 2 validations (duration, timezone)
3. Add staleness detection (optional)
4. Test multi-user scenarios

**Complexity:** High (4-5 hours)

### Phase 4: Backend Hardening (Day 2-3)
1. Add validation to `createBooking` mutation
2. Add validation to resource linking mutations
3. Test error messages propagate correctly
4. Document error codes

**Complexity:** Low (1-2 hours)

### Phase 5: Testing & Edge Cases (Day 3)
1. Manual testing: Admin panel + Booker side-by-side
2. Test all 5 edge cases
3. Test recovery flows
4. Performance testing (query load)

**Complexity:** Medium (3-4 hours)

**Total Estimated Time:** 13-18 hours (2-3 days)

---

## Query Load Analysis

### Before (Current State)
- Booker: 1 query (`getEventType`)
- Calendar: 2 queries (`getMonthAvailability`, `getDaySlots`)
- Presence: 1 query (`getDatePresence`)
- **Total per active booker:** 4 queries

### After (With Validation)
- Booker: 1 query (`getEventType`) - UNCHANGED
- Validation: 1 query (`hasResourceEventTypeLink`) - CONDITIONAL (only when active)
- Error Recovery: 1 query (`getEventTypesForResource`) - CONDITIONAL (only on error)
- **Total per active booker:** 5-6 queries (worst case)
- **Typical case:** 5 queries (link check always runs)

**Overhead:** +1 query per booker (+25% increase)

**Mitigation:**
- `hasResourceEventTypeLink` query is indexed (`by_resource` + filter)
- Query only runs when event type is valid
- Invalidates rarely (only when resource_event_types table changes)
- Result: <5ms query time, minimal overhead

---

## Testing Strategy

### Manual Testing Scenarios

#### Scenario 1: Event Type Deactivation
1. Open Booker for active event type
2. In Admin panel, toggle event type to inactive
3. **Expected:** Dialog appears immediately, "Temporarily Unavailable"
4. Click "Try Different Booking Type"
5. **Expected:** Modal shows alternatives
6. Select alternative
7. **Expected:** Booker reloads with new event type

#### Scenario 2: Duration Removal Mid-Booking
1. Open Booker, select 5h duration option
2. Select time slot (hold acquired)
3. Navigate to form step
4. In Admin panel, remove 5h from `lengthInMinutesOptions`
5. **Expected:** Dialog appears, "Duration option no longer available"
6. Click "OK"
7. **Expected:** Back to calendar, duration reset to default, hold released

#### Scenario 3: Resource Unlink Mid-Selection
1. Open Booker for StudioA + EventTypeX
2. Select slot (still on calendar step)
3. In Admin panel, unlink StudioA from EventTypeX
4. **Expected:** Dialog appears, "Resource no longer supports this booking type"
5. Click "View Available Booking Types"
6. **Expected:** Shows other event types for StudioA

#### Scenario 4: Event Type Deletion During Form Fill
1. Open Booker, select slot, navigate to form
2. Fill name, email fields (don't submit yet)
3. In Admin panel, delete event type
4. **Expected:** Dialog appears immediately, "No longer available"
5. **Expected:** Form data discarded (as per user preference)
6. Click "Browse Other Resources"
7. **Expected:** Redirect to `/book`

#### Scenario 5: Timezone Lock Toggle
1. Open Booker with custom timezone selected
2. In Admin panel, toggle `lockTimeZoneToggle` to true
3. **Expected:** Toast notification, timezone auto-switches
4. **Expected:** Time slots re-render in new timezone
5. Booking can continue (non-blocking)

---

## Performance Benchmarks

### Target Metrics
- Validation check: <5ms (pure JS logic on reactive data)
- Error dialog render: <100ms
- Alternative event types query: <50ms (indexed)
- Total time from config change to user notification: <500ms

### Measurement Points
```typescript
// In useBookingValidation hook
const startTime = performance.now();
// ... validation logic ...
const endTime = performance.now();
if (process.env.NODE_ENV === 'development') {
  console.log(`Validation took ${endTime - startTime}ms`);
}
```

---

## Rollback Plan

### If Performance Issues Arise
1. **Disable continuous validation:** Only check at slot selection + submission
2. **Remove link check:** Trust that admin won't unlink mid-booking
3. **Debounce validation:** Add 500ms debounce to validation effect

### If UX Issues Arise
1. **Soften blocking dialogs:** Change to dismissible warnings
2. **Auto-retry logic:** Retry event type query before showing error
3. **Preserve form data:** Store in sessionStorage instead of discarding

---

## Open Questions & Future Enhancements

### Questions
1. Should we track validation failures in analytics? (e.g., how often does this happen?)
2. Should admins get notifications when they break active bookings?
3. Should we support "undo" for admin actions that break active bookings?

### Future Enhancements
1. **Optimistic Locking:** Prevent admin from deactivating event type with active sessions
2. **Grace Period:** 60-second warning to active users before deactivation takes effect
3. **Admin Dashboard Alert:** Show "X users currently booking this event type" in admin UI
4. **Validation Replay:** Log validation events for debugging

---

## Critical Files for Implementation

### 1. `/lib/hooks/use-booking-validation.ts` (NEW)
**Purpose:** Core validation logic hook
- Reactive validation on event type changes
- Error state management
- Recovery action generation
- **Complexity:** High (main business logic)

### 2. `/components/booker/booker.tsx` (MODIFY)
**Purpose:** Integrate validation hook
- Import and use `useBookingValidation`
- Render `BookingErrorDialog`
- Handle recovery actions (redirect, reset state)
- **Complexity:** Medium (integration logic)

### 3. `/components/booker/booking-error-dialog.tsx` (NEW)
**Purpose:** Unified error presentation
- Dialog with alternative event types
- Recovery action buttons
- Dynamic content based on error type
- **Complexity:** Low (presentational component)

### 4. `/packages/convex-booking/src/component/public.ts` (MODIFY)
**Purpose:** Backend validation hardening
- Add validation checks to `createBooking` mutation (lines 220-295)
- Validate event type active status
- Validate resource linkage
- Validate duration matches allowed options
- **Complexity:** Medium (mutation safety)

### 5. `/packages/convex-booking/src/component/resource_event_types.ts` (REFERENCE)
**Purpose:** Understand link checking pattern
- Reference for `hasResourceEventTypeLink` query
- Already exists (line 72-86), may need to export via client API
- **Complexity:** Low (existing code, may just need export)

---

## Success Criteria

### Functional Requirements
- [ ] All 5 edge cases handled gracefully
- [ ] User receives clear, actionable error messages
- [ ] No data corruption (invalid bookings in DB)
- [ ] Presence holds released on error
- [ ] Recovery flows tested and working

### Non-Functional Requirements
- [ ] Validation overhead <5ms
- [ ] Dialog appears within 500ms of config change
- [ ] Zero additional queries in happy path
- [ ] Code coverage >80% for validation logic
- [ ] Documentation complete

### User Experience Requirements
- [ ] Errors feel helpful, not punishing
- [ ] Alternative options clearly presented
- [ ] Form data handling matches user expectation (clear on error)
- [ ] No infinite loops or race conditions
- [ ] Graceful degradation if validation fails

---

## Risk Assessment

### High Risk
- **Race Conditions:** User submits form exactly when event type deactivated
  - **Mitigation:** Backend validation catches this (defense-in-depth)

- **Query Thrashing:** Rapid config changes cause excessive re-renders
  - **Mitigation:** Debounce validation effect (500ms)

### Medium Risk
- **Alternative Event Types Empty:** No valid alternatives available
  - **Mitigation:** Still show "Browse Resources" option

- **Network Delays:** Validation query slow on poor connection
  - **Mitigation:** Show loading state, timeout after 5s

### Low Risk
- **False Positives:** Validation triggers incorrectly
  - **Mitigation:** Extensive testing, console logging in dev mode

---

## Appendix: Error Message Templates

### Event Type Deleted
**Title:** "Booking Type No Longer Available"
**Message:** "This booking option has been removed by the administrator. Please choose a different booking type or resource."
**Actions:** ["Browse Other Resources", "Try Different Booking Type"]

### Event Type Deactivated
**Title:** "Booking Type Temporarily Unavailable"
**Message:** "This booking option has been temporarily deactivated. Please choose another booking type."
**Actions:** ["Browse Other Resources", "Try Different Booking Type"]

### Resource Unlinked
**Title:** "Resource Configuration Changed"
**Message:** "{eventType.title} is no longer available for {resource.name}."
**Actions:** ["Browse Other Resources", "View Available Booking Types"]

### Invalid Duration
**Title:** "Duration Option Changed"
**Message:** "The {selectedDuration}-minute option is no longer available. Please select a new time slot with an available duration."
**Actions:** ["Back to Calendar"]

### Timezone Lock Changed
**Title:** "Timezone Setting Updated"
**Message:** "Times are now shown in {eventType.timezone} (administrator locked timezone)."
**Actions:** ["Continue Booking"] (Informational only)

---

## End of Plan

**Estimated Implementation Time:** 13-18 hours (2-3 days)
**Recommended Approach:** Implement in phases, test thoroughly between phases
**Next Steps:** Review plan, approve, begin Phase 1 implementation
