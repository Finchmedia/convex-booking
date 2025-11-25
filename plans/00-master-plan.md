# ConvexBooking Feature Expansion: Master Plan

> **Plan Location:** `plans/00-master-plan.md`
> **Sub-plans Location:** `plans/booking-expansion/`

## Sub-Plans

| Sub-Plan | File | Scope |
|----------|------|-------|
| Schema & Backend Core | `01-schema-backend.md` | All schema changes, backend files, unit tests |
| Admin UI | `02-admin-ui.md` | Layout, event types, bookings, resources pages |
| Booker Enhancements | `03-booker-enhancements.md` | Multi-resource selection, event type picker |

---

## Overview

Transform the booking component from MVP to a production-ready, showcase-worthy system with:
- Full admin UI (Cal.com parity)
- Multi-resource atomic booking
- Organization hierarchy
- Demo/playground environment

**Target Audience:** Convex team (Ian) for showcase, then Jumper production

---

## Phase 1: Convex Showcase (Priority)

### Goals
1. Demonstrate Convex's unique capabilities (atomic multi-resource, real-time presence)
2. Complete admin UI for event types + bookings management
3. Full organization hierarchy in component
4. Unit tests for core logic

### 1.1 Schema Expansion

**File:** `packages/convex-booking/src/component/schema.ts`

```typescript
// NEW: Organizations (full hierarchy)
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

// NEW: Teams within organizations
teams: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  createdAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// NEW: Members (users in orgs/teams)
members: defineTable({
  userId: v.string(),           // External auth ID
  organizationId: v.id("organizations"),
  teamId: v.optional(v.id("teams")),
  role: v.string(),             // "owner" | "admin" | "member" | "viewer"
  joinedAt: v.number(),
}).index("by_user", ["userId"]).index("by_org", ["organizationId"]),

// NEW: Resources (bookable items)
resources: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  type: v.string(),             // "room" | "equipment" | "person"
  description: v.optional(v.string()),
  timezone: v.string(),

  // Quantity tracking
  quantity: v.optional(v.number()),       // null = 1 (singular)
  isFungible: v.optional(v.boolean()),    // true = any unit works

  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// NEW: Schedules (weekly patterns)
schedules: defineTable({
  id: v.string(),
  organizationId: v.id("organizations"),
  name: v.string(),
  timezone: v.string(),
  isDefault: v.boolean(),
  weeklyHours: v.array(v.object({
    dayOfWeek: v.number(),      // 0-6
    startTime: v.string(),      // "09:00"
    endTime: v.string(),        // "17:00"
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_id", ["id"]).index("by_org", ["organizationId"]),

// NEW: Date overrides (holidays, custom hours)
date_overrides: defineTable({
  scheduleId: v.id("schedules"),
  date: v.string(),
  type: v.string(),             // "unavailable" | "custom"
  customHours: v.optional(v.array(v.object({
    startTime: v.string(),
    endTime: v.string(),
  }))),
}).index("by_schedule_date", ["scheduleId", "date"]),

// NEW: Booking items (for multi-resource)
booking_items: defineTable({
  bookingId: v.id("bookings"),
  resourceId: v.string(),
  quantity: v.number(),
}).index("by_booking", ["bookingId"]),

// NEW: Quantity availability tracking
quantity_availability: defineTable({
  resourceId: v.string(),
  date: v.string(),
  slotQuantities: v.any(),      // { "36": 2, "37": 1 } = booked count per slot
}).index("by_resource_date", ["resourceId", "date"]),

// NEW: Notification hooks
hooks: defineTable({
  eventType: v.string(),        // "booking.created" | "booking.cancelled"
  functionHandle: v.string(),
  organizationId: v.optional(v.id("organizations")),
  enabled: v.boolean(),
  createdAt: v.number(),
}).index("by_event", ["eventType", "enabled"]),

// EXTEND: event_types - add new fields
// Add to existing table:
// - organizationId: v.optional(v.id("organizations"))
// - scheduleId: v.optional(v.id("schedules"))
// - resourceIds: v.optional(v.array(v.string()))
// - bufferBefore: v.optional(v.number())
// - bufferAfter: v.optional(v.number())
// - minNoticeMinutes: v.optional(v.number())
// - maxFutureMinutes: v.optional(v.number())
// - isActive: v.optional(v.boolean())
// - requiresConfirmation: v.optional(v.boolean())

// EXTEND: bookings - add new fields
// Add to existing table:
// - organizationId: v.optional(v.id("organizations"))
// - status now includes: "pending" | "confirmed" | "cancelled" | "completed"
```

### 1.2 New Backend Files

| File | Purpose |
|------|---------|
| `packages/convex-booking/src/component/organizations.ts` | Org/team/member CRUD |
| `packages/convex-booking/src/component/resources.ts` | Resource CRUD |
| `packages/convex-booking/src/component/schedules.ts` | Schedule CRUD + effective availability |
| `packages/convex-booking/src/component/multi-resource.ts` | Atomic multi-resource booking |
| `packages/convex-booking/src/component/quantity.ts` | Pool availability tracking |
| `packages/convex-booking/src/component/hooks.ts` | Notification hook system |
| `packages/convex-booking/src/component/booking-states.ts` | State machine (pending→confirmed→cancelled) |

### 1.3 Admin UI Routes

```
app/
├── demo/
│   ├── layout.tsx                    # Shell with sidebar + role switcher
│   ├── page.tsx                      # Dashboard redirect
│   ├── provider/
│   │   ├── layout.tsx                # Provider nav context
│   │   ├── event-types/
│   │   │   ├── page.tsx              # Event types list
│   │   │   ├── new/page.tsx          # Create event type
│   │   │   └── [id]/page.tsx         # Edit event type
│   │   ├── bookings/
│   │   │   └── page.tsx              # Bookings list + detail modals
│   │   ├── availability/
│   │   │   └── page.tsx              # Schedule management
│   │   └── resources/
│   │       ├── page.tsx              # Resources list
│   │       └── new/page.tsx          # Create resource
│   └── booker/
│       └── [slug]/page.tsx           # Public booking by event type slug
```

### 1.4 Admin UI Components

```
components/admin/
├── layout/
│   ├── demo-layout.tsx               # Main shell
│   ├── demo-sidebar.tsx              # Navigation
│   └── role-switcher.tsx             # Provider/Booker toggle
├── event-types/
│   ├── event-types-list.tsx          # Table view
│   ├── event-type-card.tsx           # Card in list
│   ├── event-type-form.tsx           # Create/Edit form
│   ├── event-type-detail-modal.tsx   # Detail view
│   └── resource-picker.tsx           # Multi-resource selection
├── bookings/
│   ├── bookings-list.tsx             # Filterable table
│   ├── booking-card.tsx              # Row in list
│   ├── booking-detail-modal.tsx      # Full booking details
│   ├── bookings-filters.tsx          # Status/date/search filters
│   └── booking-actions.tsx           # Cancel/confirm buttons
├── availability/
│   ├── weekly-schedule-editor.tsx    # Mon-Sun hour toggles
│   ├── day-row.tsx                   # Single day config
│   ├── time-range-picker.tsx         # Start/end time inputs
│   └── date-overrides-list.tsx       # Holiday management
└── resources/
    ├── resources-list.tsx
    ├── resource-card.tsx
    └── resource-form.tsx
```

### 1.5 Shadcn Components to Add

```bash
npx shadcn@latest add sidebar dropdown-menu avatar separator sheet tabs popover command switch dialog tooltip skeleton toast table badge
```

### 1.6 Unit Tests

**File:** `packages/convex-booking/src/component/logic.test.ts` (extend)

Test coverage for:
- Buffer time slot calculations
- Booking window validation (min/max notice)
- Schedule → available slots conversion
- Multi-resource availability checks
- Quantity pool tracking
- State machine transitions

---

## Phase 2: Production Foundation

### Goals
1. Booking states (pending → confirmed → cancelled → completed)
2. Full schedule management with date overrides
3. Resource permissions (who can book what)
4. Enhanced cancellation with policies

### 2.1 Additional Schema

```typescript
// Booking state history (audit trail)
booking_history: defineTable({
  bookingId: v.id("bookings"),
  fromStatus: v.string(),
  toStatus: v.string(),
  changedBy: v.optional(v.string()),
  reason: v.optional(v.string()),
  timestamp: v.number(),
}).index("by_booking", ["bookingId"]),

// Resource permissions (who can book)
resource_permissions: defineTable({
  resourceId: v.string(),
  organizationId: v.optional(v.id("organizations")),
  teamId: v.optional(v.id("teams")),
  userId: v.optional(v.string()),
  permission: v.string(),       // "view" | "book" | "manage" | "admin"
}).index("by_resource", ["resourceId"]),
```

### 2.2 Features

- Auto-completion scheduler (mark past bookings as completed)
- Cancellation policies (min notice required)
- Reschedule flow
- Confirmation workflow (admin approves pending bookings)

---

## Phase 3: Advanced Features

### Goals
1. Waitlist with auto-promotion
2. Recurring bookings
3. Live demand signals
4. Predictive availability suggestions

---

## Workstream Execution Order

### Parallel Track A: Backend Core
1. Schema expansion (all new tables)
2. Organizations/teams/members CRUD
3. Resources CRUD
4. Schedules CRUD + effective availability
5. Multi-resource booking logic
6. Quantity tracking
7. Hook system
8. Unit tests

### Parallel Track B: Admin UI
1. Add shadcn components
2. Demo layout shell + sidebar
3. Event types list page
4. Event type create/edit form
5. Event type detail modal
6. Bookings list page
7. Bookings filters
8. Booking detail modal
9. Availability/schedule page
10. Resources page

### Dependencies
```
Track A (Backend)         Track B (UI)
────────────────         ────────────
Schema expansion    ──►  Can start layout shell (no deps)
       │
Organizations CRUD  ──►  Demo context needs org ID
       │
Resources CRUD      ──►  Resources page
       │
Schedules CRUD      ──►  Availability page
       │
Event types extend  ──►  Event types CRUD pages
       │
Bookings queries    ──►  Bookings list page
       │
Multi-resource      ──►  Resource picker in event type form
```

---

## Critical Files Summary

### Must Modify (Backend)
| File | Changes |
|------|---------|
| `packages/convex-booking/src/component/schema.ts` | All new tables + extended fields |
| `packages/convex-booking/src/component/public.ts` | Buffer/window validation, schedule integration |
| `packages/convex-booking/src/component/utils.ts` | Buffer-aware slot generation |
| `packages/convex-booking/src/client/index.ts` | Expose all new APIs |
| `convex/booking.ts` | Re-export new APIs |

### Must Create (Backend)
| File | Purpose |
|------|---------|
| `packages/convex-booking/src/component/organizations.ts` | Org hierarchy CRUD |
| `packages/convex-booking/src/component/resources.ts` | Resource management |
| `packages/convex-booking/src/component/schedules.ts` | Schedule logic |
| `packages/convex-booking/src/component/multi-resource.ts` | Atomic booking |
| `packages/convex-booking/src/component/quantity.ts` | Pool tracking |
| `packages/convex-booking/src/component/hooks.ts` | Notification system |

### Must Create (Frontend)
| File | Purpose |
|------|---------|
| `app/demo/layout.tsx` | Demo shell |
| `app/demo/provider/event-types/page.tsx` | Event types list |
| `app/demo/provider/bookings/page.tsx` | Bookings list |
| `components/admin/layout/demo-sidebar.tsx` | Navigation |
| `components/admin/event-types/event-type-form.tsx` | Create/edit |
| `components/admin/bookings/bookings-list.tsx` | Table + filters |

---

## Commit Strategy

1. **Pre-implementation commit**: Checkpoint current state before starting
2. **Per-workstream commits**: One commit per completed feature/page
3. **Semantic commits**: `feat:`, `fix:`, `refactor:` prefixes

---

## First Steps (After Plan Approval)

1. **Create pre-implementation commit** - Checkpoint current working state
2. **Create sub-plan directory** - `/Users/danielfinke/.claude/plans/booking-expansion/`
3. **Write sub-plan files** - Detailed step-by-step for each workstream
4. **Add shadcn components** - All UI dependencies upfront
5. **Begin parallel execution** - Backend schema + Admin layout shell

---

## Demo Environment Setup

### Demo Context
```typescript
// lib/context/demo-context.tsx
interface DemoContext {
  currentRole: "provider" | "booker";
  demoOrgId: string;
  demoOrgName: string;
  switchRole: (role: "provider" | "booker") => void;
  resetDemoData: () => Promise<void>;
}
```

### Seed Script
```typescript
// convex/seed.ts - Enhanced
export const seedDemoData = mutation({
  handler: async (ctx) => {
    // 1. Create demo organization
    // 2. Create demo resources (Studio A, Studio B, 3x SM57 mics)
    // 3. Create default schedule (Mon-Fri 9-17)
    // 4. Create event types (Studio Session, Podcast Recording)
    // 5. Create sample bookings (upcoming, past, cancelled)
  }
});
```

---

## Success Criteria

### For Convex Showcase
- [ ] Admin can create event type with multiple resources
- [ ] Admin can view bookings list with filters
- [ ] Booker can book multi-resource session (Studio + mic)
- [ ] Real-time presence works across resources
- [ ] Atomic transaction demo (book fails if ANY resource unavailable)

### For Jumper MVP
- [ ] Schedule management matches Cal.com UX
- [ ] Booking states flow correctly
- [ ] Organization hierarchy supports subletting model
- [ ] Cancellation releases all resource slots
