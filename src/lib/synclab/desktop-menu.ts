/**
 * Bridge between the native application menu (desktop shell) and the studio.
 *
 * The Electron main process sends a command string; this hook runs the matching
 * studio action. In a browser tab window.synclab is absent and the hook does
 * nothing, so the same code runs in both runtimes.
 */
import { useEffect, useRef } from "react";

export type MenuHandlers = Record<string, () => void>;

export function useDesktopMenu(handlers: MenuHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const api = typeof window !== "undefined" ? window.synclab : undefined;
    if (!api?.onMenu) return;
    return api.onMenu((command) => {
      ref.current[command]?.();
    });
  }, []);
}
