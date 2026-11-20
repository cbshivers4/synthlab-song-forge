import { expect, it, vi } from "vitest";
import { createRecordingFinalizer } from "./recording-finalizer";

it("Stop waits for a pending microphone start and finalizes only once for repeated Stop taps", async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finish = vi.fn(async () => {});
  const stop = createRecordingFinalizer(() => pending, finish);
  const first = stop();
  expect(stop()).toBe(first);
  expect(finish).not.toHaveBeenCalled();
  release?.();
  await first;
  expect(finish).toHaveBeenCalledTimes(1);
});
it("a failed microphone start does not prevent finalizing an instrument take", async () => {
  const finish = vi.fn(async () => {});
  await createRecordingFinalizer(() => Promise.reject(new Error("denied")), finish)();
  expect(finish).toHaveBeenCalledTimes(1);
});
