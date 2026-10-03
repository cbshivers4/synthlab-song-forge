import { useEffect } from "react";
import { useStudio } from "./store";
import { stepsPerBar, songSteps } from "./timebase";

/**
 * Global keyboard shortcuts, like the transport keys in Ableton/Logic/FL.
 * Ignored while typing in a field or while a modifier combo belongs to the
 * browser. Mounted once by the studio screen.
 *
 * Space play/stop · R record · L loop · M mute selected · ⌘/Ctrl+Z undo ·
 * ⇧⌘/Ctrl+Z redo · ⌘/Ctrl+D duplicate track · ←/→ playhead by bar ·
 * ⇧←/⇧→ playhead by step · Home return to zero
 */
export function useStudioShortcuts() {
  const studio = useStudio();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        const sel = studio.selected;
        if (sel) studio.duplicateTrack(sel.id);
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === " ") {
        e.preventDefault();
        studio.togglePlay();
        return;
      }
      if (key === "r") {
        e.preventDefault();
        studio.toggleRecord();
        return;
      }
      if (key === "l") {
        e.preventDefault();
        studio.setTransport({ loop: !studio.transport.loop });
        return;
      }
      if (key === "m") {
        const sel = studio.selected;
        if (sel) studio.updateTrack(sel.id, { muted: !sel.muted });
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        studio.setTransport({ step: 0 });
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const amount = e.shiftKey ? 1 : stepsPerBar();
        const total = songSteps(studio.transport.bars);
        const step = Math.min(total, Math.max(0, studio.transport.step + dir * amount));
        studio.setTransport({ step });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio]);
}
