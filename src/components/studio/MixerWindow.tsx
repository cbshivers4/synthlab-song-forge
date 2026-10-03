import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Panels that can be popped out into their own window (e.g. a second monitor). */
export type DetachId = "mixer" | "drums" | "keys" | "synth";

let detached: DetachId[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const setDetached = (id: DetachId, on: boolean) => {
  const has = detached.includes(id);
  if (on === has) return;
  detached = on ? [...detached, id] : detached.filter((d) => d !== id);
  emit();
};
const EMPTY: DetachId[] = [];
export function useDetached() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => detached,
    () => EMPTY,
  );
}

const SIZES: Record<DetachId, string> = {
  mixer: "width=1320,height=560,resizable=yes",
  drums: "width=1200,height=720,resizable=yes",
  keys: "width=1200,height=380,resizable=yes",
  synth: "width=1100,height=760,resizable=yes",
};

/** Preset window sizes (percent of the screen) offered in the popup header. */
const PRESETS = [
  { label: "S", w: 0.45, h: 0.45 },
  { label: "M", w: 0.65, h: 0.65 },
  { label: "L", w: 0.85, h: 0.85 },
  { label: "FULL", w: 1, h: 1 },
] as const;

/**
 * Renders children into a real browser/desktop window, so it can be dragged to
 * another monitor. React context survives the portal, so studio state and audio
 * stay live. Typing keys pressed in the popup are forwarded to the studio.
 */
export function DetachedWindow({
  id,
  title,
  onClose,
  children,
}: {
  id: DetachId;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const win = window.open("", `synclab-${id}`, SIZES[id]);
    if (!win) {
      onClose();
      return;
    }
    win.document.title = `SYNCLAB — ${title}`;
    win.document.head.innerHTML = "";
    win.document.body.innerHTML = "";
    document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
      win.document.head.appendChild(node.cloneNode(true));
    });
    win.document.documentElement.className = document.documentElement.className;
    win.document.documentElement.style.cssText = document.documentElement.style.cssText;
    win.document.body.className = "bg-background text-foreground";
    win.document.body.style.margin = "0";
    const root = win.document.createElement("div");
    root.style.height = "100vh";
    root.style.overflow = "auto";
    win.document.body.appendChild(root);
    setContainer(root);

    // Forward typing keys so the computer keyboard still plays notes while the popup is focused.
    const forward = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      window.dispatchEvent(new KeyboardEvent(e.type, e));
    };
    win.addEventListener("keydown", forward);
    win.addEventListener("keyup", forward);

    const poll = window.setInterval(() => {
      if (win.closed) {
        window.clearInterval(poll);
        onClose();
      }
    }, 400);
    const closeChild = () => win.close();
    window.addEventListener("beforeunload", closeChild);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("beforeunload", closeChild);
      if (!win.closed) win.close();
      setContainer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return container ? createPortal(children, container) : null;
}
