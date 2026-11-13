import { useEffect, type RefObject } from "react";
import { getPlayStep, subscribePlayStep } from "@/lib/synclab/playhead";

/**
 * Lights the step cells under the moving playhead without re-rendering the editor.
 * Cells carry data-step-index (their step) and data-step-period (the length their row loops at);
 * the matching ones get data-step-live="true" (styled in styles.css). Re-rendering a whole drum
 * editor every 16th note stalled the page long enough to make playback stumble.
 */
export function useStepLights(root: RefObject<HTMLElement | null>, playing: boolean) {
  useEffect(() => {
    if (!playing) return;
    let lit: HTMLElement[] = [];
    const paint = () => {
      const step = getPlayStep();
      for (const cell of lit) cell.removeAttribute("data-step-live");
      lit = [];
      const el = root.current;
      if (!el) return;
      for (const cell of el.querySelectorAll<HTMLElement>("[data-step-index]")) {
        const period = Math.max(1, Number(cell.dataset["stepPeriod"]) || 1);
        if (step % period === Number(cell.dataset["stepIndex"])) {
          cell.setAttribute("data-step-live", "true");
          lit.push(cell);
        }
      }
    };
    paint();
    const off = subscribePlayStep(paint);
    return () => {
      off();
      for (const cell of lit) cell.removeAttribute("data-step-live");
    };
  }, [root, playing]);
}
