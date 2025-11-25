# Sub-Plan 01: Schema & Backend Core

## Overview
Expand the booking component schema and create new backend files for organizations, resources, schedules, and multi-resource booking.

## Dependencies
- None (this is foundational)

## Parallel Work Possible
- Admin UI layout shell can start while this is in progress

---

## Step 1: Schema Expansion

**File:** `packages/convex-booking/src/component/schema.ts`

### 1.1 New Tables to Add

```typescript
// Organizations (full hierarchy)
organizations: defineTable({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  settings: v.optional(v.object({
    defaultTimezone: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_id", ["id"]).index("by_slug", ["slug"]),

// Teams within organizations
teams: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  createdAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// Members (users in orgs/teams)
members: defineTable({
  userId: v.string(),
  organizationId: v.id("organizations"),
  teamId: v.optional(v.id("teams")),
  role: v.string(),  // "owner" | "admin" | "member" | "viewer"
  joinedAt: v.number(),
}).index("by_user", ["userId"]).index("by_org", ["organizationId"]),

// Resources (bookable items)
resources: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  type: v.string(),  // "room" | "equipment" | "person"
  description: v.optional(v.string()),
  timezone: v.string(),
  quantity: v.optional(v.number()),
  isFungible: v.optional(v.boolean()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// Schedules (weekly patterns)
schedules: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  timezone: v.string(),
  isDefault: v.boolean(),
  weeklyHours: v.array(v.object({
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// Date overrides
date_overrides: defineTable({
  scheduleId: v.id("schedules"),
  date: v.string(),
  type: v.string(),  // "unavailable" | "custom"
  customHours: v.optional(v.array(v.object({
    startTime: v.string(),
    endTime: v.string(),
  }))),
}).index("by_schedule_date", ["scheduleId", "date"]),

// Booking items (multi-resource)
booking_items: defineTable({
  bookingId: v.id("bookings"),
  resourceId: v.string(),
  quantity: v.number(),
}).index("by_booking", ["bookingId"]),

// Quantity availability
quantity_availability: defineTable({
  resourceId: v.string(),
  date: v.string(),
  slotQuantities: v.any(),
}).index("by_resource_date", ["resourceId", "date"]),

// Notification hooks
hooks: defineTable({
  eventType: v.string(),
  functionHandle: v.string(),
  organizationId: v.optional(v.id("organizations")),
  enabled: v.boolean(),
  createdAt: v.number(),
}).index("by_event", ["eventType", "enabled"]),
```

### 1.2 Extend Existing Tables

**event_types** - Add fields:
- `organizationId: v.optional(v.id("organizations"))`
- `scheduleId: v.optional(v.string())`
- `resourceIds: v.optional(v.array(v.string()))`
- `bufferBefore: v.optional(v.number())`
- `bufferAfter: v.optional(v.number())`
- `minNoticeMinutes: v.optional(v.number())`
- `maxFutureMinutes: v.optional(v.number())`
- `isActive: v.optional(v.boolean())`
- `requiresConfirmation: v.optional(v.boolean())`

**bookings** - Add fields:
- `organizationId: v.optional(v.id("organizations"))`
- Update status to include: "pending" | "confirmed" | "cancelled" | "completed"

---

## Step 2: Create organizations.ts

**File:** `packages/convex-booking/src/component/organizations.ts`

### Functions to Create

```typescript
// Queries
export const getOrganization = query({ ... })
export const getOrganizationBySlug = query({ ... })
export const listOrganizations = query({ ... })
export const getTeam = query({ ... })
export const listTeams = query({ ... })
export const getMember = query({ ... })
export const listMembers = query({ ... })

// Mutations
export const createOrganization = mutation({ ... })
export const updateOrganization = mutation({ ... })
export const deleteOrganization = mutation({ ... })
export const createTeam = mutation({ ... })
export const updateTeam = mutation({ ... })
export const deleteTeam = mutation({ ... })
export const addMember = mutation({ ... })
export const updateMember = mutation({ ... })
export const removeMember = mutation({ ... })
```

---

## Step 3: Create resources.ts

**File:** `packages/convex-booking/src/component/resources.ts`

### Functions to Create

```typescript
// Queries
export const getResource = query({ ... })
export const listResources = query({ ... })
export const listResourcesByType = query({ ... })

// Mutations
export const createResource = mutation({ ... })
export const updateResource = mutation({ ... })
export const deleteResource = mutation({ ... })
export const toggleResourceActive = mutation({ ... })
```

---

## Step 4: Create schedules.ts

**File:** `packages/convex-booking/src/component/schedules.ts`

### Functions to Create

```typescript
// Queries
export const getSchedule = query({ ... })
export const listSchedules = query({ ... })
export const getEffectiveAvailability = query({ ... })  // Returns available slots for date
export const listDateOverrides = query({ ... })

// Mutations
export const createSchedule = mutation({ ... })
export const updateSchedule = mutation({ ... })
export const deleteSchedule = mutation({ ... })
export const createDateOverride = mutation({ ... })
export const updateDateOverride = mutation({ ... })
export const deleteDateOverride = mutation({ ... })
```

### Key Logic: getEffectiveAvailability

```typescript
// 1. Get schedule for resource
// 2. Check for date override
// 3. If override: use custom hours or return empty
// 4. If no override: use weekly schedule for day of week
// 5. Convert time ranges to slot indices (0-95)
// 6. Return available slot indices
```

---

## Step 5: Create multi-resource.ts

**File:** `packages/convex-booking/src/component/multi-resource.ts`

### Functions to Create

```typescript
// Queries
export const checkMultiResourceAvailability = query({
  args: {
    resources: v.array(v.object({
      resourceId: v.string(),
      quantity: v.optional(v.number()),
    })),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, args) => {
    // Check ALL resources are available
    // Return { available: boolean, conflicts: [...] }
  },
})

// Mutations
export const createMultiResourceBooking = mutation({
  args: {
    eventTypeId: v.string(),
    resources: v.array(v.object({
      resourceId: v.string(),
      quantity: v.optional(v.number()),
    })),
    start: v.number(),
    end: v.number(),
    timezone: v.string(),
    booker: v.object({ ... }),
  },
  handler: async (ctx, args) => {
    // 1. Check ALL resources available (fail-fast)
    // 2. Create main booking record
    // 3. Create booking_items for each resource
    // 4. Mark slots busy for each resource
    // 5. Return booking
    // ATOMIC: All succeed or all fail
  },
})
```

---

## Step 6: Create quantity.ts

**File:** `packages/convex-booking/src/component/quantity.ts`

### Functions to Create

```typescript
// Helpers
export async function checkPoolAvailability(
  ctx, resourceId, start, end, requestedQty
) {
  // 1. Get resource and total quantity
  // 2. Get quantity_availability for date range
  // 3. For each slot: check if (booked + requested) <= total
  // 4. Return { available: boolean, maxAvailable: number }
}

export async function reservePoolQuantity(
  ctx, resourceId, start, end, quantity
) {
  // 1. Get or create quantity_availability docs
  // 2. Increment booked count for each slot
  // 3. Validate doesn't exceed total
}

export async function releasePoolQuantity(
  ctx, resourceId, start, end, quantity
) {
  // 1. Get quantity_availability docs
  // 2. Decrement booked count for each slot
}
```

---

## Step 7: Create hooks.ts

**File:** `packages/convex-booking/src/component/hooks.ts`

### Functions to Create

```typescript
// Mutations
export const registerHook = mutation({
  args: {
    eventType: v.string(),  // "booking.created" | "booking.cancelled"
    functionHandle: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => { ... },
})

export const unregisterHook = mutation({ ... })

// Internal
export const triggerHooks = internalMutation({
  args: {
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Find all enabled hooks for eventType
    // 2. For each hook: ctx.scheduler.runAfter(0, handle, payload)
  },
})
```

### Integration Points

Call `triggerHooks` in:
- `createBooking` → "booking.created"
- `createMultiResourceBooking` → "booking.created"
- `cancelReservation` → "booking.cancelled"

---

## Step 8: Update public.ts

**File:** `packages/convex-booking/src/component/public.ts`

### Modifications

1. **getDaySlots** - Integrate schedule-based availability
2. **createBooking** - Add buffer validation, hook triggering
3. **cancelReservation** - Release quantity, trigger hooks

---

## Step 9: Update client/index.ts

**File:** `packages/convex-booking/src/client/index.ts`

### Add to makeBookingAPI

```typescript
// Organizations
createOrganization, getOrganization, listOrganizations,
createTeam, getTeam, listTeams,
addMember, getMember, listMembers,

// Resources
createResource, getResource, listResources, updateResource, deleteResource,

// Schedules
createSchedule, getSchedule, listSchedules, updateSchedule, deleteSchedule,
getEffectiveAvailability,
createDateOverride, listDateOverrides, deleteDateOverride,

// Multi-resource
checkMultiResourceAvailability, createMultiResourceBooking,

// Hooks
registerHook, unregisterHook,
```

---

## Step 10: Update convex/booking.ts

**File:** `convex/booking.ts`

Re-export all new functions for main app usage.

---

## Step 11: Unit Tests

**File:** `packages/convex-booking/src/component/logic.test.ts`

### Test Cases to Add

```typescript
describe("Buffer Times", () => {
  it("calculates buffered slot range correctly", () => { ... })
  it("detects buffer conflicts with adjacent bookings", () => { ... })
})

describe("Booking Window", () => {
  it("rejects bookings before min notice", () => { ... })
  it("rejects bookings beyond max future", () => { ... })
  it("accepts bookings within window", () => { ... })
})

describe("Schedule Availability", () => {
  it("converts weekly hours to slot indices", () => { ... })
  it("applies date overrides correctly", () => { ... })
  it("handles unavailable override", () => { ... })
})

describe("Quantity Pool", () => {
  it("checks pool availability correctly", () => { ... })
  it("allows booking up to total quantity", () => { ... })
  it("rejects booking exceeding quantity", () => { ... })
})

describe("Multi-Resource", () => {
  it("checks all resources atomically", () => { ... })
  it("fails if any resource unavailable", () => { ... })
  it("books all resources in single transaction", () => { ... })
})
```

---

## Checklist

- [ ] Add all new tables to schema.ts
- [ ] Extend event_types and bookings tables
- [ ] Create organizations.ts with CRUD
- [ ] Create resources.ts with CRUD
- [ ] Create schedules.ts with CRUD + effective availability
- [ ] Create multi-resource.ts with atomic booking
- [ ] Create quantity.ts with pool tracking
- [ ] Create hooks.ts with notification system
- [ ] Update public.ts with schedule/buffer integration
- [ ] Update client/index.ts with all new exports
- [ ] Update convex/booking.ts with re-exports
- [ ] Write unit tests for core logic
