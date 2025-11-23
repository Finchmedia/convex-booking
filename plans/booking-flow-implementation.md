# Cal.com-Style Booking Flow Implementation Plan

## 🎯 Overview

Implement a multi-step booking flow that transitions smoothly from calendar selection → booking form → success confirmation, all within the same container (Cal.com approach).

**Current State:** Calendar shows alert() on slot selection
**Target State:** Calendar → Form → Success with full booking data persistence

---

## 🏗️ Architecture Decisions

### State Management: Simple useState Pattern
Use React's built-in state at `app/page.tsx` level:
- `bookingStep`: "event-meta" | "booking-form" | "success"
- `selectedSlot`: string | null (ISO timestamp)
- `bookingData`: BookingFormData | null

**Rationale:** Keep it simple for MVP, can refactor to Zustand later if needed.

### Layout Strategy: Adaptive 3-Panel → 2-Panel
- **event-meta step**: EventMetaPanel | Calendar | TimeSlots (existing)
- **booking-form step**: EventMetaPanel (summary) | BookingForm (main)
- **success step**: Full-width confirmation

### Backend-First Approach
Build database schema + mutations BEFORE frontend components to ensure type safety.

---

## 📦 Phase 1: Type Definitions (CRITICAL - Files Already Importing!)

### 1.1 Create `/types/booking.ts`
**Why First:** Multiple files already import from this non-existent file!

```typescript
// Core booking step states
export type BookingStep = "event-meta" | "booking-form" | "success";

// Slot interface (currently imported but doesn't exist)
export interface CalcomSlot {
  time: string;      // ISO timestamp: "2024-11-21T14:00:00.000Z"
  attendees?: number; // For future multi-attendee support
}

// Form data collected from user
export interface BookingFormData {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

// Complete booking object (matches extended DB schema)
export interface Booking {
  _id: string;
  uid: string;
  resourceId: string;
  eventTypeId: string;
  start: number;
  end: number;
  timezone: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerNotes?: string;
  eventTitle: string;
  eventDescription?: string;
  location: { type: string; value?: string };
  createdAt: number;
  updatedAt: number;
}
```

### 1.2 Create `/lib/booking/validation.ts`
Zod schemas for form validation:

```typescript
import { z } from "zod";

export const bookingFormSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string().optional(),
  notes: z.string()
    .max(500, "Notes must be 500 characters or less")
    .optional(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
```

---

## 🗄️ Phase 2: Database Schema Extension

### 2.1 Update `packages/convex-booking/src/component/schema.ts`

**Current Problem:** Minimal schema only has resourceId, actorId, start, end, status

**Solution:** Extend bookings table with full booking metadata:

```typescript
bookings: defineTable({
  // Core fields (existing)
  resourceId: v.string(),
  actorId: v.string(),
  start: v.number(),
  end: v.number(),
  status: v.string(), // "confirmed" | "cancelled" | "rescheduled"

  // NEW: Unique identifiers
  uid: v.string(), // e.g., "bk_abc123xyz" for booking URLs

  // NEW: Event reference
  eventTypeId: v.string(),
  timezone: v.string(), // Booker's timezone

  // NEW: Booker details
  bookerName: v.string(),
  bookerEmail: v.string(),
  bookerPhone: v.optional(v.string()),
  bookerNotes: v.optional(v.string()),

  // NEW: Event snapshot (historical record)
  eventTitle: v.string(),
  eventDescription: v.optional(v.string()),

  // NEW: Location
  location: v.object({
    type: v.string(), // "address" | "link" | "phone"
    value: v.optional(v.string()),
  }),

  // NEW: Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
  cancelledAt: v.optional(v.number()),

  // NEW: Relationships
  rescheduleUid: v.optional(v.string()), // Link to original if rescheduled
  cancellationReason: v.optional(v.string()),
})
  .index("by_resource", ["resourceId"])
  .index("by_uid", ["uid"]) // NEW: Query bookings by UID
  .index("by_email", ["bookerEmail"]) // NEW: Find user's bookings
```

**Migration:** Convex handles schema changes automatically (no manual migration needed)

---

## 🔧 Phase 3: Backend Mutations

### 3.1 Create Enhanced Booking Mutation

**File:** `packages/convex-booking/src/component/public.ts`

Add new mutation alongside existing `createReservation`:

```typescript
export const createBooking = mutation({
  args: {
    // Event details
    eventTypeId: v.string(),
    resourceId: v.string(),

    // Time selection
    start: v.number(),
    end: v.number(),
    timezone: v.string(),

    // Booker information
    booker: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),

    // Location
    location: v.object({
      type: v.string(),
      value: v.optional(v.string()),
    }),
  },

  handler: async (ctx, args) => {
    // ... handler logic (SAME AS BEFORE) ...
  },
});
```

**CRITICAL UPDATE (Client API Pattern):**

After adding `createBooking` to `public.ts`, you MUST also expose it in `packages/convex-booking/src/client/index.ts` so the main app picks it up automatically.

**File:** `packages/convex-booking/src/client/index.ts`

```typescript
export function makeBookingAPI(component: ComponentApi) {
  return {
    // ... existing queries ...
    
    // NEW: Expose createBooking
    createBooking: mutation({
      args: {
        eventTypeId: v.string(),
        resourceId: v.string(),
        start: v.number(),
        end: v.number(),
        timezone: v.string(),
        booker: v.object({
          name: v.string(),
          email: v.string(),
          phone: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
        location: v.object({
          type: v.string(),
          value: v.optional(v.string()),
        }),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.public.createBooking, args);
      },
    }),
    
    getBooking: query({
       args: { bookingId: v.id("bookings") },
       handler: async (ctx, args) => {
         return await ctx.runQuery(component.public.getBooking, args);
       }
    })
  };
}
```

**Note:** No changes needed in `convex/booking.ts` because it uses `makeBookingAPI`.

---

## 🎨 Phase 4: Component Development

### 4.1 BookingForm Component

**File:** `components/booking-form/booking-form.tsx`

**Purpose:** Collect booker details with validation

**Layout:** Two-column responsive (EventMetaPanel | BookingForm)

```typescript
interface BookingFormProps {
  eventType: EventType;
  selectedSlot: string; // ISO timestamp
  selectedDuration: number;
  timezone: string;
  onSubmit: (data: BookingFormData) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export const BookingForm: React.FC<BookingFormProps> = ({ ... }) => {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });

  return (
    <div className="flex flex-col md:flex-row">
      {/* Left: Event Summary (reuse EventMetaPanel with read-only variant) */}
      <EventMetaPanel
        eventType={eventType}
        selectedDuration={selectedDuration}
        userTimezone={timezone}
        readOnly // NEW: Don't show duration/timezone selectors
      />

      {/* Right: Booking Form */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-neutral-100">
            Enter Details
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            {formatDate(selectedSlot, timezone)} at {formatTime(selectedSlot, "12h", timezone)}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" label="Name" required />
            <FormField name="email" label="Email" type="email" required />
            <FormField name="phone" label="Phone" type="tel" />
            <FormField name="notes" label="Additional Notes" as="textarea" rows={4} />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Confirming..." : "Confirm Booking"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
```

**Styling:** Match calendar theme (dark mode, neutral-800 backgrounds, rounded-md borders)

### 4.2 BookingSuccess Component

**File:** `components/booking-form/booking-success.tsx`

**Purpose:** Show confirmation and booking details

```typescript
interface BookingSuccessProps {
  booking: Booking;
  eventType: EventType;
  onBookAnother: () => void;
}

export const BookingSuccess: React.FC<BookingSuccessProps> = ({
  booking,
  eventType,
  onBookAnother
}) => {
  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Success Icon */}
      <div className="flex justify-center mb-6">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-100 mb-2">
          You're booked!
        </h1>
        <p className="text-neutral-400">
          A confirmation email has been sent to {booking.bookerEmail}
        </p>
      </div>

      {/* Booking Details Card */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-neutral-400 mt-0.5" />
          <div>
            <p className="font-medium text-neutral-100">{eventType.title}</p>
            <p className="text-sm text-neutral-400 mt-1">
              {formatDateTime(booking.start, booking.timezone)}
            </p>
            <p className="text-sm text-neutral-400">
              {formatDuration(booking.end - booking.start)} duration
            </p>
          </div>
        </div>

        {booking.location.value && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-neutral-400 mt-0.5" />
            <p className="text-sm text-neutral-300">{booking.location.value}</p>
          </div>
        )}

        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-neutral-400 mt-0.5" />
          <p className="text-sm text-neutral-300">{booking.bookerName}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBookAnother}>
          Book Another
        </Button>
        {/* Future: Add to Calendar, Reschedule, Cancel buttons */}
      </div>
    </div>
  );
};
```

### 4.3 EventMetaPanel Enhancement

**File:** `components/booking-calendar/event-meta-panel.tsx`

**Change:** Add `readOnly` prop to hide duration/timezone selectors on form step:

```typescript
interface EventMetaPanelProps {
  // ... existing props
  readOnly?: boolean; // NEW: Hide interactive controls
}

// In render: conditionally show duration options and timezone
{!readOnly && eventType.lengthInMinutesOptions && ( ... )}
{!readOnly && userTimezone && ( ... )}
```

---

## 🔗 Phase 5: State Integration

### 5.1 Update `app/page.tsx`

**Transform from simple alert to full booking flow:**

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar } from "@/components/booking-calendar/calendar";
import { BookingForm } from "@/components/booking-form/booking-form";
import { BookingSuccess } from "@/components/booking-form/booking-success";
import type { BookingStep, BookingFormData, Booking } from "@/types/booking";

export default function Home() {
  // Step state
  const [bookingStep, setBookingStep] = useState<BookingStep>("event-meta");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>("");
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Mutation
  const createBooking = useMutation(api.booking.createBooking);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Calendar slot selection
  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setBookingStep("booking-form");
  };

  // Step 2: Form submission
  const handleFormSubmit = async (formData: BookingFormData) => {
    if (!selectedSlot) return;

    setIsSubmitting(true);

    try {
      const start = new Date(selectedSlot).getTime();
      const end = start + selectedDuration * 60 * 1000;

      const booking = await createBooking({
        eventTypeId: "studio-30min",
        resourceId: "studio-a",
        start,
        end,
        timezone,
        booker: formData,
        location: { type: "address", value: "123 Studio St" }, // From event type
      });

      setCompletedBooking(booking);
      setBookingStep("success");
    } catch (error) {
      console.error("Booking failed:", error);
      alert("Booking failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Back to calendar
  const handleBack = () => {
    setBookingStep("event-meta");
  };

  // Reset flow
  const handleBookAnother = () => {
    setBookingStep("event-meta");
    setSelectedSlot(null);
    setCompletedBooking(null);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl -mt-[200px]">
      {bookingStep === "event-meta" && (
        <Calendar
          resourceId="studio-a"
          eventTypeId="studio-30min"
          onSlotSelect={handleSlotSelect}
          title="Book a Studio Session"
          organizerName="Daniel Finke"
        />
      )}

      {bookingStep === "booking-form" && selectedSlot && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800">
          <BookingForm
            eventType={eventType} // Need to fetch
            selectedSlot={selectedSlot}
            selectedDuration={selectedDuration}
            timezone={timezone}
            onSubmit={handleFormSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {bookingStep === "success" && completedBooking && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800">
          <BookingSuccess
            booking={completedBooking}
            eventType={eventType} // Need to fetch
            onBookAnother={handleBookAnother}
          />
        </div>
      )}
    </div>
  );
}
```

**Note:** Need to fetch `eventType` at page level to pass to BookingForm/BookingSuccess

---

## 📋 Implementation Checklist (File-by-File)

### Day 1: Foundation + Backend (2-3 hours)
- [ ] **Create** `/types/booking.ts` (BookingStep, CalcomSlot, BookingFormData, Booking)
- [ ] **Create** `/lib/booking/validation.ts` (Zod schemas)
- [ ] **Update** `packages/convex-booking/src/component/schema.ts` (extend bookings table)
- [ ] **Update** `packages/convex-booking/src/component/public.ts` (createBooking mutation)
- [ ] **Update** `packages/convex-booking/src/client/index.ts` (expose createBooking + getBooking)
- [ ] **Test** mutation in Convex dashboard with full data

### Day 2: Form Component (2-3 hours)
- [ ] **Create** `components/booking-form/booking-form.tsx`
- [ ] **Update** `components/booking-calendar/event-meta-panel.tsx` (add readOnly prop)
- [ ] **Create** utility functions for date/time formatting in form context
- [ ] **Test** form validation and styling in isolation

### Day 3: Success + Integration (2-3 hours)
- [ ] **Create** `components/booking-form/booking-success.tsx`
- [ ] **Update** `app/page.tsx` (add step state management)
- [ ] **Wire** Calendar → Form → Success transitions
- [ ] **Test** complete end-to-end flow
- [ ] **Add** error handling and loading states

### Day 4: Polish (1-2 hours)
- [ ] **Add** loading spinners during mutation
- [ ] **Add** error boundary for booking failures
- [ ] **Add** smooth transitions between steps (optional: framer-motion)
- [ ] **Test** responsive layout on mobile/tablet/desktop
- [ ] **Final** end-to-end testing

---

## 🧪 Testing Strategy

1. **Unit Tests** (optional for MVP):
   - Validation schemas with invalid data
   - Date/time formatting utilities

2. **Integration Tests**:
   - createBooking mutation with various inputs
   - Conflict detection (double-booking)
   - Schema validation

3. **Manual E2E Testing**:
   - ✅ Select date → select time → fills form → confirms booking
   - ✅ Back button returns to calendar without losing state
   - ✅ Form validation shows errors for invalid email
   - ✅ Success screen shows correct booking details
   - ✅ "Book Another" resets flow properly
   - ✅ Responsive layout works on mobile/tablet/desktop

---

## 🚀 Future Enhancements (Post-MVP)

### Phase 7: Calendar Downloads
- Generate .ics files for Google/Apple/Outlook calendars
- Add "Add to Calendar" buttons on success screen

### Phase 8: Email Notifications
- Convex Actions + Resend/SendGrid integration
- Send confirmation emails to booker
- Send notification emails to organizer

### Phase 9: Reschedule/Cancel
- Add reschedule UI (select new time → update booking)
- Add cancel UI (cancellation reason → mark as cancelled)
- Free up time slots on cancellation

### Phase 10: Custom Questions
- Extend event type schema with customQuestions array
- Render dynamic form fields based on question type
- Store responses in customResponses field

### Phase 11: Multi-Location Support
- Let booker select preferred location during booking
- Show location options in form

---

## ⚠️ Critical Dependencies

1. **Fix Type Import First**: Files already importing `/types/booking.ts` which doesn't exist
2. **Schema Before Mutations**: Must update schema before createBooking mutation
3. **Mutations Before Components**: Backend must exist before form can submit
4. **EventType Fetching**: Need to lift eventType query to page.tsx level

---

## 🎯 Success Criteria

- ✅ User can select time slot → see booking form
- ✅ Form validates name (required), email (valid format)
- ✅ Successful submission creates booking in database
- ✅ Success screen shows correct booking details
- ✅ Booking persists in Convex (visible in dashboard)
- ✅ Layout matches Cal.com's clean, professional style
- ✅ Responsive on all screen sizes
- ✅ No console errors or warnings
