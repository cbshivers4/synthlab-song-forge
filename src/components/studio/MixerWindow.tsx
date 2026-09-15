import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into a real floating browser window (popup), so it can be
 * dragged to another monitor. React context survives the portal, so studio
 * state stays live. Calls onClose when the user closes the window.
 */
export function MixerWindow({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const win = window.open("", "synclab-mixer", "width=1320,height=560");
    if (!win) {
      onClose();
      return;
    }
    win.document.title = "SYNCLAB — Mixer";
    // Copy styles so the popup looks identical to the main window.
    document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
      win.document.head.appendChild(node.cloneNode(true));
    });
    win.document.documentElement.className = document.documentElement.className;
    win.document.body.className = "bg-background text-foreground";
    const root = win.document.createElement("div");
    root.style.height = "100vh";
    root.style.overflow = "auto";
    win.document.body.style.margin = "0";
    win.document.body.appendChild(root);
    setContainer(root);

    const poll = window.setInterval(() => {
      if (win.closed) {
        window.clearInterval(poll);
        onClose();
      }
    }, 400);
    return () => {
      window.clearInterval(poll);
      if (!win.closed) win.close();
      setContainer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return container ? createPortal(children, container) : null;
}
