import { useEffect, useState } from "react";
import { isAppleMobile } from "@/lib/synclab/mic";

/**
 * iPad/iPhone detection for anything rendered on screen.
 *
 * `isAppleMobile()` reads navigator, so calling it during render gives the
 * server one answer (false) and an iPad another (true) — a hydration mismatch.
 * This hook starts false and updates after mount, so the first render always
 * matches the server.
 */
export function useIsAppleMobile() {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    setApple(isAppleMobile());
  }, []);
  return apple;
}
