# ConvexBooking

An open-source, real-time booking system built as a [Convex component](https://docs.convex.dev/components). Handle room bookings, equipment reservations, or appointment scheduling with real-time availability and conflict prevention.

> **Early Stage Project** - This is a learning-in-public project. No npm package yet — fork the repo and customize. Issues and PRs welcome!

## Features

- **Real-time Presence** - Slot locking prevents double bookings. Other users see reserved slots instantly.
- **Multi-Duration Support** - Flexible booking lengths (30min, 1h, 2h, 5h) with intelligent conflict detection.
- **O(1) Availability Queries** - Scales to millions of bookings using discrete time buckets.
- **ACID Transactions** - Race-condition free bookings with Convex's transactional guarantees.
- **Multi-Resource Booking** - Book rooms, equipment, or people. Resources can be bundled or standalone.
- **Flexible Schedules** - Define availability windows, date overrides, and buffer times.

## Quick Start

### 1. Fork/Clone the Repository

```bash
git clone https://github.com/yourname/convex-booking my-booking-app
cd my-booking-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Convex

```bash
npx convex dev
```

This will prompt you to create a Convex project and generate your `.env.local`.

### 4. Start the Dev Server

In a new terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
├── app/
│   ├── docs/           # Documentation site
│   ├── admin/          # Admin dashboard
│   └── book/           # Public booking pages
├── components/
│   ├── booker/         # Main booking flow component
│   ├── booking-calendar/  # Calendar and time slots
│   └── ui/             # shadcn/ui components
├── convex/             # Convex backend
│   └── booking.ts      # Booking API exports
└── packages/
    └── convex-booking/ # The booking component
```

## Usage

### Basic Booker Component

```tsx
import { Booker } from "@/components/booker/booker";

export default function BookingPage() {
  return (
    <Booker
      eventTypeId="studio-session"
      resourceId="studio-a"
      title="Book a Session"
      description="Select a time that works for you"
    />
  );
}
```

### API Setup

```typescript
// convex/booking.ts
import { components } from "./_generated/api";
import { makeBookingAPI } from "convex-booking";

export const {
  getMonthAvailability,
  getDaySlots,
  createBooking,
  cancelBooking,
  // ... more exports
} = makeBookingAPI(components.booking);
```

## Documentation

Visit `/docs` in your running app or check the `app/docs/` folder for:

- [Introduction](/docs) - Overview and current state
- [Quick Start](/docs/getting-started) - Setup instructions
- [Core Concepts](/docs/concepts) - Architecture and data model
- [Components](/docs/components) - Booker, Calendar, Admin UI
- [API Reference](/docs/api) - Queries, mutations, hooks
- [Guides](/docs/guides) - Common patterns and recipes

## Architecture

ConvexBooking uses a **discrete time bucket** pattern for O(1) availability queries:

- Each day divided into 96 slots (15-minute intervals)
- Availability stored as bitmap per resource per day
- Real-time presence via heartbeat system (10-second timeout)
- ACID transactions prevent race conditions

## Customization

Since you're working with the source code (not an npm package), you have full control:

1. **Styles** - Modify components directly or override with Tailwind
2. **Behavior** - Fork components and modify logic
3. **Schema** - Add custom fields to bookings, resources, etc.
4. **Auth** - Integrate with your existing authentication

### Stripping the Docs (Optional)

If you don't need the documentation site:

```bash
rm -rf app/docs components/docs
```

Then:
1. Remove from `package.json`: `@next/mdx`, `rehype-pretty-code`, `shiki`
2. Replace `next.config.mjs` with a simple `export default {}`
3. Remove `--webpack` from dev scripts to use Turbopack again

## Tech Stack

- [Convex](https://convex.dev/) - Backend (database, real-time, serverless functions)
- [Next.js 15](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
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
