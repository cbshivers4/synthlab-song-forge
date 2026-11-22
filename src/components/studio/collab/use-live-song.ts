import { useSyncExternalStore } from "react";
import { liveState } from "@/lib/synclab/collab/live-song";

/** Who's in the open shared song right now (connection state from CollabBridge). */
export function useLiveSong() {
  return useSyncExternalStore(liveState.subscribe, liveState.get, liveState.get);
}
