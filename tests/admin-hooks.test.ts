import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import * as admin from "../convex/admin";
import { fakeCtx, run } from "./convex-fake-ctx";

// Compile time (npx tsc --noEmit): hook management is not client-callable.
const refs = {
  // @ts-expect-error registerHook is internal — guest admins cannot call it
  publicRegister: api.admin.registerHook,
  // @ts-expect-error unregisterHook is internal — guest admins cannot call it
  publicUnregister: api.admin.unregisterHook,
  internalRegister: internal.admin.registerHook,
  internalUnregister: internal.admin.unregisterHook,
  // Control: ordinary admin functions stay on the (guest-admin) client API.
  publicCreateResource: api.admin.createResource,
};

type Flags = { isPublic?: boolean; isInternal?: boolean };

describe("hook registration (H-04)", () => {
  it("registerHook and unregisterHook are internal functions", () => {
    for (const fn of [admin.registerHook, admin.unregisterHook]) {
      expect((fn as Flags).isInternal).toBe(true);
      expect((fn as Flags).isPublic).toBeFalsy();
    }
    expect(getFunctionName(refs.internalRegister)).toBe("admin:registerHook");
    expect(getFunctionName(refs.internalUnregister)).toBe("admin:unregisterHook");
  });

  it("operators can still register hooks through the internal function", async () => {
    const { ctx, calls } = fakeCtx({ "hooks/registerHook": () => "hook-1" });
    const args = { eventType: "booking.created", functionHandle: "function://example" };
    expect(await run(admin.registerHook, ctx, args)).toBe("hook-1");
    expect(calls).toEqual(["hooks/registerHook"]);
  });

  it("control: the rest of the admin surface stays client-callable", () => {
    for (const fn of [admin.createResource, admin.listBookings]) {
      expect((fn as Flags).isPublic).toBe(true);
      expect((fn as Flags).isInternal).toBeFalsy();
    }
    expect(getFunctionName(refs.publicCreateResource)).toBe("admin:createResource");
  });
});
