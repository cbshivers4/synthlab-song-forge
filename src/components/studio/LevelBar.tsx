import { levelColor, peakOf, spectrumColor, dbColor, LEVEL_GREEN, LEVEL_ORANGE, LEVEL_RED } from "@/lib/synclab/level-colors";
import { useEffect, useRef } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";
import { clearClip, reportLevel, useClipped } from "@/lib/synclab/clip-monitor";
import { cn } from "@/lib/utils";

function toDb(v: number) {
  return 20 * Math.log10(Math.max(v, 0.00001));
}
function dbToFrac(db: number) {
  return Math.max(0, Math.min(1, (db + 60) / 66));
}

/**
 * Horizontal input/output meter with a clip LED, driven straight from the audio
 * engine analyser via rAF (writes to the DOM, so it never re-renders the track row).
 */
export function LevelBar({
  id,
  className,
  color,
  label,
  source = "output",
}: {
  id: string;
  className?: string;
  color?: string;
  label?: string;
  source?: "output" | "input";
}) {
  const fill = useRef<HTMLDivElement>(null);
  const clipped = useClipped(id);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const loop = () => {
      const engine = getEngine();
      const raw = source === "input" ? engine.inputLevel() : id === "master" ? engine.getLevel() : engine.getTrackLevel(id);
      smooth = raw > smooth ? raw : smooth * 0.86;
      reportLevel(id, raw);
      const node = fill.current;
      if (node) node.style.background = levelColor(smooth);
      if (node) node.style.width = `${dbToFrac(toDb(Math.max(smooth, 0.0005))) * 100}%`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, source]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {label && <span className="label-xs shrink-0">{label}</span>}
      <div className="relative h-2 flex-1 overflow-hidden rounded-[2px] border border-black/60 bg-black/60">
        <div
          ref={fill}
          className="h-full origin-left transition-none"
          style={{
            width: "0%",
            background: LEVEL_GREEN,
          }}
        />

        {/* -6 dB and 0 dB marks so the red zone is readable at a glance */}
        <span className="pointer-events-none absolute inset-y-0 left-[82%] w-px bg-white/25" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-[8%] bg-red-500/15" />
      </div>
      <button
        type="button"
        title={clipped ? "Clipping detected — click to reset" : "No clipping"}
        onClick={(e) => {
          e.stopPropagation();
          clearClip(id);
        }}
        className={cn(
          "shrink-0 rounded-[2px] px-1 font-mono text-[8px] font-bold uppercase leading-[14px] tracking-wider transition-colors",
          clipped ? "animate-pulse bg-red-500 text-black" : "bg-black/40 text-muted-foreground"
        )}
      >
        CLIP
      </button>
    </div>
  );
}
