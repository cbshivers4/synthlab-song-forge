import { Headphones, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import type { BusId } from "@/lib/synclab/types";

const BUSES: BusId[] = ["drums", "vocals", "instruments", "synths", "fx", "master"];

export function Mixer() {
  const { tracks, updateTrack, select } = useStudio();
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {tracks.map((t) => (
        <div key={t.id} className="panel flex w-32 shrink-0 flex-col items-center gap-2 p-3" onClick={() => select(t.id)}>
          <div className="h-1 w-full rounded-full" style={{ background: t.color }} />
          <span className="truncate font-display text-xs font-semibold">{t.name}</span>
          <div className="flex w-full items-center gap-1">
            <span className="label-xs">PAN</span>
            <Slider
              className="flex-1"
              value={[t.pan]}
              min={-1}
              max={1}
              step={0.01}
              onValueChange={([v = 0]) => updateTrack(t.id, { pan: v })}
            />
          </div>
          <div className="flex h-40 items-end gap-2">
            <Slider
              orientation="vertical"
              className="h-40"
              value={[t.volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
            />
            <div className="h-40 w-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="w-full rounded-full transition-[height]"
                style={{
                  height: `${(t.muted ? 0 : t.volume) * 100}%`,
                  marginTop: `${(1 - (t.muted ? 0 : t.volume)) * 100}%`,
                  background: "var(--gradient-neon)",
                }}
              />
            </div>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {(20 * Math.log10(Math.max(0.001, t.volume))).toFixed(1)} dB
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={t.muted ? "secondary" : "ghost"}
              className="h-6 px-2 text-[10px]"
              onClick={() => updateTrack(t.id, { muted: !t.muted })}
            >
              <VolumeX className="size-3" />
            </Button>
            <Button
              size="sm"
              variant={t.solo ? "default" : "ghost"}
              className="h-6 px-2 text-[10px]"
              onClick={() => updateTrack(t.id, { solo: !t.solo })}
            >
              <Headphones className="size-3" />
            </Button>
          </div>
          <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
            <SelectTrigger className="h-7 w-full text-[10px] uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSES.map((b) => (
                <SelectItem key={b} value={b} className="text-xs uppercase">
                  {b} bus
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
