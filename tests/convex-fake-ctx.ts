/**
 * Minimal harness for calling this app's Convex wrappers without a backend.
 *
 * convex-test is not a dependency of this website, so these tests invoke a
 * registered function's handler with a fake ctx whose runQuery/runMutation
 * dispatch component calls to stubs keyed by path ("public/getBookingByUid").
 * Every component call is recorded, so a test can assert a guard stopped the
 * request before it reached the component.
 */
import { getFunctionAddress } from "convex/server";
import { ConvexError } from "convex/values";

type ComponentStub = (args: Record<string, unknown>) => unknown;
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;

const COMPONENT_PREFIX = "_reference/childComponent/booking/";

export function fakeCtx(stubs: Record<string, ComponentStub>) {
  const calls: string[] = [];
  const call = async (ref: unknown, args: Record<string, unknown>) => {
    const { reference } = getFunctionAddress(ref);
    const path = reference?.startsWith(COMPONENT_PREFIX)
      ? reference.slice(COMPONENT_PREFIX.length)
      : String(reference);
    calls.push(path);
    const stub = stubs[path];
    if (!stub) throw new Error(`Unexpected component call: ${path}`);
    return stub(args);
  };
  const ctx = {
    runQuery: call,
    runMutation: call,
    auth: { getUserIdentity: async () => null },
  };
  return { ctx, calls };
}

/** Run a registered query/mutation's handler (args validation is not applied). */
export function run(fn: unknown, ctx: unknown, args: Record<string, unknown>) {
  return (fn as { _handler: Handler })._handler(ctx, args);
}

/** The `code` of the ConvexError a call rejects with (fails on anything else). */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to throw a ConvexError");
}
