/** All Stop paths await the same take, including a microphone start still awaiting permission. */
export function createRecordingFinalizer(pendingStart: () => Promise<unknown> | null, finish: () => Promise<void>) {
  let active: Promise<void> | null = null;
  return () => {
    if (active) return active;
    active = (async () => {
      try { await pendingStart(); } catch { /* Failed starts have no input take to finish. */ }
      await finish();
    })().finally(() => { active = null; });
    return active;
  };
}