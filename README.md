# ConvexBooking

An open-source, real-time booking system built as a [Convex component](https://docs.convex.dev/components). Handle room bookings, equipment reservations, or appointment scheduling with real-time availability and conflict prevention.

[![npm version](https://img.shields.io/npm/v/@mrfinch/booking.svg)](https://www.npmjs.com/package/@mrfinch/booking)

## Features

- **Real-time Presence** - Slot locking prevents double bookings. Other users see reserved slots instantly.
- **Multi-Duration Support** - Flexible booking lengths (30min, 1h, 2h, 5h) with intelligent conflict detection.
- **O(1) Availability Queries** - Scales to millions of bookings using discrete time buckets.
- **ACID Transactions** - Race-condition free bookings with Convex's transactional guarantees.
- **Multi-Resource Booking** - Book rooms, equipment, or people. Resources can be bundled or standalone.
- **Flexible Schedules** - Define availability windows, date overrides, and buffer times.

## Installation

```bash
npm install @mrfinch/booking convex-helpers
```

**Peer Dependencies:**
- `convex` >= 1.21.0
- `convex-helpers` >= 0.1.0
- `react` >= 18.0.0

## Quick Start

### 1. Install the Convex Component

Add to your `convex/convex.config.ts`:

```typescript
import booking from "@mrfinch/booking/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(booking);

export default app;
```

### 2. Set Up the Booking API

Create `convex/booking.ts`:

```typescript
import { components } from "./_generated/api";
import { makeBookingAPI } from "@mrfinch/booking";

export const {
  getMonthAvailability,
  getDaySlots,
  createBooking,
  cancelBooking,
  getDatePresence,
  heartbeat,
  leave,
  // ... more exports
} = makeBookingAPI(components.booking);
```

### 3. Wrap Your App with Providers

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { BookingProvider } from "@mrfinch/booking/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function App({ children }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexQueryCacheProvider>
        <BookingProvider>
          {children}
        </BookingProvider>
      </ConvexQueryCacheProvider>
    </ConvexProvider>
  );
}
```

### 4. Use the Booker Component

```tsx
import { Booker } from "@mrfinch/booking/react";

export default function BookingPage() {
  return (
    <Booker
      eventTypeId={eventTypeId}
      resourceId={resourceId}
      title="Book a Session"
      description="Select a time that works for you"
    />
  );
}
```

## Components

### Booker

The main booking flow component with 3 steps: calendar selection, form input, and confirmation.

```tsx
import { Booker } from "@mrfinch/booking/react";

<Booker
  eventTypeId={eventTypeId}
  resourceId={resourceId}
  title="Studio Session"
  description="Book your recording time"
  onBookingComplete={(booking) => console.log("Booked!", booking)}
/>
```

### Calendar

Use individual calendar components for custom layouts:

```tsx
import {
  Calendar,
  CalendarGrid,
  CalendarNavigation,
  TimeSlotsPanel,
  EventMetaPanel,
} from "@mrfinch/booking/react";
```

### Hooks

```tsx
import {
  useConvexSlots,
  useSlotHold,
  useSlotPresence,
  useBookingValidation,
} from "@mrfinch/booking/react";
```

### Utilities

```tsx
import {
  formatDate,
  formatTime,
  formatDuration,
  getSessionId,
  DAYS,
  MONTHS,
} from "@mrfinch/booking/react";
```

## Architecture

ConvexBooking uses a **discrete time bucket** pattern for O(1) availability queries:

- Each day divided into 96 slots (15-minute intervals)
- Availability stored as bitmap per resource per day
- Real-time presence via heartbeat system (10-second timeout)
- ACID transactions prevent race conditions

## Documentation

Full documentation available at [convexbooking.com/docs](https://convexbooking.com/docs):

- [Introduction](/docs) - Overview and current state
- [Quick Start](/docs/getting-started) - Setup instructions
- [Core Concepts](/docs/concepts) - Architecture and data model
- [Components](/docs/components) - Booker, Calendar, Admin UI
- [API Reference](/docs/api) - Queries, mutations, hooks

## Demo App

This repository contains both the npm package (`booking-component/`) and a demo Next.js app (`convexbooking/`).

To run the demo:

```bash
git clone https://github.com/Finchmedia/convex-booking
cd convex-booking/convexbooking
npm install
npx convex dev  # In one terminal
npm run dev     # In another terminal
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

## Tech Stack

- [Convex](https://convex.dev/) - Backend (database, real-time, serverless functions)
- [Next.js 15](https://nextjs.org/) - React framework (demo app)
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Acknowledgements

- Booker UI originally based on [booking-calendar](https://github.com/vladimir-siedykh/booking-calendar) by [Vladimir Siedykh](https://github.com/vladimir-siedykh)
- Slot generation and scheduling patterns inspired by [Cal.com](https://cal.com)
- Real-time presence system uses [@convex-dev/presence](https://github.com/get-convex/convex-helpers)

## Contributing

Issues and PRs are welcome! This is a solo project with a full-time job, so response times may vary.

## License

MIT
