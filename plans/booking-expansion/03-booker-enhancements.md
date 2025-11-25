# Sub-Plan 03: Booker Enhancements

## Overview
Enhance the booker-side experience with multi-resource selection, event type picker, and improved UX.

## Dependencies
- Sub-Plan 01 (Schema & Backend) for multi-resource APIs
- Sub-Plan 02 (Admin UI) for consistent styling

## Parallel Work Possible
- Can start after backend multi-resource is ready
- Some UI work can be done with mock data

---

## Step 1: Public Booking Route

### 1.1 Event Type Slug Route

**File:** `app/demo/booker/[slug]/page.tsx`

```tsx
export default function PublicBookingPage({ params }) {
  const eventType = useQuery(api.booking.getEventTypeBySlug, {
    slug: params.slug,
  })

  if (!eventType) return <NotFound />
  if (!eventType.isActive) return <EventTypeDisabled />

  return (
    <Booker
      eventTypeId={eventType.id}
      resourceId={eventType.resourceIds?.[0]}
      title={eventType.title}
      description={eventType.description}
      // Multi-resource selection if multiple resources
      enableResourceSelection={eventType.resourceIds?.length > 1}
      availableResources={eventType.resourceIds}
    />
  )
}
```

---

## Step 2: Resource Selector Component

### 2.1 Resource Selector

**File:** `components/booker/resource-selector.tsx`

For event types with multiple resources (e.g., Studio A or Studio B):

```
+----------------------------------------------------------+
| Select a Room                                            |
+----------------------------------------------------------+
| +------------------------+  +------------------------+   |
| |  Studio A              |  |  Studio B              |   |
| |  Full recording studio |  |  Smaller podcast room  |   |
| |  [Selected ✓]          |  |  [Select]              |   |
| +------------------------+  +------------------------+   |
+----------------------------------------------------------+
```

**Props:**
- `resources: Resource[]`
- `selectedResourceId: string`
- `onSelect: (resourceId: string) => void`

---

## Step 3: Addon Selector Component

### 3.1 Equipment Addons

**File:** `components/booker/addon-selector.tsx`

For pooled/quantified resources (e.g., microphones):

```
+----------------------------------------------------------+
| Add Equipment (Optional)                                 |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| | Shure SM57                                           | |
| | Dynamic microphone                                   | |
| | Available: 3                                         | |
| | Quantity: [−] 2 [+]                                  | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| | Neumann U87                                          | |
| | Condenser microphone                                 | |
| | Available: 1                                         | |
| | Quantity: [−] 0 [+]                                  | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Props:**
- `availableAddons: Resource[]`
- `selectedAddons: { resourceId: string, quantity: number }[]`
- `onAddonsChange: (addons) => void`
- `selectedSlot: string` (to check availability)

---

## Step 4: Enhanced Booker Component

### 4.1 Updated Booker Flow

**File:** `components/booker/booker.tsx`

New flow:
1. **Step 1: Event Meta** - Calendar + slot selection
   - If multiple resources: Show resource selector first
   - If addons available: Show addon selector after slot
2. **Step 2: Booking Form** - User details
3. **Step 3: Success** - Confirmation

**New Props:**
```typescript
interface BookerProps {
  // Existing
  eventTypeId: string
  resourceId: string
  title?: string
  description?: string

  // New
  enableResourceSelection?: boolean
  availableResources?: string[]
  availableAddons?: string[]
}
```

**New State:**
```typescript
const [selectedResourceId, setSelectedResourceId] = useState<string>()
const [selectedAddons, setSelectedAddons] = useState<AddonSelection[]>([])
```

### 4.2 Multi-Resource Booking Submission

Update booking submission to use `createMultiResourceBooking`:

```typescript
const handleBookingSubmit = async (formData) => {
  const resources = [
    { resourceId: selectedResourceId, quantity: 1 },
    ...selectedAddons.filter(a => a.quantity > 0),
  ]

  await createMultiResourceBooking({
    eventTypeId,
    resources,
    start: selectedSlot,
    end: selectedSlot + duration,
    timezone,
    booker: formData,
  })
}
```

---

## Step 5: Multi-Resource Presence

### 5.1 Enhanced useSlotHold Hook

**File:** `lib/hooks/use-slot-hold.ts`

Update to hold presence for ALL selected resources:

```typescript
export function useSlotHold({
  resourceIds,  // Changed from single resourceId
  slot,
  duration,
  enabled,
}) {
  // Hold presence for primary resource AND all addons
  const allResourceIds = resourceIds.filter(Boolean)

  useEffect(() => {
    if (!enabled || !slot || allResourceIds.length === 0) return

    // Batch heartbeat for all resources
    const slots = calculateAffectedSlots(slot, duration)

    for (const resourceId of allResourceIds) {
      heartbeat({ resourceId, slots, user: sessionId })
    }

    // ... cleanup
  }, [enabled, slot, allResourceIds])
}
```

---

## Step 6: Availability Check for Addons

### 6.1 Real-time Addon Availability

When user selects a slot, check addon availability for that slot:

```typescript
// In addon-selector.tsx
const addonAvailability = useQuery(api.booking.checkMultiResourceAvailability, {
  resources: availableAddons.map(a => ({
    resourceId: a.id,
    quantity: 1
  })),
  start: selectedSlot,
  end: selectedSlot + duration,
})

// Show available quantity for each addon
const getAvailableQuantity = (addonId) => {
  const result = addonAvailability?.find(r => r.resourceId === addonId)
  return result?.availableQuantity ?? 0
}
```

---

## Step 7: Buffer Time Display

### 7.1 Visual Buffer Indicator

**File:** `components/booking-calendar/time-slot-button.tsx`

Show buffer times visually:

```tsx
// If event type has bufferBefore/After
<div className="relative">
  {bufferBefore > 0 && (
    <div className="absolute -top-1 left-0 right-0 h-1 bg-gray-200"
         title={`${bufferBefore}min setup time`} />
  )}
  <TimeSlotButton {...props} />
  {bufferAfter > 0 && (
    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-200"
         title={`${bufferAfter}min teardown time`} />
  )}
</div>
```

---

## Step 8: Event Type Picker (Optional)

### 8.1 Multi-Event Type Page

If an organization has multiple event types, show a picker:

**File:** `app/demo/booker/page.tsx`

```
+----------------------------------------------------------+
| Book a Session                                           |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| |  Studio Session                                      | |
| |  60-300 min - Full recording studio                  | |
| |  [Book Now →]                                        | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| |  Podcast Recording                                   | |
| |  30 min - Podcast room                               | |
| |  [Book Now →]                                        | |
| +------------------------------------------------------+ |
| +------------------------------------------------------+ |
| |  Consultation Call                                   | |
| |  15 min - Free video call                            | |
| |  [Book Now →]                                        | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

---

## Component Updates Summary

### New Components
- `components/booker/resource-selector.tsx`
- `components/booker/addon-selector.tsx`
- `app/demo/booker/[slug]/page.tsx`
- `app/demo/booker/page.tsx` (event type picker)

### Modified Components
- `components/booker/booker.tsx` - Multi-resource state
- `lib/hooks/use-slot-hold.ts` - Multi-resource presence
- `components/booking-calendar/time-slot-button.tsx` - Buffer display

---

## Checklist

- [ ] Create public booking route (slug-based)
- [ ] Create resource selector component
- [ ] Create addon selector component
- [ ] Update Booker for multi-resource state
- [ ] Update useSlotHold for multi-resource presence
- [ ] Integrate addon availability checking
- [ ] Add buffer time visual indicator
- [ ] Create event type picker page
- [ ] Test multi-resource booking flow end-to-end
