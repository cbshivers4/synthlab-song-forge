import { useEffect, useRef, useState } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";

/** Spring-loaded pitch bend (±range semitones) and mod wheel; drives the track's real pitch-mod bus. */
export function PitchWheels({ trackId }: { trackId: string }) {
  const [bend, setBend] = useState(0);
  const [mod, setMod] = useState(0);
  const [range, setRange] = useState(2);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  useEffect(() => () => { getEngine().setPitchBend(trackId, 0); }, [trackId]);

  const applyBend = (v: number) => {
    setBend(v);
    getEngine().setPitchBend(trackId, v * rangeRef.current * 100);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface/70 p-2" aria-label="Pitch bend and mod wheel">
      <label className="flex flex-col items-center gap-1">
        <span className="label-xs">PITCH BEND</span>
        <input
          type="range"
          aria-label="Pitch bend"
          min={-1}
          max={1}
          step={0.01}
          value={bend}
          onChange={(e) => applyBend(Number(e.target.value))}
          onPointerUp={() => applyBend(0)}
          onKeyUp={() => applyBend(0)}
          onBlur={() => applyBend(0)}
          className="h-24 w-6 accent-primary [writing-mode:vertical-lr] [direction:rtl]"
        />
        <span className="font-mono text-[10px] text-foreground/70">{(bend * range).toFixed(1)} st</span>
      </label>
      <label className="flex flex-col items-center gap-1">
        <span className="label-xs">MOD</span>
        <input
          type="range"
          aria-label="Mod wheel"
          min={0}
          max={1}
          step={0.01}
          value={mod}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMod(v);
            getEngine().setModWheel(trackId, v);
          }}
          className="h-24 w-6 accent-primary [writing-mode:vertical-lr] [direction:rtl]"
        />
        <span className="font-mono text-[10px] text-foreground/70">{Math.round(mod * 100)}%</span>
      </label>
      <div className="flex flex-col gap-1">
        <span className="label-xs">BEND RANGE</span>
        <div className="flex gap-1">
          {[2, 7, 12].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`rounded-[3px] border px-2 py-1 font-mono text-[10px] ${range === r ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              ±{r}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-muted-foreground">Bend springs back to center when released.</span>
      </div>
    </div>
  );
}
