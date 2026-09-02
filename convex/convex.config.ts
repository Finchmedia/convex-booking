import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/core/convex.config.js";
import anonymous from "@convex-dev/auth/providers/anonymous/convex.config.js";
import booking from "@mrfinch/booking/convex.config";

/**
 * Component tree of the public sandbox:
 *
 *   app
 *   ├─ auth           Convex Auth v2 core (sessions, JWKS served at /auth/.well-known/jwks.json)
 *   ├─ authAnonymous  "Continue as guest admin" login provider
 *   └─ booking        @mrfinch/booking (nested: resend)
 *
 * AUTH_PRIVATE_KEY / AUTH_JWKS are generated once per deployment by
 * `npx @convex-dev/auth` (see .env.example).
 */
const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
  },
});

app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(anonymous);
app.use(booking);

export default app;
