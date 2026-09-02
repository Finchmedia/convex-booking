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

The demo app runs on `@mrfinch/booking` 0.3.0 from npm. Booking is anonymous; the admin dashboard is gated by **Convex Auth v2** with its *anonymous* login provider only ("Continue as guest admin" mints a throw-away session — no external auth provider). A cron wipes and reseeds the sandbox every hour and deletes guest users older than an hour.

> **Convex Auth v2 is alpha.** The demo pins `@convex-dev/auth@2.0.0-alpha.1` exactly. Its APIs may still change and it is not recommended for production yet; the auth layer here is deliberately thin (`convex/auth.ts`, `convex/users.ts`, `convex/functions.ts`, the gate in `app/admin/layout.tsx`).

To run the demo:

```bash
git clone https://github.com/Finchmedia/convex-booking
cd convex-booking/convexbooking
npm install
npx convex dev            # In one terminal (creates/links a dev deployment)
npx @convex-dev/auth@2.0.0-alpha.1   # Once: generates AUTH_PRIVATE_KEY / AUTH_JWKS on that deployment
npx convex run seed:resetSandbox   # Seed the demo org, resources, schedule and event types
npm run dev               # In another terminal
```

Open [http://localhost:3000](http://localhost:3000) to see the demo. Confirmation emails are optional (`RESEND_API_KEY`, see `.env.example`).

## Deploy

The site is a Next.js app on Vercel plus a Convex **production** deployment. `vercel.json` ties the two together:

```json
{
  "framework": "nextjs",
  "buildCommand": "npx convex deploy --cmd 'npm run build'"
}
```

With `CONVEX_DEPLOY_KEY` set on the Vercel project, that single command pushes the Convex backend (functions, schema, indexes, components, crons) **and then** runs `npm run build` with `NEXT_PUBLIC_CONVEX_URL` injected — the Convex CLI sees `next` in `package.json` and picks that variable name automatically (`--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` makes it explicit). Frontend and backend therefore go live together, or not at all.

> **Plain-build alternative.** To keep Vercel to the frontend only, drop `buildCommand` from `vercel.json` (Vercel falls back to `npm run build`), set `NEXT_PUBLIC_CONVEX_URL` on the Vercel project by hand, and run `npx convex deploy` from a terminal whenever the backend changes. Simpler, but a schema change and the UI that depends on it can go live minutes apart.

### First deploy — manual, from a terminal

The very first deploy cannot come from Vercel. `convex/convex.config.ts` declares the auth signing keys in `defineApp({ env: … })`, so pushing to a deployment that does not have them fails. Provision them first.

**1 — Auth signing keys on the production deployment.**

The Convex Auth v2 setup CLI has no `--prod` flag; it shells out to `npx convex env get/set` against whichever deployment the working directory selects. A shell `CONVEX_DEPLOYMENT` overrides `.env.local`, so aim it at production:

```bash
CONVEX_DEPLOYMENT=prod:<your-prod-deployment-name> npx @convex-dev/auth@2.0.0-alpha.1
```

It generates an RS256 key pair and sets `AUTH_PRIVATE_KEY` + `AUTH_JWKS` on that deployment. `convex/auth.config.ts`, `convex/convex.config.ts` and `convex/auth.ts` already exist, so it leaves them untouched and only prints what they should contain. `--force` rotates existing keys (and invalidates every live guest session).

If you would rather not hand the deployment choice to that CLI, generate the pair yourself. The auth component reads the variable as `atob(AUTH_PRIVATE_KEY)` and imports the result as a PKCS8 RS256 PEM:

```bash
node --input-type=module -e '
import { webcrypto as c } from "node:crypto";
import { writeFileSync } from "node:fs";
const { publicKey, privateKey } = await c.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]);
const b64 = Buffer.from(await c.subtle.exportKey("pkcs8", privateKey)).toString("base64");
const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const { kty, n, e } = await c.subtle.exportKey("jwk", publicKey);
writeFileSync("AUTH_PRIVATE_KEY.txt", Buffer.from(pem).toString("base64"));
writeFileSync("AUTH_JWKS.json", JSON.stringify({ keys: [{ kty, n, e, kid: c.randomUUID(), alg: "RS256", use: "sig" }] }));
'
npx convex env set --prod AUTH_PRIVATE_KEY --from-file AUTH_PRIVATE_KEY.txt
npx convex env set --prod AUTH_JWKS --from-file AUTH_JWKS.json
rm AUTH_PRIVATE_KEY.txt AUTH_JWKS.json
```

`CONVEX_SITE_URL` — the JWT issuer in `convex/auth.config.ts` and the base of the JWKS URL — is a Convex built-in, present on every deployment. There is no `SITE_URL`-style variable to set.

**2 — Push the backend.**

```bash
npx convex deploy          # add --dry-run first to preview the change set
```

Confirm the prompt before accepting it. Coming from the WorkOS-era deployment it should report the `workOSAuthKit` component being **removed**, the `auth` and `authAnonymous` components added, the app `users` table plus its index added, and the hourly `reset sandbox` cron registered.

**3 — Seed the sandbox.**

```bash
npx convex run seed:resetSandbox --prod
```

`seed:resetSandbox` is an internal action — `npx convex run` may call internal functions. It wipes the booking component's data, reseeds the demo org, resources, schedule and event types, and purges stale guest users. After this the hourly cron keeps doing it.

**4 — Ship the frontend.**

```bash
npx vercel link            # once, to connect the directory to the Vercel project
npx vercel --prod
```

Set `CONVEX_DEPLOY_KEY` on the project **before** this build: without it, `npx convex deploy` inside the build command has no deployment to target and the build fails.

Subsequent deploys are just `git push` — Vercel runs the build command, which pushes Convex and builds Next together.

### Environment variables

**Vercel project** (dashboard, or `npx vercel env add`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | **yes** | Production deploy key from the Convex dashboard (*Settings → Deploy keys → Generate production deploy key*). Authorises the push in `buildCommand` and tells the CLI which deployment to target. |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL of the site. Nothing in the Next.js code reads it today; set it on the **Convex** deployment for the email links. Harmless to mirror here. |

Do not set `NEXT_PUBLIC_CONVEX_URL` on Vercel while `buildCommand` uses `convex deploy --cmd` — the deploy injects the right value for the deployment it just pushed to.

**Convex production deployment** (`npx convex env set --prod NAME value`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_PRIVATE_KEY` | **yes** | Base64 of the PKCS8 RS256 private key PEM. Signs the guest-admin JWTs. Declared in `defineApp({ env })`, so the push fails without it. |
| `AUTH_JWKS` | **yes** | The matching public JWK Set, served at `<site>/auth/.well-known/jwks.json` and validated against `convex/auth.config.ts`. Same story: no push without it. |
| `NEXT_PUBLIC_APP_URL` | no | Base URL used to build the "manage your booking" links in emails. Despite the prefix it is read **server-side inside Convex** (`convex/public.ts`, `convex/admin.ts`). |
| `RESEND_API_KEY` | no | Enables confirmation / cancellation emails. **Leave unset on the public sandbox** — without it no email is ever sent. |
| `RESEND_FROM_EMAIL` | no | Sender address; only meaningful together with `RESEND_API_KEY`. |
| `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | remove | Left over from the WorkOS integration. `npx convex env remove --prod WORKOS_API_KEY` (and so on), and delete them from Vercel and from `.env.local`. |

A local `.env.production.local` that also defines `NEXT_PUBLIC_CONVEX_URL` is a leftover from manual deploys: it makes the Convex CLI warn that it "cannot update automatically" and makes a local `next build` point at production. Delete it.

### Preview deployments

Two workable shapes:

- **Per-branch Convex preview deployments.** Generate a *Preview* deploy key in the Convex dashboard and set it as `CONVEX_DEPLOY_KEY` for Vercel's Preview environment; each branch then gets its own fresh Convex deployment. A fresh deployment starts with no environment variables, so seed the auth keys once as project-level preview defaults (generate a **separate** key pair — never reuse the production one):

  ```bash
  npx convex env default set --type preview AUTH_PRIVATE_KEY --from-file AUTH_PRIVATE_KEY.txt
  npx convex env default set --type preview AUTH_JWKS --from-file AUTH_JWKS.json
  ```

  and have each preview seed itself by extending the build command with `--preview-run seed:resetSandbox` (ignored on production deploys).

- **Plain build against the existing backend.** Leave the Preview environment without a deploy key, point it at a deployment you already have via `NEXT_PUBLIC_CONVEX_URL`, and skip the Convex push. Since `vercel.json` sets one build command for every environment, branch on Vercel's own variable:

  ```json
  "buildCommand": "if [ \"$VERCEL_ENV\" = production ]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi"
  ```

### Convex Auth v2 is alpha

`@convex-dev/auth` is pinned to the exact version `2.0.0-alpha.1` — no caret. The alpha's own docs say not to use it in production yet and that its APIs may change, which is why the auth layer here is deliberately small: `convex/auth.ts`, `convex/users.ts`, the four builders in `convex/functions.ts`, and the gate in `app/admin/layout.tsx`. When v2 reaches stable, bump the pin, re-run the setup CLI against each deployment if the key format changed, and re-check those four files against the migration notes — nothing else in the app touches auth.

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
