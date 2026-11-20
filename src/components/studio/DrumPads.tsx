import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { markLiveHit, neighbourLiveHits } from "@/lib/synclab/live-take";
import type { DrumPad, Track } from "@/lib/synclab/types";

/**
 * Tap pads for a drum track. Tap to hear the sound; with TAP REC on and the beat
 * running, each tap is written onto the step that is currently playing.
 */
export function DrumPads({ track, compact }: { track: Track; compact?: boolean }) {
  const { updatePad, transport } = useStudio();
  const [tapRec, setTapRec] = useState(false);
  const [hitPad, setHitPad] = useState<string | null>(null);
  const pads = track.pads ?? [];

  const tap = useCallback(
    (pad: DrumPad, velocity: number) => {
      getEngine().playDrum(track.id, pad, velocity);
      setHitPad(pad.id);
      window.setTimeout(() => setHitPad((cur) => (cur === pad.id ? null : cur)), 120);
      if (navigator.vibrate) navigator.vibrate(8);
      if ((!tapRec && !transport.recording) || !transport.playing) return;
      const total = pad.steps.length || track.steps || 16;
      const at = getPlayStep() % total;
      const stale = transport.recording ? neighbourLiveHits(track.id, pad.id, at, total) : [];
      if (transport.recording) markLiveHit(track.id, pad.id, at);
      updatePad(track.id, pad.id, {
        steps: pad.steps.map((v, i) => (i === at ? velocity : stale.includes(i) ? 0 : v)),
      });
    },
    [tapRec, transport.playing, transport.recording, track.id, track.steps, updatePad],
  );

  // Number keys 1-8 hit the first eight pads.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const idx = "12345678".indexOf(e.key);
      const pad = idx >= 0 ? pads[idx] : undefined;
      if (!pad) return;
      e.preventDefault();
      tap(pad, e.shiftKey ? 0.4 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pads, tap]);

  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="label-xs">Drum pads · {track.name}</span>
        <Button
          size="sm"
          variant={tapRec ? "default" : "secondary"}
          className={tapRec ? "glow" : ""}
          onClick={() => setTapRec(!tapRec)}
        >
          {tapRec ? "TAP REC ON" : "TAP REC OFF"}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {tapRec
            ? transport.playing
              ? "Taps land on the step that is playing"
              : "Press play — taps are only recorded while the beat runs"
            : "Tap to play the sound. Keys 1-8 work too."}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {pads.map((pad, idx) => (
          <button
            key={pad.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              tap(pad, e.shiftKey ? 0.4 : 1);
            }}
            className={`relative ${compact ? "min-h-14" : "min-h-16"} aspect-square rounded-lg border-2 font-mono text-[10px] uppercase tracking-wider transition-transform active:scale-95 ${
              hitPad === pad.id ? "scale-95 border-primary" : "border-border"
            }`}
            style={{
              background: `linear-gradient(160deg, hsl(${(idx * 41) % 360} 70% 22%), hsl(${(idx * 41) % 360} 60% 12%))`,
              boxShadow:
                hitPad === pad.id ? "0 0 18px hsl(var(--neon-hsl, 187 100% 50%) / 0.5)" : undefined,
            }}
          >
            <span className="absolute left-1 top-1 text-[9px] text-muted-foreground">
              {idx + 1}
            </span>
            <span className="text-foreground">{pad.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
