/**
 * Remembers that a take failed to land while a recording was being finalized, so a save that
 * stopped the recording can refuse to report success without it (the take's error toast has
 * already explained what went wrong).
 */
let failed = false;
export function markTakeFailed() {
  failed = true;
}
/** Clears the flag and reports whether a take failed since the last call. */
export function consumeTakeFailure(): boolean {
  const was = failed;
  failed = false;
  return was;
}
export class TakeNotKeptError extends Error {
  constructor() {
    super(
      "A recording couldn't be kept, so nothing was saved. Your project is still open — record again, or close without saving.",
    );
  }
}
