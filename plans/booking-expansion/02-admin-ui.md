# Sub-Plan 02: Admin UI

## Overview
Build the provider-side admin dashboard with event types management, bookings list, and resources management.

## Dependencies
- Sub-Plan 01 (Schema & Backend) for API endpoints
- Can start layout shell immediately (no backend deps)

## Parallel Work Possible
- Layout shell can start before backend is ready
- Components can be built with mock data initially

---

## Step 1: Add Shadcn Components

```bash
npx shadcn@latest add sidebar dropdown-menu avatar separator sheet tabs popover command switch dialog tooltip skeleton toast table badge card
```

---

## Step 2: Create Demo Layout Shell

### 2.1 Demo Layout

**File:** `app/demo/layout.tsx`

```tsx
import { DemoSidebar } from "@/components/admin/layout/demo-sidebar"
import { DemoHeader } from "@/components/admin/layout/demo-header"
import { DemoContextProvider } from "@/lib/context/demo-context"

export default function DemoLayout({ children }) {
  return (
    <DemoContextProvider>
      <div className="flex h-screen">
        <DemoSidebar />
        <div className="flex-1 flex flex-col">
          <DemoHeader />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </DemoContextProvider>
  )
}
```

### 2.2 Demo Sidebar

**File:** `components/admin/layout/demo-sidebar.tsx`

```
Navigation Items:
├── Dashboard (/)
├── Event Types (/demo/provider/event-types)
├── Bookings (/demo/provider/bookings)
├── Availability (/demo/provider/availability)
├── Resources (/demo/provider/resources)
└── [Role Switcher at bottom]
```

### 2.3 Demo Header

**File:** `components/admin/layout/demo-header.tsx`

- Page title (dynamic based on route)
- Demo mode indicator banner
- Reset demo data button

### 2.4 Demo Context

**File:** `lib/context/demo-context.tsx`

```typescript
interface DemoContextValue {
  currentRole: "provider" | "booker"
  setRole: (role: "provider" | "booker") => void
  demoOrgId: string
  resetDemoData: () => Promise<void>
}
```

---

## Step 3: Event Types Pages

### 3.1 Event Types List

**File:** `app/demo/provider/event-types/page.tsx`

```
+----------------------------------------------------------+
| Event Types                              [+ New Event]   |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| | [ON/OFF] Studio Session              [···] Menu      | |
| | 60, 120, 300 min - Studio A, Studio B                | |
| | /studio-session                                      | |
| | [Preview] [Copy Link] [Edit]                         | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| | [ON/OFF] Podcast Recording           [···] Menu      | |
| | 30 min - Podcast Room                                | |
| | /podcast                                             | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Components:**
- `EventTypesList` - Grid/list of cards
- `EventTypeCard` - Single event type card
- `EventTypeActions` - Edit, delete, copy link

**Data:** `useQuery(api.booking.listEventTypes, { organizationId })`

### 3.2 Create Event Type

**File:** `app/demo/provider/event-types/new/page.tsx`

- Uses `EventTypeForm` component
- Redirects to edit page after creation

### 3.3 Edit Event Type

**File:** `app/demo/provider/event-types/[id]/page.tsx`

**Tabs Structure:**
1. **Setup** - Title, slug, description, durations
2. **Resources** - Multi-resource selection
3. **Availability** - Schedule selection, buffer times
4. **Advanced** - Min notice, max future, confirmation required

### 3.4 Event Type Form

**File:** `components/admin/event-types/event-type-form.tsx`

**Fields:**
- Title (text)
- Slug (text, auto-generated)
- Description (textarea)
- Duration options (multi-select chips: 30, 60, 120, 300 min)
- Slot interval (select: 15, 30, 60 min)
- Resources (multi-select with ResourcePicker)
- Schedule (select from schedules)
- Buffer before/after (number inputs)
- Min notice (number + unit select)
- Max future booking (number + unit select)
- Requires confirmation (switch)
- Active (switch)

### 3.5 Event Type Detail Modal

**File:** `components/admin/event-types/event-type-detail-modal.tsx`

- Read-only view of all event type settings
- Quick stats: bookings count, upcoming count
- Actions: Edit, Delete, Copy Link

---

## Step 4: Bookings Pages

### 4.1 Bookings List

**File:** `app/demo/provider/bookings/page.tsx`

```
+----------------------------------------------------------+
| Bookings                                                 |
+----------------------------------------------------------+
| [Upcoming] [Past] [Cancelled] [Pending]                  |
+----------------------------------------------------------+
| Filters: [Date ▼] [Event Type ▼] [Resource ▼] [Search]   |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| | Nov 26, 2025 - 10:00 AM                              | |
| | Studio Session - Studio A                            | |
| | John Doe - john@example.com                          | |
| | [View] [Confirm] [Cancel]                            | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| | Nov 26, 2025 - 2:00 PM                               | |
| | Podcast Recording - Podcast Room                     | |
| | Jane Smith - jane@example.com                        | |
| | [View] [Confirm] [Cancel]                            | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
| Showing 1-10 of 47            [< Prev] [1] [2] [Next >]  |
+----------------------------------------------------------+
```

**Components:**
- `BookingsList` - Table/card view
- `BookingCard` - Single booking row
- `BookingsFilters` - Status tabs, date range, search
- `BookingsPagination` - Page controls

**Data:**
```typescript
useQuery(api.booking.listBookings, {
  organizationId,
  status: "upcoming" | "past" | "cancelled" | "pending",
  eventTypeId?: string,
  resourceId?: string,
  search?: string,
  page: number,
  limit: 10,
})
```

### 4.2 Booking Detail Modal

**File:** `components/admin/bookings/booking-detail-modal.tsx`

**Sections:**
- Header: Status badge, date/time
- Booker info: Name, email, phone, notes
- Event info: Type, duration, resources
- Timeline: Created, confirmed, etc.
- Actions: Confirm, Cancel, Reschedule

### 4.3 Booking Actions

**File:** `components/admin/bookings/booking-actions.tsx`

- Confirm button (for pending)
- Cancel button (with reason dialog)
- Reschedule button (opens date picker)

---

## Step 5: Availability/Schedule Page

### 5.1 Schedule Management

**File:** `app/demo/provider/availability/page.tsx`

```
+----------------------------------------------------------+
| Availability                          [+ New Schedule]   |
+----------------------------------------------------------+
| Current Schedule: [Default Hours ▼]                      |
+----------------------------------------------------------+
| WEEKLY HOURS                                             |
| +------------------------------------------------------+ |
| | [ON]  Monday      09:00 - 17:00    [+ Add] [Delete]  | |
| | [ON]  Tuesday     09:00 - 17:00    [+ Add] [Delete]  | |
| | [ON]  Wednesday   09:00 - 17:00    [+ Add] [Delete]  | |
| | [ON]  Thursday    09:00 - 17:00    [+ Add] [Delete]  | |
| | [ON]  Friday      09:00 - 17:00    [+ Add] [Delete]  | |
| | [OFF] Saturday    Unavailable                        | |
| | [OFF] Sunday      Unavailable                        | |
| +------------------------------------------------------+ |
|                                                          |
| DATE-SPECIFIC HOURS                                      |
| +------------------------------------------------------+ |
| | [+ Add Date Override]                                | |
| |                                                      | |
| | Dec 25, 2025 - Unavailable (Christmas)     [Delete]  | |
| | Dec 31, 2025 - 10:00-14:00 (New Year's)    [Delete]  | |
| +------------------------------------------------------+ |
|                                                          |
| TIMEZONE                                                 |
| +------------------------------------------------------+ |
| | [Europe/Berlin ▼]                                    | |
| +------------------------------------------------------+ |
|                                                          |
|                                    [Save Changes]        |
+----------------------------------------------------------+
```

**Components:**
- `WeeklyScheduleEditor` - 7-day grid
- `DayRow` - Single day with toggles and time ranges
- `TimeRangePicker` - Start/end time inputs
- `DateOverridesList` - List of overrides
- `DateOverrideDialog` - Create/edit override

---

## Step 6: Resources Page

### 6.1 Resources List

**File:** `app/demo/provider/resources/page.tsx`

```
+----------------------------------------------------------+
| Resources                              [+ New Resource]  |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| | [ON] Studio A                         [···] Menu     | |
| | Room - Full recording studio                         | |
| | Used by: Studio Session, Quick Recording             | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| | [ON] Studio B                         [···] Menu     | |
| | Room - Smaller podcast studio                        | |
| | Used by: Podcast Recording                           | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| | [ON] Shure SM57 (x3)                  [···] Menu     | |
| | Equipment - Quantity: 3                              | |
| | Used by: Studio Session (addon)                      | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Components:**
- `ResourcesList` - Grid of resource cards
- `ResourceCard` - Single resource
- `ResourceForm` - Create/edit form

### 6.2 Create/Edit Resource

**File:** `app/demo/provider/resources/new/page.tsx`
**File:** `app/demo/provider/resources/[id]/page.tsx`

**Fields:**
- Name (text)
- Type (select: room, equipment, person)
- Description (textarea)
- Timezone (select)
- Quantity (number, for equipment)
- Is Fungible (switch, for pooled resources)
- Active (switch)

---

## Step 7: Dashboard Page

**File:** `app/demo/provider/page.tsx`

Quick stats overview:
- Today's bookings count
- Pending confirmations
- This week's bookings
- Quick links to other pages

---

## Component File Structure

```
components/admin/
├── layout/
│   ├── demo-layout.tsx
│   ├── demo-sidebar.tsx
│   ├── demo-header.tsx
│   └── role-switcher.tsx
├── event-types/
│   ├── event-types-list.tsx
│   ├── event-type-card.tsx
│   ├── event-type-form.tsx
│   ├── event-type-detail-modal.tsx
│   ├── duration-selector.tsx
│   └── resource-picker.tsx
├── bookings/
│   ├── bookings-list.tsx
│   ├── booking-card.tsx
│   ├── booking-detail-modal.tsx
│   ├── bookings-filters.tsx
│   ├── bookings-pagination.tsx
│   └── booking-actions.tsx
├── availability/
│   ├── weekly-schedule-editor.tsx
│   ├── day-row.tsx
│   ├── time-range-picker.tsx
│   ├── date-overrides-list.tsx
│   └── date-override-dialog.tsx
└── resources/
    ├── resources-list.tsx
    ├── resource-card.tsx
    └── resource-form.tsx
```

---

## Route Structure

```
app/demo/
├── layout.tsx                      # Demo shell
├── page.tsx                        # Dashboard
└── provider/
    ├── layout.tsx                  # Provider context
    ├── event-types/
    │   ├── page.tsx                # List
    │   ├── new/page.tsx            # Create
    │   └── [id]/page.tsx           # Edit
    ├── bookings/
    │   └── page.tsx                # List + modals
    ├── availability/
    │   └── page.tsx                # Schedules
    └── resources/
        ├── page.tsx                # List
        ├── new/page.tsx            # Create
        └── [id]/page.tsx           # Edit
```

---

## Checklist

- [ ] Add shadcn components
- [ ] Create demo layout (layout.tsx)
- [ ] Create demo sidebar
- [ ] Create demo header
- [ ] Create demo context provider
- [ ] Create event types list page
- [ ] Create event type form component
- [ ] Create event type create page
- [ ] Create event type edit page
- [ ] Create event type detail modal
- [ ] Create bookings list page
- [ ] Create bookings filters
- [ ] Create booking card component
- [ ] Create booking detail modal
- [ ] Create availability/schedule page
- [ ] Create weekly schedule editor
- [ ] Create date override dialog
- [ ] Create resources list page
- [ ] Create resource form component
- [ ] Create dashboard page
