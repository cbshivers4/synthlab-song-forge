import { useState } from "react";
import { ArrowLeft, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import type { DrumHitField } from "@/lib/synclab/drum-bulk";
import { Knob } from "./Knob";
import { loopRegion } from "@/lib/synclab/recording-region";

export function DrumBulkControls({ track }: { track: Track }) {
  const { editAllDrums, transport } = useStudio();
  const [scope, setScope] = useState<"sounds" | "hits" | null>(null);
  const first = track.pads?.[0];
  const region = transport.loop ? loopRegion(transport) : undefined;
  const firstHit = track.pads?.flatMap((p) =>
    p.steps.flatMap((v, i) => {
      const first = region
        ? i + Math.max(0, Math.ceil((region[0] - i) / Math.max(1, p.steps.length))) * p.steps.length
        : i;
      return v > 0 && (!region || first < region[1]) ? [{ pad: p, i }] : [];
    }),
  )[0];
  const hitValue = (field: DrumHitField, fallback: number) =>
    firstHit?.pad[field]?.[firstHit.i] ?? fallback;
  const sound = (key: "pitch" | "decay" | "tone" | "drive" | "volume", value: number) =>
    editAllDrums(track.id, { scope: "sounds", patch: { [key]: value } });
  const hit = (field: DrumHitField, value: number) =>
    editAllDrums(track.id, { scope: "hits", field, value });
  return (
    <div className="drum-bulk border-y border-border py-2" aria-label="All drum adjustments">
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" />
        <Button
          size="sm"
          variant={scope === "sounds" ? "default" : "secondary"}
          aria-pressed={scope === "sounds"}
          onClick={() => setScope(scope === "sounds" ? null : "sounds")}
        >
          All sounds
        </Button>
        <Button
          size="sm"
          variant={scope === "hits" ? "default" : "secondary"}
          aria-pressed={scope === "hits"}
          onClick={() => setScope(scope === "hits" ? null : "hits")}
        >
          All hits
        </Button>
        {scope === "hits" && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {transport.loop ? "LOOP HITS" : "PATTERN HITS"}
          </span>
        )}
      </div>
      {scope === "sounds" && first && (
        <div className="flex flex-wrap gap-4 pt-3" role="group" aria-label="All drum sounds">
          <Knob
            label="ALL PITCH"
            min={-24}
            max={24}
            step={1}
            value={first.pitch}
            onChange={(v) => sound("pitch", v)}
          />
          <Knob
            label="ALL DECAY"
            min={0.05}
            max={2}
            value={first.decay}
            onChange={(v) => sound("decay", v)}
          />
          <Knob label="ALL TONE" value={first.tone ?? 0.5} onChange={(v) => sound("tone", v)} />
          <Knob label="ALL DRIVE" value={first.drive ?? 0} onChange={(v) => sound("drive", v)} />
          <Knob label="ALL LEVEL" value={first.volume} onChange={(v) => sound("volume", v)} />
        </div>
      )}
      {scope === "hits" && (
        <div
          className="flex flex-wrap items-center gap-4 pt-3"
          role="group"
          aria-label="All drum hits"
        >
          <Knob
            label="ALL VELOCITY"
            min={0.01}
            max={1}
            value={hitValue("steps", 0.7)}
            onChange={(v) => hit("steps", v)}
          />
          <Knob
            label="HIT PITCH"
            min={-12}
            max={12}
            step={1}
            value={hitValue("stepPitch", 0)}
            onChange={(v) => hit("stepPitch", v)}
          />
          <Knob
            label="HIT DECAY"
            min={0.1}
            max={2}
            value={hitValue("stepDecay", 1)}
            onChange={(v) => hit("stepDecay", v)}
          />
          <Knob
            label="ALL CHANCE"
            value={hitValue("probability", 1)}
            onChange={(v) => hit("probability", v)}
          />
          <Knob
            label="ALL RETRIG"
            min={1}
            max={4}
            step={1}
            value={hitValue("retrig", 1)}
            onChange={(v) => hit("retrig", Math.round(v))}
          />
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Move all hits one step earlier"
              title="Move all hits one step earlier"
              onClick={() => editAllDrums(track.id, { scope: "shift", amount: -1 })}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Move all hits one step later"
              title="Move all hits one step later"
              onClick={() => editAllDrums(track.id, { scope: "shift", amount: 1 })}
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
