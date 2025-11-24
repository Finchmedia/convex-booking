# Presence Batching Optimization: Multi-Room Heartbeats

## 🎯 Overview

**Problem:** When holding multiple slots (e.g., 2-hour booking with 1-hour intervals), the client sends separate heartbeat requests for each room, creating unnecessary network overhead.

**Current Implementation:**
```typescript
// Client sends 5 separate HTTP requests
affectedSlots.forEach(slot => {
  heartbeat({ room: slot, user: userId }); // 5x network calls
});
```

**Optimized Implementation:**
```typescript
// Client sends 1 batched HTTP request
heartbeat({ rooms: affectedSlots, user: userId }); // 1x network call
```

**Impact:**
- **5-hour booking:** 5 requests → 1 request (80% reduction)
- **Better atomicity:** All rooms updated in single transaction
- **Cleaner code:** No client-side loop

---

## 📊 Performance Comparison

### Before (Current)

```
User selects 10:00 AM with 2-hour duration (slots: 10:00, 11:00)

Client:
  ├─ heartbeat({ room: "10:00", user: "abc" }) → HTTP Request 1
  └─ heartbeat({ room: "11:00", user: "abc" }) → HTTP Request 2

Every 5 seconds: 2 more requests
On cleanup: 2 more requests (leave)

Total for one booking session (30 seconds):
  Initial: 2 requests
  6 heartbeat cycles: 12 requests
  Cleanup: 2 requests
  = 16 HTTP requests
```

### After (Optimized)

```
User selects 10:00 AM with 2-hour duration (slots: 10:00, 11:00)

Client:
  └─ heartbeat({ rooms: ["10:00", "11:00"], user: "abc" }) → HTTP Request 1

Every 5 seconds: 1 request
On cleanup: 1 request (leave)

Total for one booking session (30 seconds):
  Initial: 1 request
  6 heartbeat cycles: 6 requests
  Cleanup: 1 request
  = 8 HTTP requests (50% reduction!)
```

---

## 🏗️ Architecture: Three-Layer Update

This optimization requires **coordinated changes** across three layers:

```
┌─────────────────────────────────────┐
│ Layer 1: Frontend Hook              │
│ lib/hooks/use-slot-hold.ts          │
│                                      │
│ Change: Pass array instead of loop  │
│ heartbeat({ rooms: [...], user })   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ Layer 2: Client API Wrapper         │
│ packages/.../src/client/index.ts    │
│                                      │
│ Change: Update args signature       │
│ rooms: v.array(v.string())          │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ Layer 3: Backend Mutation           │
│ packages/.../src/component/         │
│ presence.ts                          │
│                                      │
│ Change: Accept array, loop inside   │
│ for (const room of args.rooms) {...}│
└─────────────────────────────────────┘
```

**All three layers MUST be updated together or the system breaks!**

---

## 📋 Implementation Plan

### Phase 1: Backend - Update Presence Mutations

**File:** `packages/convex-booking/src/component/presence.ts`

#### 1.1 Update `heartbeat` Mutation

**Current Signature:**
```typescript
export const heartbeat = mutation({
  args: {
    room: v.string(),      // Single room
    user: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // ... logic for single room
  },
});
```

**New Signature:**
```typescript
export const heartbeat = mutation({
  args: {
    rooms: v.array(v.string()), // NEW: Array of rooms
    user: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Loop through all rooms and update presence
    for (const room of args.rooms) {
      // 1. Update or create presence record
      const existingPresence = await ctx.db
        .query("presence")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      if (existingPresence) {
        await ctx.db.patch(existingPresence._id, {
          updated: now,
          data: args.data ?? existingPresence.data,
        });
      } else {
        await ctx.db.insert("presence", {
          user: args.user,
          room: room,
          updated: now,
          data: args.data,
        });
      }

      // 2. Ensure cleanup job is scheduled (one per room)
      const existingHeartbeat = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      if (!existingHeartbeat) {
        const scheduledId = await ctx.scheduler.runAfter(
          TIMEOUT_MS,
          "presence:cleanup",
          {
            room: room,  // Note: cleanup still takes single room
            user: args.user,
          }
        );
        await ctx.db.insert("presence_heartbeats", {
          user: args.user,
          room: room,
          markAsGone: scheduledId,
        });
      }
    }
  },
});
```

**Key Points:**
- ✅ Loop handles N rooms in single mutation context
- ✅ Each room still gets its own cleanup job (can't batch this)
- ✅ Transactional: Either all rooms succeed or none do

#### 1.2 Update `leave` Mutation

**Current Signature:**
```typescript
export const leave = mutation({
  args: {
    room: v.string(),      // Single room
    user: v.string(),
  },
  handler: async (ctx, args) => {
    // ... cleanup for single room
  },
});
```

**New Signature:**
```typescript
export const leave = mutation({
  args: {
    rooms: v.array(v.string()), // NEW: Array of rooms
    user: v.string(),
  },
  handler: async (ctx, args) => {
    // Loop through all rooms and clean up
    for (const room of args.rooms) {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      const heartbeatDoc = await ctx.db
        .query("presence_heartbeats")
        .withIndex("by_user_room", (q) =>
          q.eq("user", args.user).eq("room", room)
        )
        .first();

      if (presence) await ctx.db.delete(presence._id);
      if (heartbeatDoc) await ctx.db.delete(heartbeatDoc._id);
    }
  },
});
```

#### 1.3 Keep `cleanup` Mutation Unchanged

**Important:** The `cleanup` mutation is called by the scheduler and processes **one room at a time**. This is correct and should NOT be changed.

```typescript
// DO NOT CHANGE THIS
export const cleanup = mutation({
  args: {
    room: v.string(),      // Still singular
    user: v.string(),
  },
  handler: async (ctx, args) => {
    // ... existing cleanup logic
  },
});
```

**Why?**
- Cleanup jobs are scheduled per-room
- Each room times out independently
- Scheduler calls this with single room arguments

---

### Phase 2: Client API - Update Wrapper

**File:** `packages/convex-booking/src/client/index.ts`

**Current Implementation:**
```typescript
export function makeBookingAPI(component: ComponentApi) {
  return {
    // ... other functions ...

    heartbeat: mutation({
      args: {
        room: v.string(),      // OLD: Single room
        user: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.heartbeat, args);
      },
    }),

    leave: mutation({
      args: {
        room: v.string(),      // OLD: Single room
        user: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.leave, args);
      },
    }),
  };
}
```

**New Implementation:**
```typescript
export function makeBookingAPI(component: ComponentApi) {
  return {
    // ... other functions ...

    heartbeat: mutation({
      args: {
        rooms: v.array(v.string()), // NEW: Array of rooms
        user: v.string(),
        data: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.heartbeat, args);
      },
    }),

    leave: mutation({
      args: {
        rooms: v.array(v.string()), // NEW: Array of rooms
        user: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.presence.leave, args);
      },
    }),

    // getPresence stays the same (already takes single room)
    getPresence: query({
      args: { room: v.string() }, // Unchanged
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.presence.list, args);
      },
    }),
  };
}
```

**Note:** `getPresence` remains singular because UI checks one slot at a time.

---

### Phase 3: Frontend - Update Hook

**File:** `lib/hooks/use-slot-hold.ts`

**Current Implementation:**
```typescript
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

// 3. Cleanup: Leave ALL rooms
return () => {
  clearInterval(interval);
  affectedSlots.forEach((slot) => {
    leave({ room: slot, user: userId }).catch((err) => {
      console.error(`[Hold] Failed to leave slot ${slot}:`, err);
    });
  });
};
```

**New Implementation (Batched):**
```typescript
// 1. Immediate heartbeat to ALL affected slots (batched!)
heartbeat({ rooms: affectedSlots, user: userId }).catch((err) => {
  console.error(`[Hold] Failed to hold slots:`, affectedSlots, err);
});

// 2. Periodic heartbeat every 5 seconds to ALL slots (batched!)
const interval = setInterval(() => {
  heartbeat({ rooms: affectedSlots, user: userId }).catch((err) => {
    console.error(`[Hold] Heartbeat failed for slots:`, affectedSlots, err);
  });
}, 5000);

// 3. Cleanup: Leave ALL rooms (batched!)
return () => {
  clearInterval(interval);
  console.log(
    `[Hold] Releasing ${affectedSlots.length} slots:`,
    affectedSlots.map(s => new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
  );
  leave({ rooms: affectedSlots, user: userId }).catch((err) => {
    console.error(`[Hold] Failed to leave slots:`, affectedSlots, err);
  });
};
```

**Changes:**
- ❌ Removed: `forEach` loop
- ✅ Added: Single call with `rooms` array
- ✅ Cleaner error handling (log array once, not per-slot)

---

## 🧪 Testing Strategy

### Test 1: Single Slot Booking (Backward Compat)

**Setup:**
```typescript
Duration: 60 minutes
Interval: 60 minutes
Slots needed: 1
```

**Expected:**
- `heartbeat({ rooms: ["10:00"], user })` → Array with 1 element
- Backend loops once
- 1 presence record created
- 1 cleanup job scheduled

**Verify:**
- Console: `[Hold] Locking 1 slots for 60min booking: ['10:00']`
- Network tab: 1 HTTP request
- Database: 1 row in `presence` table

---

### Test 2: Multi-Slot Booking (Main Use Case)

**Setup:**
```typescript
Duration: 120 minutes
Interval: 60 minutes
Slots needed: 2
```

**Expected:**
- `heartbeat({ rooms: ["10:00", "11:00"], user })` → Array with 2 elements
- Backend loops twice
- 2 presence records created
- 2 cleanup jobs scheduled (one per room)

**Verify:**
- Console: `[Hold] Locking 2 slots for 120min booking: ['10:00', '11:00']`
- Network tab: 1 HTTP request (not 2!)
- Database: 2 rows in `presence` table, 2 in `presence_heartbeats`

---

### Test 3: Very Long Booking (Performance)

**Setup:**
```typescript
Duration: 480 minutes (8 hours)
Interval: 60 minutes
Slots needed: 8
```

**Expected:**
- `heartbeat({ rooms: [8 slots], user })` → Array with 8 elements
- Backend loops 8 times
- 8 presence records created
- 8 cleanup jobs scheduled

**Verify:**
- Network tab: Still only 1 HTTP request
- Backend logs: No errors processing 8 rooms
- Response time: < 500ms (Convex should handle this easily)

---

### Test 4: Cleanup (Leave Multiple Rooms)

**Setup:**
- User has 2-hour booking selected
- 2 slots held: 10:00, 11:00
- User clicks "Back" button

**Expected:**
- `leave({ rooms: ["10:00", "11:00"], user })` → Single call
- Backend loops twice and deletes both records
- Console: `[Hold] Releasing 2 slots: ['10:00', '11:00']`

**Verify:**
- Network tab: 1 HTTP request
- Database: Both presence records deleted
- Second user now sees both slots as available

---

### Test 5: Error Handling (Transaction Rollback)

**Setup:**
- Inject error on room 2 of 3 (e.g., invalid room format)

**Expected (Current Behavior):**
- Mutation throws error
- Transaction rolls back
- NO presence records created (not even for room 1)

**Verify:**
- Database: 0 rows in `presence` table
- Client receives error
- User sees error message

**Alternative (Partial Success):**
If we want partial success, we'd need to change error handling:
```typescript
for (const room of args.rooms) {
  try {
    // ... update presence
  } catch (err) {
    console.error(`Failed room ${room}:`, err);
    // Continue to next room instead of throwing
  }
}
```

**Recommendation:** Keep fail-fast behavior. If we can't hold ALL slots, don't hold ANY. This prevents confusing partial holds.

---

## 🚨 Critical Validation Checklist

### If Gemini Already Made Changes, Verify:

- [ ] **Layer 1 (Frontend):** `use-slot-hold.ts` passes `rooms` array instead of looping
- [ ] **Layer 2 (Client API):** `client/index.ts` updated signature to `rooms: v.array(v.string())`
- [ ] **Layer 3 (Backend):** `presence.ts` accepts `rooms` and loops internally
- [ ] **Both Mutations:** BOTH `heartbeat` AND `leave` updated (not just one)
- [ ] **Cleanup Untouched:** `cleanup` mutation still takes single `room` (not array)
- [ ] **Console Logs:** Updated to show array operations
- [ ] **Error Handling:** Changed from per-slot to per-batch

### Breaking Changes to Watch For:

❌ **Do NOT change:**
- `cleanup` mutation (scheduler calls this)
- `getPresence` query (UI checks one slot at a time)
- Scheduler job scheduling (still per-room)

✅ **Must change together:**
- `heartbeat` mutation signature
- `leave` mutation signature
- Client wrapper args
- Frontend hook calls

---

## 📊 Success Criteria

### Functional Requirements
- ✅ Single slot booking: 1 HTTP request (not 1 per slot)
- ✅ Multi-slot booking: 1 HTTP request (not N per slot)
- ✅ Cleanup: 1 HTTP request for all slots
- ✅ All slots held atomically (transaction succeeds or fails as unit)
- ✅ Existing presence functionality unchanged

### Performance Requirements
- ✅ 2-slot booking: 50% fewer HTTP requests (16 → 8 over 30 seconds)
- ✅ 5-slot booking: 80% fewer HTTP requests (40 → 8 over 30 seconds)
- ✅ 8-slot booking: 87.5% fewer HTTP requests (64 → 8 over 30 seconds)
- ✅ Backend response time: < 500ms for 8 rooms

### Code Quality Requirements
- ✅ No client-side loops for network calls
- ✅ All three layers updated consistently
- ✅ Error messages show array context
- ✅ Backward compatible schema (no DB migration needed)

---

## 🗂️ Files Modified Summary

| File | Changes | Lines Changed |
|------|---------|---------------|
| `packages/convex-booking/src/component/presence.ts` | Update `heartbeat` and `leave` to accept arrays | ~30 lines |
| `packages/convex-booking/src/client/index.ts` | Update wrapper signatures | ~10 lines |
| `lib/hooks/use-slot-hold.ts` | Remove loops, pass arrays | ~15 lines |

**Total:** 3 files, ~55 lines changed

---

## 🚀 Implementation Checklist

### Phase 1: Backend
- [ ] Update `heartbeat` mutation in `presence.ts`
  - [ ] Change `room: v.string()` to `rooms: v.array(v.string())`
  - [ ] Add `for (const room of args.rooms)` loop
  - [ ] Keep per-room cleanup job scheduling
  - [ ] Test with 1, 2, and 5 rooms
- [ ] Update `leave` mutation in `presence.ts`
  - [ ] Change `room: v.string()` to `rooms: v.array(v.string())`
  - [ ] Add `for (const room of args.rooms)` loop
  - [ ] Test cleanup with multiple rooms
- [ ] Verify `cleanup` mutation unchanged (single room)
- [ ] Test all three mutations work together

### Phase 2: Client API
- [ ] Update `client/index.ts` wrapper
  - [ ] Change `heartbeat` args to `rooms: v.array(v.string())`
  - [ ] Change `leave` args to `rooms: v.array(v.string())`
  - [ ] Keep `getPresence` args unchanged
  - [ ] Verify wrapper passes args through correctly

### Phase 3: Frontend
- [ ] Update `use-slot-hold.ts`
  - [ ] Replace initial heartbeat loop with single call
  - [ ] Replace interval heartbeat loop with single call
  - [ ] Replace cleanup loop with single call
  - [ ] Update console logs to show array
  - [ ] Update error messages
- [ ] Test in browser
  - [ ] Network tab shows 1 request per batch
  - [ ] Console shows correct array logs
  - [ ] Multi-slot holds work
  - [ ] Cleanup works

### Phase 4: Integration Testing
- [ ] Test Scenario 1: Single slot (1 room array)
- [ ] Test Scenario 2: Two slots (2 room array)
- [ ] Test Scenario 3: Five slots (5 room array)
- [ ] Test Scenario 4: Back button cleanup
- [ ] Test Scenario 5: Multi-user (User A holds, User B sees)
- [ ] Monitor network tab for request count
- [ ] Monitor Convex dashboard for mutation timing

---

## 🎓 Key Learnings

### 1. Why Batch at the API Layer?

**Wrong Approach:**
```typescript
// Backend accepts single room
// Client batches by calling multiple times in loop
```
❌ Still sends N HTTP requests
❌ Not atomic
❌ Can't optimize on server

**Right Approach:**
```typescript
// Backend accepts array
// Client sends array in single request
```
✅ 1 HTTP request
✅ Atomic transaction
✅ Server can optimize

---

### 2. Why Keep Cleanup as Single Room?

**Each room has independent timeout:**
- Room A: Heartbeat at 10:00:00 → Cleanup at 10:00:10
- Room B: Heartbeat at 10:00:05 → Cleanup at 10:00:15

**Can't batch cleanup because:**
- Scheduled functions execute at different times
- Each room needs separate scheduled job
- This is correct and unavoidable

---

### 3. Error Handling Philosophy

**Fail-Fast (Recommended):**
```typescript
for (const room of args.rooms) {
  await updatePresence(room); // Throws on error
  // Transaction rolls back if ANY room fails
}
```
✅ All-or-nothing atomicity
✅ No confusing partial states
❌ User sees error for transient failures

**Partial Success (Alternative):**
```typescript
for (const room of args.rooms) {
  try {
    await updatePresence(room);
  } catch (err) {
    console.error(err);
    // Continue to next room
  }
}
```
✅ More resilient to transient errors
❌ Partial holds can confuse users
❌ Harder to debug

**My Recommendation:** Fail-fast for MVP. Add retry logic at client level if needed.

---

## 🔮 Future Enhancements

### 1. Batch Presence Check (Query)

Currently, `getPresence` checks one room at a time:
```typescript
const presence1 = useQuery(api.booking.getPresence, { room: "10:00" });
const presence2 = useQuery(api.booking.getPresence, { room: "11:00" });
```

**Future:** Batch query for multiple rooms:
```typescript
const presence = useQuery(api.booking.getPresenceMulti, {
  rooms: ["10:00", "11:00"]
});
// Returns: { "10:00": [...], "11:00": [...] }
```

**Impact:** Reduces query count in time slots panel

---

### 2. Optimistic UI Updates

Show held state immediately before mutation completes:
```typescript
setOptimisticHold(affectedSlots);
await heartbeat({ rooms: affectedSlots, user });
// Already showing as held!
```

---

### 3. Retry Logic

Add automatic retry for transient errors:
```typescript
try {
  await heartbeat({ rooms, user });
} catch (err) {
  console.warn("Heartbeat failed, retrying...");
  await delay(1000);
  await heartbeat({ rooms, user });
}
```

---

## ⚠️ Breaking Changes

**None if all three layers updated together.**

**But if you update backend without updating frontend:**
```
Frontend: heartbeat({ room: "10:00", user })
Backend: expects rooms: v.array(v.string())
Result: ❌ Type error, mutation fails
```

**Solution:** Update all three layers in same deployment/commit.

---

## 🎯 Definition of Done

This optimization is **COMPLETE** when:

1. ✅ `heartbeat` mutation accepts `rooms: v.array(v.string())`
2. ✅ `leave` mutation accepts `rooms: v.array(v.string())`
3. ✅ `cleanup` mutation still accepts `room: v.string()` (singular)
4. ✅ Client API wrapper updated to pass through arrays
5. ✅ Frontend hook passes single array instead of looping
6. ✅ Network tab shows 1 request per batch (not N)
7. ✅ Console logs show array operations
8. ✅ Multi-slot booking holds all slots atomically
9. ✅ Back button cleanup works with single request
10. ✅ No regressions in existing functionality

---

**End of Plan** ✅
