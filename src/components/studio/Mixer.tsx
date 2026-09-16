import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AudioLines, Drum, Guitar, Mic, Mic2, Music2, Piano, Power, Radio, Settings2, Trash2, Waves } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import type { BusId, BusState, PluginInstance, Track, Transport } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";


const BUSES: BusId[] = ["drums", "vocals", "instruments", "synths", "fx", "master"];
const DB_TICKS = [6, 0, -6, -12, -24, -48];
const SEND_KEYS: [keyof NonNullable<Track["sends"]>, string][] = [
  ["reverb", "REV"],
  ["delay", "DLY"],
  ["chorus", "CHO"],
];
const BUS_STRIPS: BusId[] = ["drums", "vocals", "instruments", "synths", "fx"];

function toDb(v: number) {
  return 20 * Math.log10(Math.max(0.001, v));
}

function dbToFrac(db: number) {
  return Math.min(1, Math.max(0, (db + 48) / 54));
}

function sequencedLevel(track: Track, step: number) {
  const s = step % Math.max(1, track.steps);
  if (track.kind === "drum") {
    return Math.max(0, ...(track.pads ?? []).filter((pad) => !pad.muted).map((pad) => pad.steps[s] ?? 0)) * 0.9;
  }
  if (track.kind === "instrument" || track.kind === "midi" || track.kind === "sampler") {
    const active = (track.notes ?? []).filter((note) => {
      const start = note.step % Math.max(1, track.steps);
      return s >= start && s < start + Math.max(1, note.length);
    });
    return Math.max(0, ...active.map((note) => note.velocity)) * 0.72;
  }
  const clip = track.clips?.find((item) => item.id === track.activeClipId) ?? track.clips?.[0];
  if (!clip?.peaks.length) return 0;
  const index = Math.floor((s / Math.max(1, track.steps)) * clip.peaks.length) % clip.peaks.length;
  return (clip.peaks[index] ?? 0) * 0.82;
}

/** Live audio peaks with sequenced clip activity for channels represented by timeline media. */
function useMeters(tracks: Track[], transport: Transport) {
  const [levels, setLevels] = useState<{ tracks: Record<string, number>; master: number }>({
    tracks: {},
    master: 0,
  });
  const smooth = useRef<Record<string, number>>({});
  const idsKey = tracks.map((track) => track.id).join(",");
  const tracksRef = useRef(tracks);
  const transportRef = useRef(transport);
  tracksRef.current = tracks;
  transportRef.current = transport;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const engine = getEngine();
      const tracks: Record<string, number> = {};
      let loudest = 0;
      for (const track of tracksRef.current) {
        const id = track.id;
        const timeline = transportRef.current.playing ? sequencedLevel(track, transportRef.current.step) : 0;
        const raw = Math.max(engine.getTrackLevel(id), timeline * track.volume);
        const prev = smooth.current[id] ?? 0;
        const v = raw > prev ? raw : prev * 0.86;
        smooth.current[id] = v;
        tracks[id] = dbToFrac(toDb(Math.max(v, 0.0005)));
        if (v > loudest) loudest = v;
      }
      const mRaw = Math.max(engine.getLevel(), loudest * 0.95);
      const mPrev = smooth.current["__master"] ?? 0;
      const m = mRaw > mPrev ? mRaw : mPrev * 0.86;
      smooth.current["__master"] = m;
      setLevels({ tracks, master: dbToFrac(toDb(Math.max(m, 0.0005))) });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [idsKey]);
  return levels;
}

/** Segmented LED meter — green body, amber top, red clip. */
function Meter({ level, tall }: { level: number; tall?: boolean }) {
  const segs = 24;
  const lit = Math.round(level * segs);
  return (
    <div className={cn("flex w-3 flex-col-reverse gap-px", tall ? "h-full min-h-40" : "h-44")}>
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

function InsertRack({
  title,
  list,
  onAdd,
  onRemove,
  onBypass,
  onParam,
}: {
  title: string;
  list: PluginInstance[];
  onAdd: (def: import("@/lib/synclab/types").PluginDef) => void;
  onRemove: (id: string) => void;
  onBypass: (id: string) => void;
  onParam: (id: string, paramId: string, value: number) => void;
}) {
  const { installedPlugins } = useStudio();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <div className="label-xs mb-1">{title}</div>
      <div className="space-y-1">
        {list.length === 0 && <div className="font-mono text-[9px] text-muted-foreground">No effects</div>}
        {list.map((p) => (
          <div key={p.id} className="rounded-sm border border-border bg-surface-2/50 px-1.5 py-1">
            <div className="flex items-center gap-1">
              <button onClick={() => onBypass(p.id)} title="Bypass">
                <Power className={cn("size-3", p.bypass ? "text-muted-foreground" : "text-primary")} />
              </button>
              <button className="flex-1 truncate text-left font-mono text-[9px] uppercase" onClick={() => setOpen(open === p.id ? null : p.id)}>
                {p.name}
                <span className="ml-1 text-muted-foreground">{p.format}</span>
              </button>
              <button onClick={() => onRemove(p.id)} title="Remove">
                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
            {open === p.id &&
              p.params.map((x) => (
                <div key={x.id} className="flex items-center gap-1 pt-1">
                  <span className="w-12 shrink-0 font-mono text-[8px] uppercase text-muted-foreground">{x.name}</span>
                  <Slider
                    value={[x.value]}
                    min={x.min}
                    max={x.max}
                    step={(x.max - x.min) / 100}
                    className="h-2 flex-1"
                    onValueChange={([v = 0]) => onParam(p.id, x.id, v)}
                  />
                  <span className="w-8 shrink-0 text-right font-mono text-[8px] text-muted-foreground">
                    {x.value.toFixed(1)}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {installedPlugins.map((d) => (
          <button
            key={d.id}
            onClick={() => onAdd(d)}
            className="truncate rounded-sm border border-border bg-surface px-1 py-1 text-left font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
            title={`${d.vendor} · ${d.format}`}
          >
            + {d.name}
          </button>
        ))}
      </div>
      <p className="mt-1 font-mono text-[8px] leading-tight text-muted-foreground">
        Add 3rd-party plugins in the PLUGINS panel — they appear here.
      </p>
    </div>
  );
}

function KindIcon({ t, className }: { t: Track; className?: string }) {
  const name = `${t.instrument ?? ""} ${t.name}`.toLowerCase();
  const Icon =
    t.kind === "drum"
      ? Drum
      : t.kind === "audio"
        ? Mic
        : t.kind === "ai-vocal"
          ? Mic2
          : t.kind === "sampler"
            ? AudioLines
            : /bass/.test(name)
              ? Guitar
              : /piano|keys|organ/.test(name)
                ? Piano
                : /string|brass|pad/.test(name)
                  ? Radio
                  : /guitar|pluck/.test(name)
                    ? Guitar
                    : Music2;
  return <Icon className={className} />;
}

/** Per-channel send menu: reverb / delay / chorus amounts plus each return's FX chain. */
function SendsMenu({ t }: { t: Track }) {
  const { updateTrack } = useStudio();
  const active = SEND_KEYS.filter(([key]) => (t.sends?.[key] ?? 0) > 0).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-6 w-full items-center justify-center gap-1 rounded-sm font-mono text-[8px] uppercase tracking-wider transition-colors",
            active > 0 ? "bg-amber-500/20 text-amber-400" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <Waves className="size-3" /> Sends{active > 0 ? ` ${active}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Sends — {t.name}</div>
        {SEND_KEYS.map(([key, label]) => {
          const value = t.sends?.[key] ?? 0;
          return (
            <div key={key} className="space-y-1 rounded-sm border border-border bg-surface-2/40 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-[9px] uppercase text-muted-foreground">{label}</span>
                <Slider
                  value={[value]}
                  min={0}
                  max={1}
                  step={0.01}
                  className="h-2 flex-1"
                  onValueChange={([v = 0]) =>
                    updateTrack(t.id, {
                      sends: { reverb: 0, delay: 0, chorus: 0, ...(t.sends ?? {}), [key]: v },
                    })
                  }
                />
                <span className="w-7 shrink-0 text-right font-mono text-[9px] text-muted-foreground">
                  {Math.round(value * 100)}
                </span>
              </div>
              <FxMenu target={`send:${key}`} label={`${key} return FX`} />
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/* ---- Ableton-style section geometry: every column shares these row heights ---- */
const ROW = {
  devices: "h-[86px]",
  sends: "h-7",
  io: "h-[52px]",
  pan: "h-[38px]",
  fader: "h-[260px]",
  readout: "h-5",
  buttons: "h-6",
  name: "h-7",
} as const;

function SectionLabel({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end border-b border-border/60 pr-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Left-hand label rail, mirrors the strip row heights (Ableton's session-mixer rail). */
function LabelRail() {
  return (
    <div className="sticky left-0 z-10 flex w-[74px] shrink-0 flex-col border-r border-border bg-surface-2/80 backdrop-blur">
      <SectionLabel className={ROW.devices}>Devices</SectionLabel>
      <SectionLabel className={ROW.sends}>Sends</SectionLabel>
      <SectionLabel className={ROW.io}>Audio to</SectionLabel>
      <SectionLabel className={ROW.pan}>Pan</SectionLabel>
      <SectionLabel className={cn(ROW.fader, "items-start pt-2")}>Vol</SectionLabel>
      <SectionLabel className={ROW.readout} />
      <SectionLabel className={ROW.buttons}>M / S / Rec</SectionLabel>
      <SectionLabel className={cn(ROW.name, "border-b-0")}>Track</SectionLabel>
    </div>
  );
}

/** Compact device chain shown directly on the strip, like Ableton's device slots. */
function DeviceSlots({ t }: { t: Track }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const list = t.plugins ?? [];
  return (
    <div className={cn(ROW.devices, "w-full space-y-0.5 overflow-hidden border-b border-border/60 px-1 py-1")}>
      {list.slice(0, 3).map((p) => (
        <div key={p.id} className="flex items-center gap-1 rounded-sm bg-surface-2 px-1 py-[3px]">
          <button onClick={(e) => { e.stopPropagation(); togglePluginBypass(t.id, p.id); }} title="Bypass">
            <Power className={cn("size-2.5", p.bypass ? "text-muted-foreground" : "text-primary")} />
          </button>
          <span className="flex-1 truncate font-mono text-[8px] uppercase">{p.name}</span>
        </div>
      ))}
      {list.length > 3 && (
        <div className="px-1 font-mono text-[8px] text-muted-foreground">+{list.length - 3} more</div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex h-5 w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-2.5" /> {list.length ? `Edit ${list.length}` : "Add device"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
          <InsertRack
            title="Inserts"
            list={list}
            onAdd={(def) => addPlugin(t.id, def)}
            onRemove={(id) => removePlugin(t.id, id)}
            onBypass={(id) => togglePluginBypass(t.id, id)}
            onParam={(id, p, v) => setPluginParam(t.id, id, p, v)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Strip({ t, level, selected, onSelect }: { t: Track; level: number; selected: boolean; onSelect: () => void }) {
  const { updateTrack } = useStudio();

  const tint = (pct: number) => `color-mix(in oklab, ${t.color} ${pct}%, transparent)`;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex w-[116px] shrink-0 cursor-pointer flex-col border-r border-border transition-colors",
        selected ? "bg-surface-2" : "bg-surface"
      )}
      style={{
        background: selected
          ? `linear-gradient(${tint(16)}, ${tint(6)}), var(--surface-2, transparent)`
          : `linear-gradient(${tint(10)}, ${tint(3)}), var(--surface, transparent)`,
        boxShadow: `inset 3px 0 0 0 ${t.color}`,
      }}
    >
      {/* devices */}
      <DeviceSlots t={t} />

      {/* sends */}
      <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
        <SendsMenu t={t} />
      </div>

      {/* audio-to routing */}
      <div className={cn(ROW.io, "flex flex-col justify-center gap-0.5 border-b border-border/60 px-1")}>
        <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
          <SelectTrigger
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-full rounded-sm border-border bg-surface-2 px-1 font-mono text-[8px] uppercase"
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
        <div className="truncate text-center font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
          {t.instrument ?? t.kind}
        </div>
      </div>

      {/* pan */}
      <div className={cn(ROW.pan, "flex flex-col justify-center border-b border-border/60 px-1.5")}>
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
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}
        style={{ "--primary": t.color } as CSSProperties}
      >
        <div className="flex flex-col justify-between py-1">
          {DB_TICKS.map((db) => (
            <div key={db} className="flex items-center gap-0.5">
              <span className="font-mono text-[7px] leading-none text-muted-foreground">
                {db > 0 ? `+${db}` : db}
              </span>
              <span className="h-px w-1 bg-border" />
            </div>
          ))}
        </div>
        <Slider
          orientation="vertical"
          className="h-full w-7"
          value={[t.volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
        />
        <Meter level={level} tall />
      </div>

      {/* dB readout */}
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className={cn("font-mono text-[9px]", level > 0.98 ? "text-red-400" : "text-muted-foreground")}>
          {toDb(t.volume).toFixed(1)} dB
        </span>
      </div>

      {/* M / S / arm */}
      <div className={cn(ROW.buttons, "flex items-center gap-1 border-b border-border/60 px-1")}>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { muted: !t.muted }); }}
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.muted ? "bg-amber-500 text-black" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }}
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.solo ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          S
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { armed: !t.armed }); }}
          title="Arm for recording"
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.armed ? "bg-red-500 text-black" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          ●
        </button>
      </div>

      {/* coloured name plate at the bottom, Ableton style */}
      <div
        className={cn(ROW.name, "flex items-center gap-1 px-1.5")}
        style={{
          background: `color-mix(in oklab, ${t.color} 55%, transparent)`,
          boxShadow: `inset 0 2px 0 0 ${t.color}`,
        }}
        title={t.name}
      >
        <KindIcon t={t} className="size-3 shrink-0" />
        <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-wider text-foreground">
          {t.name}
        </span>
      </div>
    </div>
  );
}

function BusStrip({ id, state, level, onChange }: { id: BusId; state: BusState; level: number; onChange: (p: Partial<BusState>) => void }) {
  return (
    <div className="flex w-[100px] shrink-0 flex-col border-r border-border bg-surface-2/40">
      <div className={cn(ROW.devices, "border-b border-border/60 p-1")}>
        <FxMenu target={`bus:${id}`} label="Devices" />
      </div>
      <div className={cn(ROW.sends, "border-b border-border/60")} />
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")}>
        Master
      </div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}>
        <Slider
          orientation="vertical"
          className="h-full w-7"
          value={[state.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onValueChange={([v = 0]) => onChange({ volume: v })}
        />
        <Meter level={level} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(state.volume).toFixed(1)} dB</span>
      </div>
      <div className={cn(ROW.buttons, "flex items-center px-1 border-b border-border/60")}>
        <button
          onClick={() => onChange({ muted: !state.muted })}
          className={cn(
            "h-5 w-full rounded-sm font-mono text-[9px] font-bold transition-colors",
            state.muted ? "bg-amber-500 text-black" : "bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
      </div>
      <div className={cn(ROW.name, "flex items-center justify-center bg-primary/20")}>
        <span className="truncate font-mono text-[9px] font-bold uppercase tracking-wider text-primary">{id}</span>
      </div>
    </div>
  );
}

function FxMenu({ target, label }: { target: string; label: string }) {
  const { fxChains, addFxPlugin, removeFxPlugin, toggleFxBypass, setFxParam } = useStudio();
  const list = fxChains[target] ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-5 w-full items-center justify-center gap-1 rounded-sm font-mono text-[8px] uppercase tracking-wider transition-colors",
            list.length > 0 ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 className="size-2.5" /> {label}
          {list.length > 0 ? ` ${list.length}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <InsertRack
          title={`${target.split(":")[1]?.toUpperCase()} effects`}
          list={list}
          onAdd={(def) => addFxPlugin(target, def)}
          onRemove={(id) => removeFxPlugin(target, id)}
          onBypass={(id) => toggleFxBypass(target, id)}
          onParam={(id, p, v) => setFxParam(target, id, p, v)}
        />
      </PopoverContent>
    </Popover>
  );
}

function MasterStrip({ level: peak }: { level: number }) {
  return (
    <div className="flex w-[132px] shrink-0 flex-col bg-surface-2 shadow-[inset_2px_0_0_0_var(--grid-line-strong)]">
      <div className={cn(ROW.devices, "border-b border-border/60 p-1")}>
        <FxMenu target="bus:master" label="Master FX" />
      </div>
      <div className={cn(ROW.sends, "border-b border-border/60")} />
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")}>
        Main out
      </div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}>
        <div className="flex flex-col justify-between py-1">
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
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className={cn("font-mono text-[9px]", peak > 0.98 ? "text-red-400" : "text-muted-foreground")}>
          {toDb(peak).toFixed(1)} dB
        </span>
      </div>
      <div className={cn(ROW.buttons, "flex items-center justify-center border-b border-border/60")}>
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider",
            dbToFrac(toDb(peak)) > 0.99 ? "bg-red-500 text-black" : "bg-surface text-muted-foreground"
          )}
        >
          {dbToFrac(toDb(peak)) > 0.99 ? "CLIP" : "OK"}
        </span>
      </div>
      <div className={cn(ROW.name, "flex items-center justify-center bg-primary/30")}>
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-primary">Master</span>
      </div>
    </div>
  );
}

export function Mixer() {
  const { tracks, transport, selectedId, select, buses, setBus } = useStudio();
  const levels = useMeters(tracks, transport);
  const busLevel = (id: BusId) => {
    const members = tracks.filter((t) => t.bus === id && !t.muted);
    const peak = Math.max(0, ...members.map((t) => levels.tracks[t.id] ?? 0));
    return buses[id].muted ? 0 : peak * Math.min(1, buses[id].volume);
  };
  return (
    <div className="flex overflow-x-auto border border-border bg-surface">
      <LabelRail />
      {tracks.map((t) => (
        <Strip
          key={t.id}
          t={t}
          level={t.muted ? 0 : (levels.tracks[t.id] ?? 0)}
          selected={t.id === selectedId}
          onSelect={() => select(t.id)}
        />
      ))}
      {BUS_STRIPS.map((id) => (
        <BusStrip key={id} id={id} state={buses[id]} level={busLevel(id)} onChange={(p) => setBus(id, p)} />
      ))}
      <MasterStrip level={levels.master} />
    </div>
  );
}
