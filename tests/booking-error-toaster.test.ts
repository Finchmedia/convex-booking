import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { withMutationToasts } from "../components/booking-error-toaster";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const rejection = new ConvexError({ code: "SLOT_NOT_AVAILABLE", message: "Slot taken." });

/** A client whose every mutation rejects, as the Booker's calls would. */
const failingClient = () =>
  withMutationToasts({
    mutation: vi.fn(async () => {
      throw rejection;
    }),
  } as unknown as ConvexReactClient);

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
});

describe("BookingErrorToaster", () => {
  it("does not toast failed presence heartbeats or leaves", async () => {
    const client = failingClient();
    const presence = { resourceId: "studio-a", slots: [], user: "session-1" };
    await expect(client.mutation(api.public.heartbeat, presence)).rejects.toBe(rejection);
    await expect(client.mutation(api.public.leave, presence)).rejects.toBe(rejection);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("control: failed booking writes are toasted and still rethrown", async () => {
    const client = failingClient();
    const create = client.mutation(api.public.createBooking, {} as never);
    await expect(create).rejects.toBe(rejection);
    const reschedule = client.mutation(api.public.rescheduleBookingByToken, {} as never);
    await expect(reschedule).rejects.toBe(rejection);
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledWith("Slot taken.", { id: "booking-error" });
  });

  it("control: successful mutations resolve without a toast", async () => {
    const client = withMutationToasts({
      mutation: vi.fn(async () => "ok"),
    } as unknown as ConvexReactClient);
    expect(await client.mutation(api.public.createBooking, {} as never)).toBe("ok");
    expect(toast.error).not.toHaveBeenCalled();
  });
});
