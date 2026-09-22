# Maintaining the demo deployment

The public documentation explains package usage. These notes apply to this
repository's existing Next.js + Convex sandbox deployment.

## Project configuration

- Vercel project: `convexbooking` (use the existing `.vercel/project.json` link).
- Production site: https://convexbooking.dev
- Build command in `vercel.json`: `npx convex deploy --cmd 'npm run build'`.
- Node 24 LTS; install with `npm ci --strict-peer-deps`.
- `CONVEX_DEPLOY_KEY` in Vercel Production selects and authorizes the Convex backend.
  The CLI injects `NEXT_PUBLIC_CONVEX_URL` into the frontend build.

The Convex deployment needs the demo's `AUTH_PRIVATE_KEY` and `AUTH_JWKS` values.
Keep existing keys on an existing deployment; rotating them invalidates sessions.
For a fresh development deployment, the pinned Convex Auth setup CLI configures
them. Authentication setup is separate from installing the booking component.

Optional email configuration belongs on the Convex deployment:
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL` (the public site URL).
Do not copy production credentials into source control or into a preview deployment.

## Release sequence

1. Pass component tests, typecheck, lint and fresh packed-consumer checks.
2. Publish the tested component package, then update this repo's package version
   and lockfile to the registry release.
3. Run lint, `docs:check`, the production build and `docs:links`.
4. Verify the candidate against the development Convex deployment and browser UI.
5. Commit and push. Monitor the linked Vercel build to READY, verify the production
   domain, booking flow, docs navigation and deployment logs.

The Convex CLI runs the frontend build before pushing backend functions. Vercel
then finishes publishing the frontend. These are separate services: a failure
after the backend push does not automatically roll it back. Inspect both outcomes.
Do not redeploy concurrently from the CLI and Git integration.

## Sandbox behavior

`convex/crons.ts` resets and reseeds the shared sandbox each hour. Guest admins
can edit demo data, and token-based booking links may become invalid after a reset.
This behavior is intentional for this website. A production booking service should
remove the reset and enforce real administrator/organization authorization.

## Local environment

`.env.local` selects the development Convex deployment. A stale
`.env.production.local` can make local Next.js builds target production: inspect
its public URL before browser tests, and explicitly choose the intended target.
Secrets stay in ignored environment files or the deployment configuration.
