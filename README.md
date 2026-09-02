# ConvexBooking

An open-source, real-time booking system built as a [Convex component](https://docs.convex.dev/components). Handle room bookings, equipment reservations, or appointment scheduling with real-time availability and conflict prevention.

[![npm version](https://img.shields.io/npm/v/@mrfinch/booking.svg)](https://www.npmjs.com/package/@mrfinch/booking)

**Live demo:** [convexbooking.dev](https://convexbooking.dev) — book anonymously, no sign-up. The admin dashboard opens with one click as a *guest admin* (Convex Auth v2, anonymous provider). It is a shared public sandbox: anyone can edit, and all data resets every hour.

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

Current version: **0.3.0** (see the package [CHANGELOG](https://github.com/Finchmedia/convex-booking/blob/main/booking-component/CHANGELOG.md) — optional `excludeBookingUid` / `resourceTimezone` / `scheduleId` / `availableSlots` on the availability queries, resource `metadata`, a `maintenance` module, strict schedule validation, cross-midnight/DST fixes).

**Peer Dependencies (0.3.0):**
- `convex` ^1.17.0
- `convex-helpers` ^0.1.106
- `react` ^18 || ^19
- React layer only: `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`

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

Full documentation available at [convexbooking.dev/docs](https://convexbooking.dev/docs):

- [Introduction](/docs) - Overview and current state
- [Quick Start](/docs/getting-started) - Setup instructions
- [Core Concepts](/docs/concepts) - Architecture and data model
- [Authentication & guest admin](/docs/authentication) - Public vs. admin function builders, Convex Auth v2
- [Components](/docs/components) - Booker, Calendar, Admin UI
- [API Reference](/docs/api) - Queries, mutations, hooks

## Demo App

This repository contains both the npm package (`booking-component/`) and a demo Next.js app (`convexbooking/`).

The demo app runs on `@mrfinch/booking` 0.3.0 from a vendored tarball (`convexbooking/vendor/mrfinch-booking-0.3.0.tgz`). Booking is anonymous; the admin dashboard is gated by **Convex Auth v2** with its *anonymous* login provider only ("Continue as guest admin" mints a throw-away session — no external auth provider). A cron wipes and reseeds the sandbox every hour and deletes guest users older than an hour.

> **Convex Auth v2 is alpha.** The demo pins `@convex-dev/auth@2.0.0-alpha.1` exactly. Its APIs may still change and it is not recommended for production yet; the auth layer here is deliberately thin (`convex/auth.ts`, `convex/users.ts`, `convex/functions.ts`, the gate in `app/admin/layout.tsx`).

To run the demo:

```bash
git clone https://github.com/Finchmedia/convex-booking
cd convex-booking/convexbooking
npm install
npx convex dev            # In one terminal (creates/links a dev deployment)
npx @convex-dev/auth      # Once: generates AUTH_PRIVATE_KEY / AUTH_JWKS on that deployment
npx convex run seed:resetSandbox   # Seed the demo org, resources, schedule and event types
npm run dev               # In another terminal
```

Open [http://localhost:3000](http://localhost:3000) to see the demo. Confirmation emails are optional (`RESEND_API_KEY`, see `.env.example`).

## Tech Stack

- [Convex](https://convex.dev/) - Backend (database, real-time, serverless functions)
- [Next.js 16](https://nextjs.org/) - React framework (demo app)
- [Convex Auth v2](https://auth-v2.previews.convex.dev/) (alpha) - anonymous guest-admin sessions (demo app)
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
