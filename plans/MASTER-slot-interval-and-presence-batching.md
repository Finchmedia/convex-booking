# MASTER PLAN: Slot Interval + Presence Batching Implementation

## 🎯 Overview

This master plan coordinates the implementation of TWO major features:

1. **Slot Interval Implementation** (from `slot-interval-complete-implementation.md`)
   - Backend already supports `slotInterval` parameter
   - Need to wire frontend to pass it through
   - Implement multi-slot hold logic
   - Fix duration lock UX

2. **Presence Batching Optimization** (from `presence-batching-optimization.md`)
   - Optimize heartbeat/leave to accept arrays
   - Reduce network requests by 50-87%
   - Update three layers: Backend → Client API → Frontend

**Critical Insight:** Both plans modify `lib/hooks/use-slot-hold.ts`, so we must implement them in the correct order!

---

## 🔗 Dependency Analysis

### Shared File: `use-slot-hold.ts`

**Slot Interval Plan needs:**
```typescript
// Add multi-slot hold logic
const affectedSlots = [...]; // Calculate affected slots
affectedSlots.forEach(slot => {
  heartbeat({ room: slot, user }); // Current API (looping)
});
```

**Presence Batching Plan needs:**
```typescript
// Remove loop, use batched API
heartbeat({ rooms: affectedSlots, user }); // New API (array)
```

### Implementation Order Decision

**Option A: Presence Batching FIRST** ✅ (RECOMMENDED)
```
1. Implement presence batching (backend + API + frontend stub)
2. Implement slot interval (uses batched API from the start)
3. No refactoring needed
```

**Option B: Slot Interval FIRST**
```
1. Implement slot interval with looping API
2. Implement presence batching
3. Refactor use-slot-hold.ts AGAIN to use batched API ❌ Extra work
```

**Decision: Implement Presence Batching First**

**Rationale:**
- ✅ Presence batching is pure infrastructure (no functional changes)
- ✅ Slot interval work uses optimized API from the start
- ✅ No need to touch use-slot-hold.ts twice
- ✅ Better separation of concerns
- ✅ Each phase has clear success criteria

---

## 📊 Work Breakdown Structure

```
MASTER PLAN
├── Phase 1: Presence Batching (Infrastructure)
│   ├── Task 1.1: Backend mutations (presence.ts)
│   ├── Task 1.2: Client API wrapper (client/index.ts)
│   └── Task 1.3: Validation & smoke tests
│
├── Phase 2: Slot Interval Backend Wiring
│   ├── Task 2.1: Frontend hook updates (use-convex-slots.ts)
│   └── Task 2.2: Component integration (calendar.tsx, app/page.tsx)
│
├── Phase 3: Multi-Slot Hold Implementation
│   ├── Task 3.1: Calculate affected slots logic
│   ├── Task 3.2: Batch heartbeat/leave calls (uses Phase 1 API!)
│   └── Task 3.3: Console logging & debugging
│
├── Phase 4: Integration Testing
│   ├── Task 4.1: Test all slot interval scenarios
│   ├── Task 4.2: Test multi-slot holds with batching
│   └── Task 4.3: Multi-user race condition tests
│
└── Phase 5: Documentation & Cleanup
    ├── Task 5.1: Update inline comments
    ├── Task 5.2: Verify all success criteria
    └── Task 5.3: Performance validation
```

---

## 🚀 Implementation Phases

### Phase 1: Presence Batching (Infrastructure Layer)

**Goal:** Update presence system to accept arrays instead of single rooms

**Files Modified:** 3
- `packages/convex-booking/src/component/presence.ts`
- `packages/convex-booking/src/client/index.ts`
- Test stubs (no actual multi-slot logic yet)

**Success Criteria:**
- ✅ `heartbeat({ rooms: [...], user })` works
- ✅ `leave({ rooms: [...], user })` works
- ✅ Backward compatible (single-element array works)
- ✅ Network tab shows 1 request for array

**Parallel Work Opportunities:** None (foundational)

**Estimated Time:** 30-45 minutes

#### Task 1.1: Backend Mutations Update

**Agent:** Direct implementation (no subagent needed - straightforward refactor)

**File:** `packages/convex-booking/src/component/presence.ts`

**Changes:**
1. Update `heartbeat` mutation:
   - Change `room: v.string()` to `rooms: v.array(v.string())`
   - Add `for (const room of args.rooms)` loop
   - Keep per-room cleanup scheduling

2. Update `leave` mutation:
   - Change `room: v.string()` to `rooms: v.array(v.string())`
   - Add `for (const room of args.rooms)` loop

3. Verify `cleanup` mutation unchanged (still single room)

**Validation:**
```typescript
// Test in Convex dashboard
await heartbeat({ rooms: ["test1", "test2"], user: "testUser" });
// Should create 2 presence records
```

#### Task 1.2: Client API Wrapper Update

**Agent:** Direct implementation

**File:** `packages/convex-booking/src/client/index.ts`

**Changes:**
1. Update `heartbeat` wrapper args: `rooms: v.array(v.string())`
2. Update `leave` wrapper args: `rooms: v.array(v.string())`
3. Keep `getPresence` unchanged (single room)

**Validation:**
```typescript
// Verify TypeScript compilation passes
// No runtime changes needed yet
```

#### Task 1.3: Smoke Test

**Agent:** Direct testing

**Test:**
```typescript
// In use-slot-hold.ts temporarily:
heartbeat({ rooms: ["2024-11-24T10:00:00.000Z"], user: userId });
// Single-element array should work
```

**Success:** No errors, presence record created

---

### Phase 2: Slot Interval Backend Wiring

**Goal:** Wire frontend to pass `slotInterval` to backend queries

**Files Modified:** 3
- `lib/hooks/use-convex-slots.ts`
- `components/booking-calendar/calendar.tsx`
- `app/page.tsx`

**Success Criteria:**
- ✅ Slots display at correct intervals (not every 15 min)
- ✅ Smart defaulting to minimum duration works
- ✅ Backward compatible with missing slotInterval

**Parallel Work Opportunities:** Can be done simultaneously with Phase 1 Task 1.3

**Estimated Time:** 45-60 minutes

#### Task 2.1: Update `use-convex-slots.ts`

**Agent:** Direct implementation

**File:** `lib/hooks/use-convex-slots.ts`

**Changes:**
1. Add parameters:
   ```typescript
   slotInterval?: number,
   allDurationOptions?: number[],
   ```

2. Implement smart defaulting:
   ```typescript
   const effectiveInterval = slotInterval ?? (
     allDurationOptions?.length > 0
       ? Math.min(...allDurationOptions)
       : eventLength
   )
   ```

3. Pass to both queries:
   - `getMonthAvailability(..., slotInterval: effectiveInterval)`
   - `getDaySlots(..., slotInterval: effectiveInterval)`

**Validation:**
- TypeScript compiles
- Hook accepts new parameters

#### Task 2.2: Component Integration

**Agent:** Direct implementation (both files in parallel)

**File 1:** `components/booking-calendar/calendar.tsx`

**Changes:**
1. Extract slot interval:
   ```typescript
   const slotInterval = eventType?.slotInterval;
   ```

2. Calculate all duration options:
   ```typescript
   const allDurationOptions = eventType
     ? [eventType.lengthInMinutes, ...(eventType.lengthInMinutesOptions || [])]
     : undefined;
   ```

3. Pass to hook:
   ```typescript
   useConvexSlots(resourceId, eventLength, slotInterval, allDurationOptions, hasIntersected)
   ```

**File 2:** `app/page.tsx`

**Changes:**
1. Add `slotInterval: 60` to MOCK_EVENT_TYPE

2. Extract with smart defaulting:
   ```typescript
   const slotInterval = eventType.slotInterval ?? (
     eventType.lengthInMinutesOptions?.length > 0
       ? Math.min(...eventType.lengthInMinutesOptions, eventType.lengthInMinutes)
       : eventType.lengthInMinutes
   )
   ```

**Validation:**
- Load calendar
- Verify slots display at 60-min intervals (not 15-min)
- Check network tab: queries include slotInterval parameter

---

### Phase 3: Multi-Slot Hold Implementation

**Goal:** Calculate affected slots and use batched presence API

**Files Modified:** 1
- `lib/hooks/use-slot-hold.ts` (major update)

**Success Criteria:**
- ✅ 2-hour booking holds 2 slots
- ✅ Console shows correct slot array
- ✅ Network tab shows 1 request (not 2)
- ✅ Back button releases all slots atomically

**Parallel Work Opportunities:** None (depends on Phase 1 & 2)

**Estimated Time:** 45-60 minutes

#### Task 3.1: Add Multi-Slot Calculation Logic

**Agent:** Direct implementation

**File:** `lib/hooks/use-slot-hold.ts`

**Changes:**
1. Add parameters:
   ```typescript
   durationMinutes: number,
   intervalMinutes: number = durationMinutes
   ```

2. Calculate affected slots:
   ```typescript
   const intervalsNeeded = Math.ceil(durationMinutes / intervalMinutes);
   const affectedSlots: string[] = [];
   for (let i = 0; i < intervalsNeeded; i++) {
     const slotTime = new Date(startTime + i * intervalMinutes * 60 * 1000);
     affectedSlots.push(slotTime.toISOString());
   }
   ```

3. Add console logging:
   ```typescript
   console.log(`[Hold] Locking ${intervalsNeeded} slots:`, affectedSlots);
   ```

**Validation:**
- Calculate 120 min / 60 min = 2 slots ✅
- Calculate 90 min / 60 min = 2 slots (Math.ceil) ✅

#### Task 3.2: Use Batched Presence API

**Agent:** Direct implementation (uses Phase 1 batched API!)

**File:** `lib/hooks/use-slot-hold.ts`

**Changes:**
1. Replace initial heartbeat loop:
   ```typescript
   // OLD: affectedSlots.forEach(slot => heartbeat({ room: slot, user }))
   // NEW:
   heartbeat({ rooms: affectedSlots, user: userId });
   ```

2. Replace interval heartbeat loop:
   ```typescript
   const interval = setInterval(() => {
     heartbeat({ rooms: affectedSlots, user: userId });
   }, 5000);
   ```

3. Replace cleanup loop:
   ```typescript
   return () => {
     clearInterval(interval);
     leave({ rooms: affectedSlots, user: userId });
   };
   ```

4. **CRITICAL:** Remove `durationMinutes` from dependency array:
   ```typescript
   }, [slotId, intervalMinutes, userId, heartbeat, leave]);
   // Note: durationMinutes NOT in deps (locked at selection)
   ```

**Validation:**
- Network tab: 1 request, not N requests
- Console: Correct array logged
- Database: N presence records created

#### Task 3.3: Update app/page.tsx Integration

**Agent:** Direct implementation

**File:** `app/page.tsx`

**Changes:**
Update `useSlotHold` call to pass duration and interval:
```typescript
useSlotHold(
  selectedSlot,
  selectedDuration,  // NEW
  slotInterval       // NEW
);
```

**Validation:**
- TypeScript compiles
- Hook receives correct parameters

---

### Phase 4: Integration Testing

**Goal:** Validate both features work together correctly

**Success Criteria:**
- ✅ All test scenarios pass
- ✅ No race conditions in multi-user tests
- ✅ Network requests optimized
- ✅ Console logs are clear

**Parallel Work Opportunities:** Can run multiple test scenarios in parallel browsers

**Estimated Time:** 60-90 minutes

#### Task 4.1: Slot Interval Scenarios

**Agent:** Manual testing (or subagent for test automation)

**Test Scenarios:**
1. Basic slot interval (60-min slots display correctly)
2. Missing slotInterval with single duration (defaults correctly)
3. Missing slotInterval with multiple durations (defaults to minimum)
4. Smart defaulting: [60, 90, 120] → 60-min slots

**Validation Checklist:**
- [ ] Slots display at correct intervals
- [ ] All duration options bookable at any slot
- [ ] Month view dots appear correctly
- [ ] No 15-min slots shown

#### Task 4.2: Multi-Slot Hold Scenarios

**Agent:** Manual testing (or subagent for test automation)

**Test Scenarios:**
1. 2-hour booking (2 slots held)
2. 5-hour booking (5 slots held)
3. Non-aligned: 90-min booking with 60-min interval (2 slots)
4. Back button releases all slots

**Validation Checklist:**
- [ ] Console: Correct number of slots logged
- [ ] Network tab: 1 request per batch (not N)
- [ ] Database: N presence records created
- [ ] Second user sees all N slots as held
- [ ] Cleanup releases all slots atomically

#### Task 4.3: Race Condition Tests

**Agent:** Manual multi-browser testing

**Test Scenarios:**
1. User A selects 2-hour slot at 10:00
2. User B (different browser) loads calendar
3. Verify User B sees 10:00 AND 11:00 as held
4. User A clicks back
5. Verify User B sees both slots available again

**Validation Checklist:**
- [ ] No race conditions
- [ ] Real-time updates work
- [ ] Cleanup propagates correctly

---

### Phase 5: Documentation & Cleanup

**Goal:** Finalize implementation with proper documentation

**Success Criteria:**
- ✅ All inline comments updated
- ✅ Console logs are production-ready
- ✅ All success criteria met
- ✅ Performance metrics validated

**Parallel Work Opportunities:** Can update docs while running final tests

**Estimated Time:** 30 minutes

#### Task 5.1: Code Documentation

**Agent:** Direct implementation

**Updates:**
1. Add JSDoc to `use-slot-hold.ts` explaining:
   - Why `durationMinutes` not in deps
   - Multi-slot hold logic
   - Batched API usage

2. Add comments to `use-convex-slots.ts`:
   - Smart defaulting logic
   - Why minimum duration chosen

3. Update `presence.ts` comments:
   - Batch operations
   - Per-room cleanup scheduling

#### Task 5.2: Success Criteria Validation

**Agent:** Manual checklist review

**Verify All Criteria from Both Plans:**

**From Slot Interval Plan:**
- [ ] Slots display at correct intervals
- [ ] Multi-slot bookings hold ALL affected slots
- [ ] Back button releases ALL holds
- [ ] Duration locked on booking form
- [ ] Missing slotInterval defaults to minimum duration

**From Presence Batching Plan:**
- [ ] `heartbeat` accepts array
- [ ] `leave` accepts array
- [ ] Network requests reduced by 50-87%
- [ ] All slots held atomically
- [ ] Cleanup mutation unchanged

#### Task 5.3: Performance Validation

**Agent:** Manual monitoring

**Metrics to Verify:**
1. **Network Requests:**
   - 2-hour booking session (30s): 8 requests ✅ (was 16)
   - 5-hour booking session (30s): 8 requests ✅ (was 40)

2. **Backend Performance:**
   - 8-slot booking mutation: < 500ms ✅
   - No timeout errors

3. **User Experience:**
   - Slot selection: < 100ms
   - Booking form transition: Instant
   - Multi-slot holds: No visual glitches

---

## 🔄 Rollback Plan

### If Phase 1 Fails (Presence Batching)

**Symptoms:**
- Backend errors in presence mutations
- TypeScript compilation errors in client wrapper
- Network requests failing

**Rollback:**
```bash
git checkout HEAD -- packages/convex-booking/src/component/presence.ts
git checkout HEAD -- packages/convex-booking/src/client/index.ts
```

**Impact:** None (no functional changes made yet)

### If Phase 2 Fails (Slot Interval Wiring)

**Symptoms:**
- Slots still showing every 15 minutes
- TypeScript errors in hooks
- Query parameters not passed correctly

**Rollback:**
```bash
git checkout HEAD -- lib/hooks/use-convex-slots.ts
git checkout HEAD -- components/booking-calendar/calendar.tsx
git checkout HEAD -- app/page.tsx
```

**Impact:** Presence batching still works (Phase 1 independent)

### If Phase 3 Fails (Multi-Slot Hold)

**Symptoms:**
- Only first slot held (not all slots)
- Network requests still looping
- Console errors about array parameters

**Rollback:**
```bash
git checkout HEAD -- lib/hooks/use-slot-hold.ts
git checkout HEAD -- app/page.tsx
```

**Impact:**
- Slot interval still works (Phase 2 independent)
- Presence batching API exists but not used (no harm)

---

## 📋 Master Implementation Checklist

### Pre-Implementation
- [ ] Read both sub-plans thoroughly
- [ ] Understand dependency: Presence Batching → Slot Interval
- [ ] Prepare test environment (two browsers for multi-user tests)
- [ ] Backup current working state (`git commit` or `git stash`)

### Phase 1: Presence Batching ⏱️ 30-45 min
- [ ] Task 1.1: Update `presence.ts` (heartbeat, leave)
- [ ] Task 1.2: Update `client/index.ts` (wrapper args)
- [ ] Task 1.3: Smoke test (single-element array)
- [ ] Verify: Network tab shows 1 request for array

### Phase 2: Slot Interval Wiring ⏱️ 45-60 min
- [ ] Task 2.1: Update `use-convex-slots.ts` (add params, smart default)
- [ ] Task 2.2a: Update `calendar.tsx` (extract interval, pass to hook)
- [ ] Task 2.2b: Update `app/page.tsx` (add to mock, smart default)
- [ ] Verify: Slots display at 60-min intervals

### Phase 3: Multi-Slot Hold ⏱️ 45-60 min
- [ ] Task 3.1: Add slot calculation logic to `use-slot-hold.ts`
- [ ] Task 3.2: Use batched API (rooms array, not loop)
- [ ] Task 3.3: Update `app/page.tsx` to pass duration/interval
- [ ] Verify: 2-hour booking holds 2 slots, 1 network request

### Phase 4: Integration Testing ⏱️ 60-90 min
- [ ] Task 4.1: Run all slot interval test scenarios
- [ ] Task 4.2: Run all multi-slot hold test scenarios
- [ ] Task 4.3: Multi-user race condition tests
- [ ] Verify: All tests pass, no console errors

### Phase 5: Documentation ⏱️ 30 min
- [ ] Task 5.1: Add JSDoc comments and inline docs
- [ ] Task 5.2: Validate all success criteria from both plans
- [ ] Task 5.3: Measure and verify performance metrics
- [ ] Final commit with clear message

### Total Estimated Time: 3.5 - 5.5 hours

---

## 🎯 Final Success Criteria (Combined)

### Functional Requirements
- ✅ Slots display at configured intervals (60 min, not 15 min)
- ✅ Smart defaulting: [60, 90, 120] options → 60-min slots
- ✅ All duration options bookable at any slot
- ✅ Multi-slot bookings hold ALL affected slots atomically
- ✅ Other users see ALL affected slots as locked
- ✅ Back button releases ALL slots in single request
- ✅ Duration locked on booking form (Cal.com pattern)
- ✅ Backward compatible with missing slotInterval

### Performance Requirements
- ✅ 2-hour booking: 50% fewer HTTP requests (16 → 8 per 30s session)
- ✅ 5-hour booking: 80% fewer HTTP requests (40 → 8 per 30s session)
- ✅ Backend mutation for 8 rooms: < 500ms
- ✅ Slot selection feels instant (< 100ms)

### Code Quality Requirements
- ✅ No client-side loops for network calls
- ✅ All layers updated consistently
- ✅ `durationMinutes` NOT in useEffect deps (reflects UX)
- ✅ Clear console logs showing array operations
- ✅ Comprehensive JSDoc comments
- ✅ No breaking changes to existing functionality

### Testing Requirements
- ✅ 8 test scenarios pass (slot interval)
- ✅ 5 test scenarios pass (multi-slot hold)
- ✅ 3 test scenarios pass (presence batching)
- ✅ Multi-user tests: No race conditions
- ✅ Edge cases: Non-aligned durations (90 min / 60 min interval)

---

## 🗂️ Files Modified Summary (All Phases)

| File | Phase | Changes | Priority |
|------|-------|---------|----------|
| `packages/convex-booking/src/component/presence.ts` | 1 | Accept array args | High |
| `packages/convex-booking/src/client/index.ts` | 1 | Update wrapper signatures | High |
| `lib/hooks/use-convex-slots.ts` | 2 | Add params, smart default | High |
| `components/booking-calendar/calendar.tsx` | 2 | Extract interval, pass to hook | High |
| `app/page.tsx` | 2, 3 | Mock data, smart default, useSlotHold call | High |
| `lib/hooks/use-slot-hold.ts` | 3 | Multi-slot calc, batched API | Critical |

**Total:** 6 files modified across 3 layers (Backend, Client API, Frontend)

---

## 🚨 Critical Dependencies Recap

### Must Complete in Order:
1. **Phase 1 BEFORE Phase 3**
   - Phase 3 (use-slot-hold.ts) needs batched API from Phase 1

2. **Phase 2 BEFORE Phase 3**
   - Phase 3 needs slotInterval extracted from eventType (Phase 2)

### Can Be Parallelized:
- Phase 1 Task 1.3 (smoke test) + Phase 2 Task 2.1 (hook update)
- Phase 2 Task 2.2 (both files can be edited simultaneously)
- Phase 4 Task 4.1, 4.2, 4.3 (multiple test scenarios)

---

## 💡 Implementation Tips

### For AI Agents:
1. **Read Both Sub-Plans First:** Understand full context before starting
2. **Validate After Each Phase:** Don't proceed if phase fails
3. **Use Console Logs Liberally:** They're critical for debugging multi-slot logic
4. **Test in Browser, Not Just TypeScript:** Network tab validation is essential
5. **Two Browser Windows:** Required for multi-user race condition tests

### For Human Developers:
1. **Work in Feature Branch:** `git checkout -b feat/slot-interval-and-batching`
2. **Commit After Each Phase:** Easy rollback if issues occur
3. **Keep Plans Open:** Reference sub-plans for detailed implementation
4. **Monitor Convex Dashboard:** Watch for backend errors in real-time
5. **Ask Questions:** If Phase 1 or 2 fails, stop and debug before Phase 3

---

## 🎓 Why This Order?

### Why Not Implement Both Simultaneously?

**Tempting approach:**
```
Work on slot interval and presence batching at the same time
→ Both touch use-slot-hold.ts
→ Merge conflicts / confusion
→ Harder to debug
```

**Better approach (this plan):**
```
Phase 1: Build infrastructure (batched API)
Phase 2: Wire up data flow (slot intervals)
Phase 3: Implement features (multi-slot holds using infrastructure)
→ Clear separation
→ Easy to test each phase
→ No merge conflicts
```

### Why Presence Batching First?

**Batching is infrastructure:**
- Pure performance optimization
- No functional changes
- Sets up better API for Phase 3

**If we did slot interval first:**
- Would implement multi-slot with looping (bad API)
- Then have to refactor again for batching
- Double the work on use-slot-hold.ts

---

## 📞 Support & Debugging

### Common Issues

**Issue 1: "Type error: rooms is not assignable to room"**
- **Cause:** Frontend calling old API, backend expects new
- **Fix:** Verify Phase 1 Task 1.2 completed (client wrapper updated)

**Issue 2: "Only first slot held, not all slots"**
- **Cause:** Multi-slot calculation logic not working
- **Fix:** Check Phase 3 Task 3.1 (Math.ceil, loop logic)

**Issue 3: "Network tab shows multiple requests"**
- **Cause:** Still using forEach loop instead of batch call
- **Fix:** Check Phase 3 Task 3.2 (should be single call with array)

**Issue 4: "Slots still showing every 15 minutes"**
- **Cause:** slotInterval not passed to queries
- **Fix:** Check Phase 2 Task 2.1 (effectiveInterval calculation)

### Debug Checklist

If something fails:
1. Check console logs (should show clear array operations)
2. Check network tab (should show reduced request count)
3. Check Convex dashboard logs (backend errors appear here)
4. Verify TypeScript compilation (no type errors)
5. Check database (presence records created correctly)

---

## 🎯 Definition of Done

This master plan is **COMPLETE** when:

1. ✅ All 5 phases completed without errors
2. ✅ All test scenarios pass (16 total from both plans)
3. ✅ Network requests reduced by 50-87% (measured)
4. ✅ Slots display at correct intervals (observed)
5. ✅ Multi-slot holds work atomically (verified in multi-user test)
6. ✅ Back button releases all slots (verified)
7. ✅ Duration locked on booking form (Cal.com pattern verified)
8. ✅ No console errors or warnings
9. ✅ Code reviewed and commented
10. ✅ Both sub-plans' success criteria met

---

**End of Master Plan** ✅

**Next Step:** Begin Phase 1 (Presence Batching) after confirming understanding of dependencies and order.
