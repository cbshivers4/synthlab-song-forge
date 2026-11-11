import type { DrumPad } from "@/lib/synclab/types";

/** Tiny corner marks on a drum step: "f" when the hit has a flam, "×3" when it rolls. */
export function HitMarks({ pad, i }: { pad: DrumPad; i: number }) {
  if (!((pad.steps[i] ?? 0) > 0)) return null;
  const flam = (pad.flam?.[i] ?? 0) > 0;
  const roll = Math.round(pad.retrig?.[i] ?? 1);
  if (!flam && roll <= 1) return null;
  return (
    <span className="drum-hit-marks" aria-hidden>
      {flam && <b>f</b>}
      {roll > 1 && <b>×{roll}</b>}
    </span>
  );
}
