# ConvexBooking: Core Documentation

**Status:** Production-Ready | **Last Updated:** Dec 3, 2025

## Architecture Overview

**3-Tier System:**
1. **Component Layer** (`packages/convex-booking/src/component/`) - Pure business logic, trusted zone
2. **App Wrapper** (`convex/public.ts`, `convex/admin.ts`) - Auth enforcement, env var injection
3. **Frontend** - Reactive UI, presence-aware derivation

**Key Pattern:** Separate stable queries (getDaySlots) from volatile queries (getDatePresence) for O(1) invalidation.

## Database Schema

**Daily Availability:**
```typescript
daily_availability: {
  resourceId, date, busySlots: [0-95]  // 15-min slots per day
}
```

**Presence (Real-time holds):**
```typescript
presence: { resourceId, slot, user, updated }
// Index: ["resourceId", "slot", "updated"]
```

## Critical Patterns

### 1. Frontend Derivation
- Backend: getDaySlots (confirmed bookings only, duration-specific)
- Backend: getDatePresence (active holds, shared across durations)
- Frontend: Merge + filter for span conflicts → availableSlots + reservedSlots

### 2. Container/Presenter Forms
Queries in parent → Props to child form (prevents infinite loops from useQuery array refs)

### 3. 3-Tier Auth
Frontend → publicMutation builder (checks auth) → Component (trusted)

## File Organization

**Backend:** schema.ts | presence.ts | public.ts | utils.ts | resources.ts | hooks.ts
**Hooks:** use-convex-slots.ts (critical - presence filtering) | use-slot-hold.ts
**UI:** booking-calendar/calendar.tsx | time-slots-panel.tsx | booker/booker.tsx
**App:** convex/functions.ts (custom builders) | public.ts (API wrapper) | admin.ts

## Critical Gotchas

1. **Presence timeout:** Fixed 10s (`packages/convex-booking/src/component/presence.ts:4`)
2. **Slot math:** `hours * 4 + Math.floor(minutes / 15)` not `hours * 60`
3. **Duration lock:** Once selected, can't change without clicking "Back"
4. **Radix UI:** Requires `React.forwardRef` in React 19
5. **Forms:** Never use `useQuery` inside form components
6. **Component isolation:** Can't access `process.env` - use dependency injection
7. **Auth in wrapper:** Not in component - enables component reuse
8. **Multi-duration conflict:** Frontend checks `hasPresenceConflict(slot, duration, presence)`

## Components Ecosystem

```
App (convex/convex.config.ts)
├─ workOSAuthKit (NPM)
└─ booking (NPM)
   └─ resend (nested)
```

Build order for nested components: codegen nested → codegen main → npm pack

## Testing Scenarios

1. Multi-duration conflict detection (5h booking shouldn't overlap 1h hold)
2. Resource isolation (StudioA holds don't block StudioB)
3. Hold reactivity (slots reappear when hold expires)
4. Query caching (different durations = different slot queries, same presence query)

## Dev Workflow

**User Preferences:**
- Dev server runs in separate terminal (manual)
- Use AskUserQuestion for plan clarifications
- German ok for communication

**Common commands:**
```bash
npx convex dev                    # Start backend (separate terminal)
npx convex data clear --all       # Reset after schema changes
npm run dev                       # Start Next.js (separate terminal)
npx convex codegen               # For nested components
npm pack --ignore-scripts        # Pack component
```

**Env vars (Convex Dashboard):**
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=bookings@...
WORKOS_WEBHOOK_SECRET=...
```

## Email Integration

Hooks trigger emails on booking.created/cancelled. Email via nested Resend component. Graceful fallback if no API key.

## Recent Fixes (Nov 26)

- Form infinite loop: Container/Presenter pattern (queries in parent, form receives props)
- Radix UI: Added React.forwardRef to Select/Switch/Checkbox
- Schema: Changed organizationId to v.string()

## Philosophy

Inventory management + ACID guarantees + Real-time > Cal.com appointment model. Component designed for Convex ecosystem contribution.
