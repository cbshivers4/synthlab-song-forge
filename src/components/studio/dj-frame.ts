import { useEffect, useRef } from "react";

/** 30 fps while anything plays; the moving waveforms, clocks and records read the decks directly. */
export function useFrame(active: boolean, draw: () => void) {
  const ref = useRef(draw);
  ref.current = draw;
  // also redraw after every change (a track loaded, a cue set) while stopped
  useEffect(() => { ref.current(); });
  useEffect(() => {
    ref.current();
    if (!active) return;
    let raf = 0, last = 0;
    const loop = (t: number) => { if (t - last > 32) { last = t; ref.current(); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
