# Convex directory submission

Submit manually after npm 0.4.0 and the matching documentation deployment are live.

- Name: Booking
- Package: `@mrfinch/booking`
- Version: `0.4.0`
- npm: https://www.npmjs.com/package/@mrfinch/booking
- Source: https://github.com/Finchmedia/booking-component
- Documentation: https://convexbooking.dev/docs
- Quickstart: https://convexbooking.dev/docs/getting-started
- Demo: https://convexbooking.dev/book
- License: Apache-2.0
- Suggested category: Backend

## Short description

Booking and availability for Convex apps. Reserve rooms, people and equipment
pools, manage cancellations and rescheduling, and build with an optional React
booking UI.

## Longer description

The component stores schedules and booking inventory inside a Convex component.
It supports timezone-aware availability, bookings across multiple resources,
quantity-based equipment pools, atomic rescheduling, management tokens and
lifecycle hooks. An optional React Booker provides the single-resource booking
flow, with live selection presence and optional Resend notifications.

Hosts control authorization and booking policies. The quickstart includes a
reference gateway and a complete setup seed. Requires Convex 1.46 or newer;
the React UI supports React 18 and 19.

## Verification notes

Version 0.4.0 has 439 passing package tests, clean typecheck/lint, fresh backend-only
and React 18/19 consumer checks, and live development concurrency/inventory tests.
The documentation has 16 compiled examples and 223 checked internal links.
The public demo is a shared sandbox that resets hourly and sends no email.
Do not submit a claim of verified outbound email delivery or live WorkOS integration.
