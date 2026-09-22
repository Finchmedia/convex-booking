# Version 0.4.0 verification — 22 September 2026

The implementation audit is complete. Version 0.4.0 is published on npm under
`latest`; the downloaded registry archive is byte-identical to the tested
candidate. Production deployment is a separate check in the release workflow.

## Package

- Convex 1.46.0; Node 24.21.0; compatible current runtime and UI dependencies.
- Clean strict install, generated component bindings and clean build pass.
- 439 tests in 23 files pass; full typecheck and lint pass with no warnings.
- Fresh backend-only, React 18.3.1 and React 19.3.0 consumers pass strict install,
  TypeScript, import/registration smoke tests and configuration bundling.
- Three simultaneous requests for the full capacity of one pool produce exactly
  one committed booking on the development deployment.
- Live single/multi booking, decline/cancel, token checks, overlapping moves,
  destination-conflict rollback, midnight moves and pool restrictions pass.
- npm advisory checks report zero known vulnerabilities.
- Final tarball SHA-1: `024321d22b6c161d2ebec9300afec1dd1c2e23b8`.
  The archive has 310 files and excludes test suites, credentials and build caches.

Source and tracked build output were pushed to
https://github.com/Finchmedia/booking-component. The implementation's
[GitHub checks](https://github.com/Finchmedia/booking-component/actions/runs/35722598677)
passed.

## Documentation and demo

- 16 complete examples compile against the packaged 0.4.0 component.
- A clean isolated copy, with no deployment state or secrets, passes strict
  installation, lint, production build and 223 documentation links across 11 pages.
- Website Vitest currently has no standalone test files; this is recorded as
  no-tests, not claimed test coverage.
- Browser: public booking, guest sign-in/admin cancellation, token management,
  rescheduling to a replacement UID and cancellation after rescheduling pass.
- Fixed the completion callback to open management instead of logging the booking.
  Fixed the previous-booking pointer being mistaken for a forward reschedule link.
- All live test data used the development backend and isolated test bookings.
  No production reset or outbound email was performed.

## Deliberate limits

Pools use the multi-resource API. The built-in Booker is for exclusive resources.
Buffer fields are stored settings; hosts enforce gaps. Presence is advisory.
Hosts enforce authentication, visibility, scheduling policy and abuse limits.

The shared demo has no Resend key and resets hourly. Actual email delivery and
provider-specific WorkOS integration are not claimed live-tested. Jumper/Schdrom
vendored app adoption and portfolio work are separate tasks.
