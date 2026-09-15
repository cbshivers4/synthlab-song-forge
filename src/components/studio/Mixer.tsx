import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import type { BusId, Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";

const BUSES: BusId[] = ["drums", "vocals", "instruments", "synths", "fx", "master"];
const DB_TICKS = [6, 0, -6, -12, -24, -48];

function toDb(v: number) {
  return 20 * Math.log10(Math.max(0.001, v));
}

function dbToFrac(db: number) {
  return Math.min(1, Math.max(0, (db + 48) / 54));
}

/** Segmented LED meter — green body, amber top, red clip. */
function Meter({ level, tall }: { level: number; tall?: boolean }) {
  const segs = 18;
  const lit = Math.round(level * segs);
  return (
    <div className={cn("flex w-1.5 flex-col-reverse gap-px", tall ? "h-44" : "h-36")}>
      {Array.from({ length: segs }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-[1px] transition-colors duration-75",
            i < lit
              ? i >= segs - 2
                ? "bg-red-500"
                : i >= segs - 5
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              : "bg-surface-2"
          )}
        />
      ))}
    </div>
  );
}

function Strip({ t, selected, onSelect }: { t: Track; selected: boolean; onSelect: () => void }) {
  const { updateTrack } = useStudio();
  const level = t.muted ? 0 : t.volume;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1.5 border-r border-border bg-surface px-1.5 py-2 transition-colors",
        selected && "bg-surface-2 shadow-[inset_0_2px_0_0_var(--glow)]"
      )}
    >
      {/* name plate */}
      <div className="flex w-full items-center gap-1">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
        <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-wider text-foreground">
          {t.name}
        </span>
      </div>

      {/* pan */}
      <div className="w-full">
        <Slider
          value={[t.pan]}
          min={-1}
          max={1}
          step={0.01}
          className="h-3"
          onValueChange={([v = 0]) => updateTrack(t.id, { pan: v })}
        />
        <div className="mt-0.5 text-center font-mono text-[8px] text-muted-foreground">
          {t.pan === 0 ? "C" : t.pan < 0 ? `L${Math.round(-t.pan * 100)}` : `R${Math.round(t.pan * 100)}`}
        </div>
      </div>

      {/* fader + scale + meter */}
      <div className="flex items-stretch gap-1">
        <div className="flex h-44 flex-col justify-between py-1">
          {DB_TICKS.map((db) => (
            <div key={db} className="flex items-center gap-0.5">
              <span className="font-mono text-[7px] leading-none text-muted-foreground">
                {db > 0 ? `+${db}` : db}
              </span>
              <span className="h-px w-1 bg-border" />
            </div>
          ))}
        </div>
        <div className="relative">
          <Slider
            orientation="vertical"
            className="h-44 w-5"
            value={[t.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
          />
        </div>
        <Meter level={level} tall />
      </div>

      {/* dB readout */}
      <span className={cn("font-mono text-[9px]", level > 0.98 ? "text-red-400" : "text-muted-foreground")}>
        {toDb(t.volume).toFixed(1)}
      </span>

      {/* M / S */}
      <div className="flex w-full gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateTrack(t.id, { muted: !t.muted });
          }}
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.muted ? "bg-amber-500 text-black" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateTrack(t.id, { solo: !t.solo });
          }}
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.solo ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          S
        </button>
      </div>

      {/* bus routing */}
      <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
        <SelectTrigger
          className="h-5 w-full border-border bg-surface-2 px-1 font-mono text-[8px] uppercase"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUSES.map((b) => (
            <SelectItem key={b} value={b} className="text-xs uppercase">
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MasterStrip() {
  const { tracks } = useStudio();
  const peak = Math.max(...tracks.filter((t) => !t.muted).map((t) => t.volume), 0);
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 bg-surface-2 px-2 py-2 shadow-[inset_2px_0_0_0_var(--grid-line-strong)]">
      <span className="font-display text-[10px] font-bold uppercase tracking-widest text-primary">Master</span>
      <div className="mt-3.5 flex items-stretch gap-1">
        <div className="flex h-44 flex-col justify-between py-1">
          {DB_TICKS.map((db) => (
            <div key={db} className="flex items-center gap-0.5">
              <span className="font-mono text-[7px] leading-none text-muted-foreground">
                {db > 0 ? `+${db}` : db}
              </span>
              <span className="h-px w-1 bg-border" />
            </div>
          ))}
        </div>
        <Meter level={peak} tall />
        <Meter level={peak} tall />
      </div>
      <span className={cn("font-mono text-[9px]", peak > 0.98 ? "text-red-400" : "text-muted-foreground")}>
        {toDb(peak).toFixed(1)} dB
      </span>
      <span className="mt-1 rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
        {dbToFrac(toDb(peak)) > 0.99 ? "CLIP" : "OK"}
      </span>
    </div>
  );
}

export function Mixer() {
  const { tracks, selectedId, select } = useStudio();
  return (
    <div className="flex overflow-x-auto border border-border bg-surface">
      {tracks.map((t) => (
        <Strip key={t.id} t={t} selected={t.id === selectedId} onSelect={() => select(t.id)} />
      ))}
      <MasterStrip />
    </div>
  );
}
