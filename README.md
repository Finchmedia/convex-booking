# ConvexBooking

A booking component for Convex with a React booking UI. Use it for appointments,
room bookings and resource bundles, including quantity-based equipment pools.

[Documentation](https://convexbooking.dev/docs) · [Live demo](https://convexbooking.dev/book) ·
[npm package](https://www.npmjs.com/package/@mrfinch/booking) ·
[Component source](https://github.com/Finchmedia/booking-component)

This repository contains the **Next.js demo and documentation**. The package is
maintained in [Finchmedia/booking-component](https://github.com/Finchmedia/booking-component).

## Add the component to your app

```bash
npm install @mrfinch/booking convex@^1.46.0
```

Follow the [Quick Start](https://convexbooking.dev/docs/getting-started) for a
complete host gateway, schema, seed and React setup. The component owns booking
inventory; your host functions enforce access and booking policy. The optional
React Booker supports React 18 and 19.

## Run this demo

Use Node 24 LTS:

```bash
npm ci --strict-peer-deps
npx convex dev
```

In another terminal:

```bash
npx @convex-dev/auth@2.0.0-alpha.1
npx convex run seed:resetSandbox
npm run dev
```

The seed resets the selected demo deployment. Open [localhost:3000](http://localhost:3000).
The demo intentionally shares one organization between guest administrators and
resets its data hourly. Remove that reset cron and replace guest access before
using the app for real bookings. The booking component itself does not require
this demo's alpha auth provider.

## Documentation and checks

- [Quick Start](https://convexbooking.dev/docs/getting-started)
- [Concepts](https://convexbooking.dev/docs/concepts)
- [Authorization](https://convexbooking.dev/docs/authentication)
- [API reference](https://convexbooking.dev/docs/api)
- [React components](https://convexbooking.dev/docs/components)

```bash
npm run lint
npm run docs:check
npm run build
npm run docs:links
```

Complete MDX examples marked `check` compile against the installed package.
The link checker uses rendered HTML from the production build.

## Deploy

The linked Vercel project builds with
`npx convex deploy --cmd 'npm run build'`. Its production `CONVEX_DEPLOY_KEY`
selects the backend. A push to the production branch triggers deployment.
Convex deploys before the frontend build, so a frontend failure does not roll back
a successful backend update. Keep changes compatible across that interval.

See [deployment notes](docs/maintainers/deployment.md) for configuration and release checks.
Never run the demo reset against booking data you intend to keep.

## License

The component package uses the [Apache-2.0 license](https://github.com/Finchmedia/booking-component/blob/main/LICENSE).
