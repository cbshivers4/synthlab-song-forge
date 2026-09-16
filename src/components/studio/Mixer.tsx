import { useEffect, useRef, useState } from "react";
import { AudioLines, Drum, Guitar, Mic, Mic2, Music2, Piano, Power, Radio, Settings2, Trash2 } from "lucide-react";
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
    <div className={cn("flex w-2 flex-col-reverse gap-px", tall ? "h-64" : "h-44")}>
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

function Strip({ t, level, selected, onSelect }: { t: Track; level: number; selected: boolean; onSelect: () => void }) {
  const { updateTrack, addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex w-[108px] shrink-0 cursor-pointer flex-col items-center gap-1.5 border-r border-border bg-surface px-1.5 py-2 transition-colors",
        selected && "bg-surface-2"
      )}
      style={selected ? { boxShadow: `inset 0 2px 0 0 ${t.color}` } : undefined}
    >
      {/* colour + instrument badge */}
      <div
        className="flex w-full items-center justify-center gap-1 rounded-sm px-1 py-1"
        style={{
          background: `color-mix(in oklab, ${t.color} 22%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${t.color} 45%, transparent)`,
        }}
        title={t.instrument ?? t.kind}
      >
        <KindIcon t={t} className="size-3 shrink-0" />
        <span className="truncate font-mono text-[8px] uppercase tracking-wider" style={{ color: t.color }}>
          {t.instrument ?? t.kind}
        </span>
      </div>

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
        <div className="flex h-64 flex-col justify-between py-1">
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
            className="h-64 w-7"
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

      {/* sends menu — reverb / delay / chorus live here now */}
      <SendsMenu t={t} />

      {/* routing / inserts menu */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex h-6 w-full items-center justify-center gap-1 rounded-sm bg-surface-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="size-3" /> {t.bus}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <div className="label-xs mb-1">Bus</div>
            <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
              <SelectTrigger className="h-7 w-full text-xs uppercase">
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
          <InsertRack
            title="Inserts"
            list={t.plugins ?? []}
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

function BusStrip({ id, state, level, onChange }: { id: BusId; state: BusState; level: number; onChange: (p: Partial<BusState>) => void }) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-surface-2/50 px-1.5 py-2">
      <span className="truncate font-mono text-[9px] font-bold uppercase tracking-wider text-primary">{id}</span>
      <span className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground">Bus</span>
      <div className="flex items-stretch gap-1">
        <Slider
          orientation="vertical"
          className="h-64 w-7"
          value={[state.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onValueChange={([v = 0]) => onChange({ volume: v })}
        />
        <Meter level={level} tall />
      </div>
      <span className="font-mono text-[9px] text-muted-foreground">{toDb(state.volume).toFixed(1)}</span>
      <button
        onClick={() => onChange({ muted: !state.muted })}
        className={cn(
          "h-5 w-full rounded-sm font-mono text-[9px] font-bold transition-colors",
          state.muted ? "bg-amber-500 text-black" : "bg-surface text-muted-foreground hover:text-foreground"
        )}
      >
        M
      </button>
      <FxMenu target={`bus:${id}`} label="FX" />
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
    <div className="flex w-[124px] shrink-0 flex-col items-center gap-1.5 bg-surface-2 px-2 py-2 shadow-[inset_2px_0_0_0_var(--grid-line-strong)]">
      <span className="font-display text-[10px] font-bold uppercase tracking-widest text-primary">Master</span>
      <div className="mt-3.5 flex items-stretch gap-1">
        <div className="flex h-64 flex-col justify-between py-1">
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
  const { tracks, transport, selectedId, select, buses, setBus } = useStudio();
  const levels = useMeters(tracks, transport);
  const busLevel = (id: BusId) => {
    const members = tracks.filter((t) => t.bus === id && !t.muted);
    const peak = Math.max(0, ...members.map((t) => levels.tracks[t.id] ?? 0));
    return buses[id].muted ? 0 : peak * Math.min(1, buses[id].volume);
  };
  return (
    <div className="flex overflow-x-auto border border-border bg-surface">
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
