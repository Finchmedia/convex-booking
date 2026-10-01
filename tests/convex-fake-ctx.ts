/**
 * Minimal harness for calling this app's Convex wrappers without a backend.
 *
 * convex-test is not a dependency of this website, so these tests invoke a
 * registered function's handler with a fake ctx whose runQuery/runMutation
 * dispatch component calls to stubs keyed by path ("public/getBookingByUid").
 * Every component call is recorded with its arguments, so a test can assert a
 * guard stopped the request before it reached the component, or what reached
 * it.
 */
import { getFunctionAddress } from "convex/server";
import { ConvexError } from "convex/values";
import type { BookingErrorCode, BookingErrorData } from "@mrfinch/booking";

type ComponentStub = (args: Record<string, unknown>) => unknown;
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;

const COMPONENT_PREFIX = "_reference/childComponent/booking/";

export function fakeCtx(stubs: Record<string, ComponentStub>) {
  const calls: string[] = [];
  const requests: { path: string; args: Record<string, unknown> }[] = [];
  const call = async (ref: unknown, args: Record<string, unknown>) => {
    const { reference } = getFunctionAddress(ref);
    const path = reference?.startsWith(COMPONENT_PREFIX)
      ? reference.slice(COMPONENT_PREFIX.length)
      : String(reference);
    calls.push(path);
    requests.push({ path, args });
    const stub = stubs[path];
    if (!stub) throw new Error(`Unexpected component call: ${path}`);
    return stub(args);
  };
  const ctx = {
    runQuery: call,
    runMutation: call,
    auth: { getUserIdentity: async () => null },
    // Enough of ctx.db for the gateway's bookingRateLimits counter: no row is
    // ever found, so every rate-limit window starts fresh.
    db: {
      query: () => ({ withIndex: () => ({ unique: async () => null }) }),
      insert: async () => null,
      patch: async () => null,
    },
  };
  return { ctx, calls, requests };
}

/** Run a registered query/mutation's handler (args validation is not applied). */
export function run(fn: unknown, ctx: unknown, args: Record<string, unknown>) {
  return (fn as { _handler: Handler })._handler(ctx, args);
}

/**
 * The argument validators a registered function declares, by name, as Convex
 * checks them on every client call (an object validator rejects other keys).
 */
export function declaredArgs(
  fn: unknown
): Record<string, { fieldType: unknown; optional: boolean }> {
  const json = JSON.parse((fn as { exportArgs(): string }).exportArgs());
  return json.value;
}

/** A component rejection as @mrfinch/booking 0.5.0 throws it. */
export function componentError(code: BookingErrorCode, message: string): ConvexError<BookingErrorData> {
  const error = new ConvexError<BookingErrorData>({ code, message });
  error.message = message;
  return error;
}

/** The `data` of the ConvexError a call rejects with (fails on anything else). */
export async function errorData(
  promise: Promise<unknown>
): Promise<{ code: string; message?: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return error.data as { code: string; message?: string };
    throw error;
  }
  throw new Error("Expected the call to throw a ConvexError");
}

/** The `code` of the ConvexError a call rejects with (fails on anything else). */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  return (await errorData(promise)).code;
}
