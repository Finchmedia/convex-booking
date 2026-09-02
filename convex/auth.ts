/**
 * Convex Auth v2 — anonymous ("guest admin") provider only.
 *
 * The sandbox has no accounts: "Continue as guest admin" mints a throw-away
 * anonymous session whose user id becomes `ctx.auth.getUserIdentity().subject`
 * in adminQuery/adminMutation (see functions.ts). Guest users are deleted by
 * the hourly sandbox reset (seed.ts).
 */
import { components, internal } from "./_generated/api";
import { setupCore } from "@convex-dev/auth/core/setup";
import { setupAnonymous } from "@convex-dev/auth/providers/anonymous/setup";

const core = setupCore({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = core;

export const { signInAnonymous } = setupAnonymous(core, {
  component: components.authAnonymous,
}).attachUserCallbacks({ createUser: internal.users.createUser });
