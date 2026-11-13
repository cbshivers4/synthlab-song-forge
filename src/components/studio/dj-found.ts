import { useEffect, type RefObject } from "react";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { canvasRect } from "@/lib/synclab/canvas-point";

/**
 * When a record goes onto a deck (or a replayed set changes records), the list scrolls to that
 * song and lights its row for a moment, like a DJ app finding the track you picked.
 * Rows carry data-track-name / data-track-label; nothing re-renders — it all happens in the DOM.
 */
export function useFoundRow(listRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dj = getDj();
    const last: Record<DeckId, number> = { A: dj.A.shown.loadSeq, B: dj.B.shown.loadSeq };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const find = (name: string) => {
      const list = listRef.current;
      if (!list) return;
      const row = [...list.querySelectorAll<HTMLElement>("[data-track-name]")].find((r) => r.dataset["trackName"] === name || r.dataset["trackLabel"] === name);
      if (!row) return;
      const lr = canvasRect(list), rr = canvasRect(row);
      const delta = rr.top - lr.top - (list.clientHeight - row.offsetHeight) / 2;
      const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      list.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
      row.removeAttribute("data-found");
      void row.offsetWidth; // restart the light if the same row is found again
      row.setAttribute("data-found", "1");
      const t = setTimeout(() => { row.removeAttribute("data-found"); timers.delete(t); }, 1700);
      timers.add(t);
    };
    const off = dj.subscribe(() => {
      for (const id of ["A", "B"] as DeckId[]) {
        const s = dj.deck(id).shown;
        if (s.loadSeq === last[id]) continue;
        last[id] = s.loadSeq;
        if (s.loadSeq && s.name) find(s.name);
      }
    });
    return () => { off(); timers.forEach(clearTimeout); };
  }, [listRef]);
}
