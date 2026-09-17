import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
// Console fader thumb sizing is provided by FADER_CAP below.
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Drum,
  Guitar,
  Maximize2,
  Mic,
  Mic2,
  Minimize2,
  MoreVertical,
  Music2,
  Palette,
  Piano,
  Power,
  Radio,
  Settings2,
  Sliders,
  Trash2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio, type MidiTarget } from "@/lib/synclab/store";
import { TRACK_COLORS } from "@/lib/synclab/presets";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
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
const BUS_COLOR: Record<string, string> = {
  drums: "oklch(0.75 0.19 30)",
  vocals: "oklch(0.75 0.19 330)",
  instruments: "oklch(0.82 0.17 95)",
  synths: "oklch(0.72 0.18 265)",
  fx: "oklch(0.78 0.18 145)",
  master: "oklch(0.78 0.16 195)",
};

function toDb(v: number) {
  return 20 * Math.log10(Math.max(0.001, v));
}

function dbToFrac(db: number) {
  return Math.min(1, Math.max(0, (db + 48) / 54));
}

function fracToDb(frac: number) {
  return frac * 54 - 48;
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
        reportLevel(id, raw);
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

/** Segmented LED meter with peak-hold marker. Body takes the channel colour, top end stays amber/red. */
function Meter({ level, tall, color }: { level: number; tall?: boolean; color?: string }) {
  const segs = 32;
  const lit = Math.round(level * segs);
  const hold = useRef(0);
  const [held, setHeld] = useState(0);
  if (level > hold.current) hold.current = level;
  useEffect(() => {
    const id = setInterval(() => {
      hold.current = Math.max(0, hold.current - 0.03);
      setHeld(hold.current);
    }, 120);
    return () => clearInterval(id);
  }, []);
  const holdSeg = Math.round(Math.max(held, hold.current) * segs) - 1;
  return (
    <div className={cn("flex w-4 flex-col-reverse gap-px rounded-[3px] border border-black/60 bg-black/60 p-[3px] shadow-inner", tall ? "h-full min-h-40" : "h-44")}>
      {Array.from({ length: segs }, (_, i) => {
        const on = i < lit;
        const isHold = i === holdSeg;
        const red = i >= segs - 2;
        const amber = i >= segs - 6;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[1px] transition-colors duration-75",
              !on && !isHold && "bg-surface-2/70",
              on && red && "bg-red-500",
              on && !red && amber && "bg-amber-400"
            )}
            style={
              on && !red && !amber
                ? { background: color ?? "oklch(0.78 0.18 145)" }
                : isHold && !on
                  ? { background: `color-mix(in oklab, ${color ?? "white"} 70%, white)` }
                  : undefined
            }
          />
        );
      })}
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

/* ---- Console section geometry: every column shares these row heights ---- */
const ROW = {
  head: "h-7",
  eq: "h-[74px]",
  devices: "h-[92px]",
  sends: "h-7",
  sendBars: "h-[26px]",
  io: "h-[52px]",
  pan: "h-[38px]",
  fader: "h-[300px]",
  readout: "h-5",
  buttons: "h-6",
  name: "h-8",
} as const;

/** Console desk finishes the user can pick between. */
export type ConsoleStyleId = "ssl" | "neve" | "api" | "live" | "vintage" | "neon";
type ConsoleStyle = {
  id: ConsoleStyleId;
  name: string;
  desc: string;
  /** panel gradient stops */
  a: string;
  b: string;
  c: string;
  /** needle / trim accent */
  accent: string;
  screws: boolean;
};

const CONSOLE_STYLES: ConsoleStyle[] = [
  {
    id: "ssl",
    name: "SL 9000 Grey",
    desc: "Classic large-format grey metal desk",
    a: "oklch(0.36 0.008 260)",
    b: "oklch(0.30 0.008 260)",
    c: "oklch(0.22 0.008 260)",
    accent: "oklch(0.75 0.19 30)",
    screws: true,
  },
  {
    id: "neve",
    name: "Neve 88 Navy",
    desc: "Deep blue British desk, red trim",
    a: "oklch(0.34 0.05 255)",
    b: "oklch(0.27 0.05 255)",
    c: "oklch(0.18 0.045 255)",
    accent: "oklch(0.68 0.21 25)",
    screws: true,
  },
  {
    id: "api",
    name: "API Black",
    desc: "Blacked-out US desk, amber lamps",
    a: "oklch(0.26 0.006 60)",
    b: "oklch(0.20 0.006 60)",
    c: "oklch(0.13 0.006 60)",
    accent: "oklch(0.82 0.17 75)",
    screws: true,
  },
  {
    id: "live",
    name: "Live Flat",
    desc: "Modern flat software mixer, no hardware trim",
    a: "oklch(0.28 0.004 260)",
    b: "oklch(0.25 0.004 260)",
    c: "oklch(0.23 0.004 260)",
    accent: "oklch(0.80 0.16 195)",
    screws: false,
  },
  {
    id: "vintage",
    name: "Vintage Tape",
    desc: "Warm cream and walnut studio desk",
    a: "oklch(0.42 0.045 75)",
    b: "oklch(0.34 0.045 70)",
    c: "oklch(0.24 0.04 60)",
    accent: "oklch(0.84 0.14 85)",
    screws: true,
  },
  {
    id: "neon",
    name: "Detroit Neon",
    desc: "Blacked glass with cyan edge light",
    a: "oklch(0.22 0.02 200)",
    b: "oklch(0.17 0.02 200)",
    c: "oklch(0.12 0.02 200)",
    accent: "oklch(0.82 0.17 185)",
    screws: false,
  },
];

/** Panel background, driven by the picked desk (vars set on the console root). */
const PANEL =
  "linear-gradient(180deg, var(--mx-a, oklch(0.36 0.008 260)), var(--mx-b, oklch(0.30 0.008 260)) 45%, var(--mx-c, oklch(0.22 0.008 260)))";

/** Console screw head. */
function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mx-screw pointer-events-none inline-block size-[7px] shrink-0 rounded-full border border-black/70",
        "bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.55),rgba(0,0,0,0.65))]",
        className
      )}
    />
  );
}


/** Analog VU meter gauge (0..1 level). */
function VuMeter({ level, label }: { level: number; label: string }) {
  // Map dB-ish fraction to needle angle: -46deg .. +42deg
  const angle = -46 + Math.min(1, Math.max(0, level)) * 88;
  return (
    <div className="flex flex-1 flex-col items-center">
      <svg viewBox="0 0 60 38" className="w-full max-w-[64px]">
        <path d="M 6 34 A 26 26 0 0 1 54 34" fill="none" stroke="oklch(0.9 0.02 95)" strokeWidth="1" opacity="0.5" />
        <path d="M 44.6 15.4 A 26 26 0 0 1 54 34" fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="2.2" />
        {[-40, -20, -7, -3, 0].map((db, i) => {
          const a = ((-46 + i * 22) * Math.PI) / 180;
          const x1 = 30 + Math.sin(a) * 20;
          const y1 = 34 - Math.cos(a) * 20;
          const x2 = 30 + Math.sin(a) * 24;
          const y2 = 34 - Math.cos(a) * 24;
          return <line key={db} x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.85 0.02 95)" strokeWidth="1" opacity="0.7" />;
        })}
        <g transform={`rotate(${angle} 30 34)`}>
          <line x1="30" y1="34" x2="30" y2="10" stroke="var(--mx-accent, oklch(0.75 0.19 30))" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <circle cx="30" cy="34" r="2.6" fill="oklch(0.3 0.01 260)" stroke="oklch(0.7 0.02 95)" strokeWidth="0.8" />
      </svg>
      <span className="font-mono text-[6px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

/** Chunky console fader thumb overrides for the shadcn slider. */
const FADER_CAP =
  "mx-fader [&_[role=slider]]:h-6 [&_[role=slider]]:w-9 [&_[role=slider]]:rounded-[3px] [&_[role=slider]]:border-black/70 [&_[role=slider]]:shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]";

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

/** Left-hand label rail, mirrors the strip row heights. */
function LabelRail() {
  return (
    <div className="sticky left-0 z-10 flex w-[76px] shrink-0 flex-col border-r border-border bg-surface-2/85 backdrop-blur">
      <SectionLabel className={cn(ROW.head, "bg-surface-2")}>Ch</SectionLabel>
      <SectionLabel className={ROW.eq}>EQ</SectionLabel>
      <SectionLabel className={ROW.devices}>Devices</SectionLabel>
      <SectionLabel className={ROW.sends}>Sends</SectionLabel>
      <SectionLabel className={ROW.sendBars}>R / D / C</SectionLabel>
      <SectionLabel className={ROW.io}>Audio to</SectionLabel>
      <SectionLabel className={ROW.pan}>Pan</SectionLabel>
      <SectionLabel className={cn(ROW.fader, "items-start pt-2")}>Vol</SectionLabel>
      <SectionLabel className={ROW.readout}>Peak</SectionLabel>
      <SectionLabel className={ROW.buttons}>M / S / Rec</SectionLabel>
      <SectionLabel className={cn(ROW.name, "border-b-0")}>Track</SectionLabel>
    </div>
  );
}

/** Compact device chain shown directly on the strip. */
function DeviceSlots({ t, narrow }: { t: Track; narrow: boolean }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const list = t.plugins ?? [];
  const max = narrow ? 2 : 3;
  return (
    <div className={cn(ROW.devices, "w-full space-y-0.5 overflow-hidden border-b border-border/60 px-1 py-1")}>
      {list.slice(0, max).map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-sm px-1 py-[3px]"
          style={{ background: `color-mix(in oklab, ${t.color} 18%, var(--surface-2, transparent))` }}
        >
          <button onClick={(e) => { e.stopPropagation(); togglePluginBypass(t.id, p.id); }} title="Bypass">
            <Power className="size-2.5" style={{ color: p.bypass ? "var(--muted-foreground)" : t.color }} />
          </button>
          <span className="flex-1 truncate font-mono text-[8px] uppercase">{p.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); removePlugin(t.id, p.id); }}
            title={`Remove ${p.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-2.5" />
          </button>
        </div>
      ))}
      {list.length > max && (
        <div className="px-1 font-mono text-[8px] text-muted-foreground">+{list.length - max} more</div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex h-5 w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-2.5" /> {list.length ? `Edit ${list.length}` : "Add"}
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

/** Small colour picker so every channel can be recoloured from the console. */
function ColorDot({ t }: { t: Track }) {
  const { updateTrack } = useStudio();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title="Channel colour"
          className="size-3.5 shrink-0 rounded-full border border-black/40"
          style={{ background: t.color }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1.5">
          {TRACK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => updateTrack(t.id, { color: c })}
              className={cn("size-5 rounded-full border", c === t.color ? "border-foreground" : "border-black/40")}
              style={{ background: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Always-visible 3-band channel EQ. Creates a real Channel EQ insert on first use. */
function ChannelEq({ t }: { t: Track }) {
  const { addPlugin, setPluginParam, installedPlugins } = useStudio();
  const eq = (t.plugins ?? []).find((p) => p.kind === "eq");
  const bands: [string, string][] = [
    ["high", "HI"],
    ["mid", "MID"],
    ["low", "LO"],
  ];
  const addEq = () => {
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (def) addPlugin(t.id, def);
  };
  return (
    <div
      className={cn(ROW.eq, "flex items-center gap-1 border-b border-border/60 px-1.5 py-1")}
      style={{ "--primary": t.color } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      {!eq ? (
        <button
          onClick={addEq}
          className="h-full w-full rounded-sm border border-dashed border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          + EQ
        </button>
      ) : (
        bands.map(([id, label]) => {
          const param = eq.params.find((p) => p.id === id);
          const value = param?.value ?? 0;
          return (
            <div key={id} className="flex h-full flex-1 flex-col items-center justify-between">
              <Slider
                orientation="vertical"
                className="h-[42px] w-4"
                value={[value]}
                min={-18}
                max={18}
                step={0.5}
                onDoubleClick={() => setPluginParam(t.id, eq.id, id, 0)}
                onValueChange={([v = 0]) => setPluginParam(t.id, eq.id, id, v)}
              />
              <span className="font-mono text-[7px] uppercase text-muted-foreground">{label}</span>
              <span className="font-mono text-[7px] text-foreground/70">{value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Channel menu: rename, quick inserts, reset, duplicate, delete. */
/** Assign hardware knobs/faders to this channel's controls. */
function MidiLearnBlock({ id, params }: { id: string; params?: MidiTarget["param"][] }) {
  const { midiMap, midiLearn, startMidiLearn, cancelMidiLearn, clearMidiMapping, midiInputId, enableMidi } = useStudio();
  const list = params ?? (["volume", "pan", "mute", "solo"] as MidiTarget["param"][]);
  const ccFor = (p: MidiTarget["param"]) => {
    const hit = Object.entries(midiMap).find(([, v]) => v.id === id && v.param === p);
    return hit ? `CC ${hit[0].split(":")[1]}` : null;
  };
  return (
    <div className="space-y-1">
      <div className="label-xs pt-1">Hardware control</div>
      {!midiInputId && (
        <button
          onClick={enableMidi}
          className="h-6 w-full rounded-sm border border-border bg-surface font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
        >
          Connect MIDI controller
        </button>
      )}
      <div className="grid grid-cols-2 gap-1">
        {list.map((p) => {
          const cc = ccFor(p);
          const learning = midiLearn?.id === id && midiLearn.param === p;
          return (
            <div key={p} className="flex items-center gap-1">
              <button
                onClick={() => (learning ? cancelMidiLearn() : startMidiLearn({ id, param: p }))}
                className={cn(
                  "h-6 flex-1 rounded-sm border px-1 font-mono text-[8px] uppercase",
                  learning
                    ? "animate-pulse border-primary bg-primary/20 text-primary"
                    : cc
                      ? "border-primary/40 bg-surface text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
                title={cc ? `${p} follows ${cc}` : `Learn a knob for ${p}`}
              >
                {learning ? "MOVE…" : `${p} ${cc ?? ""}`}
              </button>
              {cc && (
                <button
                  onClick={() => clearMidiMapping({ id, param: p })}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Clear ${p} mapping`}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelMenu({ t }: { t: Track }) {
  const { updateTrack, duplicateTrack, removeTrack, addPlugin, installedPlugins } = useStudio();
  const quick: [string, string][] = [
    ["eq", "EQ"],
    ["paraeq", "Pro-EQ"],
    ["filter", "Filter"],
    ["drive", "Drive"],
    ["compressor", "Comp"],
    ["limiter", "Limiter"],
    ["gate", "Gate"],
    ["delay", "Delay"],
    ["reverb", "Reverb"],
    ["chorus", "Chorus"],
    ["flanger", "Flanger"],
    ["phaser", "Phaser"],
    ["tremolo", "Tremolo"],
    ["autopan", "Autopan"],
    ["width", "Width"],
    ["bitcrusher", "Crusher"],
    ["vocoder", "Vocoder"],
    ["gain", "Gain"],
  ];
  const add = (kind: string) => {
    const def =
      installedPlugins.find((d) => d.kind === kind) ?? BUILT_IN_PLUGINS.find((d) => d.kind === kind);
    if (def) addPlugin(t.id, def);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title="Channel menu"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Channel</div>
        <input
          value={t.name}
          onChange={(e) => updateTrack(t.id, { name: e.target.value })}
          className="h-7 w-full rounded-sm border border-border bg-surface-2 px-2 font-mono text-[10px] uppercase"
        />
        <div className="label-xs pt-1">Add effect</div>
        <div className="grid grid-cols-3 gap-1">
          {quick.map(([kind, label]) => (
            <button
              key={kind}
              onClick={() => add(kind)}
              className="h-6 rounded-sm border border-border bg-surface px-1 font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>
        <MidiLearnBlock id={t.id} />
        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={() => updateTrack(t.id, { volume: 0.8, pan: 0, muted: false, solo: false })}
            className="h-6 rounded-sm border border-border bg-surface font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
          <button
            onClick={() => duplicateTrack(t.id)}
            className="h-6 rounded-sm border border-border bg-surface font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
          >
            Duplicate
          </button>
        </div>
        <button
          onClick={() => removeTrack(t.id)}
          className="h-6 w-full rounded-sm border border-destructive/50 font-mono text-[8px] uppercase text-destructive hover:bg-destructive/10"
        >
          Delete channel
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Strip({
  t,
  level,
  selected,
  narrow,
  index,
  onSelect,
}: {
  t: Track;
  level: number;
  selected: boolean;
  narrow: boolean;
  index: number;
  onSelect: () => void;
}) {
  const { updateTrack, moveTrack, tracks } = useStudio();
  const [clip, setClip] = useState(false);
  useEffect(() => {
    if (level > 0.985) setClip(true);
  }, [level]);

  const tint = (pct: number) => `color-mix(in oklab, ${t.color} ${pct}%, transparent)`;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex shrink-0 cursor-pointer flex-col border-r border-black/50 transition-colors",
        narrow ? "w-[92px]" : "w-[132px]"
      )}
      style={{
        background: selected
          ? `linear-gradient(${tint(20)}, ${tint(6)}), ${PANEL}`
          : `linear-gradient(${tint(10)}, ${tint(2)}), ${PANEL}`,
        boxShadow: `inset 4px 0 0 0 ${t.color}, inset 0 1px 0 0 rgba(255,255,255,0.08)${selected ? `, inset 0 0 0 1px ${tint(45)}` : ""}`,
      }}
    >
      {/* channel header: number, colour, clip LED */}
      <div
        className={cn(ROW.head, "flex items-center gap-1 border-b border-black/50 px-1.5")}
        style={{ background: tint(18) }}
      >
        <Screw />
        <span className="font-mono text-[9px] font-bold text-muted-foreground">{index + 1}</span>
        <ColorDot t={t} />
        <ChannelMenu t={t} />
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, -1); }}
          disabled={index === 0}
          title="Move channel left"
          aria-label="Move channel left"
          className="h-3.5 w-3 rounded-[2px] text-muted-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronLeft className="size-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, 1); }}
          disabled={index >= tracks.length - 1}
          title="Move channel right"
          aria-label="Move channel right"
          className="h-3.5 w-3 rounded-[2px] text-muted-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronRight className="size-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setClip(false); }}
          title="Clip indicator — click to reset"
          className={cn(
            "ml-auto h-3 w-5 rounded-[2px] font-mono text-[7px] font-bold leading-3",
            clip ? "bg-red-500 text-black" : "bg-black/40 text-muted-foreground"
          )}
        >
          CLIP
        </button>
        <Screw />
      </div>

      <ChannelEq t={t} />

      <DeviceSlots t={t} narrow={narrow} />

      {/* sends */}
      <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
        <SendsMenu t={t} />
      </div>

      {/* send amount bars */}
      <div className={cn(ROW.sendBars, "flex items-center gap-1 border-b border-border/60 px-1.5")}>
        {SEND_KEYS.map(([key, label]) => {
          const v = t.sends?.[key] ?? 0;
          return (
            <div key={key} className="flex-1" title={`${label} ${Math.round(v * 100)}%`}>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: t.color }} />
              </div>
              <div className="mt-[1px] text-center font-mono text-[7px] text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </div>

      {/* audio-to routing */}
      <div className={cn(ROW.io, "flex flex-col justify-center gap-0.5 border-b border-border/60 px-1")}>
        <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
          <SelectTrigger
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-full rounded-sm border-border px-1 font-mono text-[8px] uppercase"
            style={{ background: `color-mix(in oklab, ${BUS_COLOR[t.bus] ?? t.color} 22%, var(--surface-2, transparent))` }}
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
      <div
        className={cn(ROW.pan, "flex flex-col justify-center border-b border-border/60 px-1.5")}
        style={{ "--primary": t.color } as CSSProperties}
      >
        <Slider
          value={[t.pan]}
          min={-1}
          max={1}
          step={0.01}
          className="h-3"
          onValueChange={([v = 0]) => updateTrack(t.id, { pan: v })}
        />
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { pan: 0 }); }}
          title="Double-click resets to centre"
          className="mt-0.5 text-center font-mono text-[8px] text-muted-foreground hover:text-foreground"
        >
          {t.pan === 0 ? "C" : t.pan < 0 ? `L${Math.round(-t.pan * 100)}` : `R${Math.round(t.pan * 100)}`}
        </button>
      </div>

      {/* fader + scale + meter */}
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}
        style={{ "--primary": t.color } as CSSProperties}
      >
        {!narrow && (
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
        )}
        <Slider
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[t.volume]}
          min={0}
          max={1}
          step={0.01}
          onDoubleClick={() => updateTrack(t.id, { volume: 0.8 })}
          onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
        />
        <Meter level={level} tall color={t.color} />
      </div>

      {/* fader dB + live peak dB */}
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(t.volume).toFixed(1)}</span>
        <span className={cn("font-mono text-[9px]", level > 0.98 ? "text-red-400" : "text-foreground/70")}>
          {fracToDb(level).toFixed(0)}
        </span>
      </div>

      {/* M / S / arm */}
      <div className={cn(ROW.buttons, "flex items-center gap-1 border-b border-border/60 px-1")}>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { muted: !t.muted }); }}
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.muted ? "bg-amber-500 text-black" : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }}
          className={cn("h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors", !t.solo && "bg-black/30 text-muted-foreground hover:text-foreground")}
          style={t.solo ? { background: t.color, color: "black" } : undefined}
        >
          S
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { armed: !t.armed }); }}
          title="Arm for recording"
          className={cn(
            "h-5 flex-1 rounded-sm font-mono text-[9px] font-bold transition-colors",
            t.armed ? "bg-red-500 text-black" : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          ●
        </button>
      </div>

      {/* coloured name plate */}
      <div
        className={cn(ROW.name, "flex items-center gap-1 px-1.5")}
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${t.color} 70%, transparent), color-mix(in oklab, ${t.color} 40%, transparent))`,
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

function BusStrip({
  id,
  state,
  level,
  onChange,
}: {
  id: BusId;
  state: BusState;
  level: number;
  onChange: (p: Partial<BusState>) => void;
}) {
  const color = BUS_COLOR[id] ?? "oklch(0.78 0.16 195)";
  const tint = (pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;
  return (
    <div
      className="flex w-[116px] shrink-0 flex-col border-r border-black/50"
      style={{ background: `linear-gradient(${tint(10)}, ${tint(3)}), ${PANEL}`, boxShadow: `inset 4px 0 0 0 ${color}, inset 0 1px 0 0 rgba(255,255,255,0.08)` }}
    >
      <div className={cn(ROW.head, "flex items-center justify-between border-b border-black/50 px-1.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")} style={{ background: tint(16) }}>
        <Screw />
        Bus
        <Screw />
      </div>
      <div className={cn(ROW.eq, "flex items-center justify-center border-b border-border/60 font-mono text-[7px] uppercase tracking-widest text-muted-foreground")}>
        Bus FX below
      </div>
      <div className={cn(ROW.devices, "border-b border-border/60 p-1")}>
        <FxMenu target={`bus:${id}`} label="Devices" />
      </div>
      <div className={cn(ROW.sends, "border-b border-border/60")} />
      <div className={cn(ROW.sendBars, "border-b border-border/60")} />
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")}>
        Master
      </div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}
        style={{ "--primary": color } as CSSProperties}
      >
        <Slider
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[state.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onValueChange={([v = 0]) => onChange({ volume: v })}
        />
        <Meter level={level} tall color={color} />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(state.volume).toFixed(1)} dB</span>
      </div>
      <div className={cn(ROW.buttons, "flex items-center border-b border-border/60 px-1")}>
        <button
          onClick={() => onChange({ muted: !state.muted })}
          className={cn(
            "h-5 w-full rounded-sm font-mono text-[9px] font-bold transition-colors",
            state.muted ? "bg-amber-500 text-black" : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
      </div>
      <div
        className={cn(ROW.name, "flex items-center justify-center")}
        style={{ background: tint(45), boxShadow: `inset 0 2px 0 0 ${color}` }}
      >
        <span className="truncate font-mono text-[9px] font-bold uppercase tracking-wider text-foreground">{id}</span>
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

/** Master insert chain with one-tap mastering effects (limiter first). */
function MasterChain({ color }: { color: string }) {
  const { fxChains, addFxPlugin, removeFxPlugin, toggleFxBypass, installedPlugins } = useStudio();
  const list = fxChains["bus:master"] ?? [];
  const quick: [string, string][] = [
    ["limiter", "Limiter"],
    ["compressor", "Glue"],
    ["paraeq", "Pro-EQ"],
    ["width", "Width"],
  ];
  const add = (kind: string) => {
    const def = installedPlugins.find((d) => d.kind === kind) ?? BUILT_IN_PLUGINS.find((d) => d.kind === kind);
    if (def) addFxPlugin("bus:master", def);
  };
  return (
    <div className={cn(ROW.eq, "space-y-0.5 overflow-y-auto border-b border-border/60 px-1 py-1")}>
      {list.length === 0 && (
        <div className="text-center font-mono text-[7px] uppercase tracking-widest text-muted-foreground">
          Main bus — no mastering yet
        </div>
      )}
      {list.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-sm px-1 py-[2px]"
          style={{ background: `color-mix(in oklab, ${color} 18%, var(--surface-2, transparent))` }}
        >
          <button onClick={() => toggleFxBypass("bus:master", p.id)} title="Bypass">
            <Power className="size-2.5" style={{ color: p.bypass ? "var(--muted-foreground)" : color }} />
          </button>
          <span className="flex-1 truncate font-mono text-[8px] uppercase">{p.name}</span>
          <button
            onClick={() => removeFxPlugin("bus:master", p.id)}
            title={`Remove ${p.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-2.5" />
          </button>
        </div>
      ))}
      <div className="grid grid-cols-4 gap-1 pt-[2px]">
        {quick.map(([kind, label]) => (
          <button
            key={kind}
            onClick={() => add(kind)}
            title={`Add ${label} to the main output`}
            className="h-4 rounded-sm border border-border bg-surface font-mono text-[7px] uppercase text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MasterStrip({ level: peak }: { level: number }) {
  const { buses, setBus } = useStudio();
  const master = buses["master"] as BusState;
  const [clip, setClip] = useState(false);
  const color = BUS_COLOR["master"] as string;
  useEffect(() => {
    if (peak > 0.985) setClip(true);
  }, [peak]);
  return (
    <div
      className="flex w-[210px] shrink-0 flex-col border-l-2 border-black/60"
      style={{
        background: `linear-gradient(color-mix(in oklab, ${color} 12%, transparent), transparent), ${PANEL}`,
        boxShadow: `inset 4px 0 0 0 ${color}, inset 0 1px 0 0 rgba(255,255,255,0.08)`,
      }}
    >
      <div
        className={cn(ROW.head, "flex items-center justify-between border-b border-black/50 px-1.5 font-mono text-[8px] uppercase tracking-widest")}
        style={{ background: `color-mix(in oklab, ${color} 22%, transparent)` }}
      >
        <Screw />
        Main
        <Popover>
          <PopoverTrigger asChild>
            <button title="Master hardware control" className="text-muted-foreground hover:text-foreground">
              <Sliders className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <MidiLearnBlock id="master" params={["volume", "mute"]} />
          </PopoverContent>
        </Popover>
        <Screw />
      </div>
      <MasterChain color={color} />
      <div className={cn(ROW.devices, "flex items-center gap-1 border-b border-black/50 px-1.5 py-1")}>
        <VuMeter level={peak} label="L" />
        <VuMeter level={peak} label="R" />
      </div>
      <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
        <FxMenu target="bus:master" label="Master FX" />
      </div>
      <div className={cn(ROW.sendBars, "border-b border-border/60")} />
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")}>
        Main out
      </div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1.5 border-b border-border/60 py-1")}
        style={{ "--primary": color } as CSSProperties}
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
          className={cn("h-full w-8", FADER_CAP)}
          value={[master.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onDoubleClick={() => setBus("master", { volume: 1 })}
          onValueChange={([v = 0]) => setBus("master", { volume: v })}
        />
        <Meter level={peak} tall color={color} />
        <Meter level={peak} tall color={color} />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className={cn("font-mono text-[9px]", peak > 0.98 ? "text-red-400" : "text-muted-foreground")}>
          {fracToDb(peak).toFixed(1)} dB
        </span>
      </div>
      <div className={cn(ROW.buttons, "flex items-center justify-center border-b border-border/60")}>
        <button
          onClick={() => setClip(false)}
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider",
            clip ? "bg-red-500 text-black" : "bg-black/30 text-muted-foreground"
          )}
        >
          {clip ? "CLIP — reset" : "OK"}
        </button>
      </div>
      <div
        className={cn(ROW.name, "flex items-center justify-center")}
        style={{ background: `color-mix(in oklab, ${color} 55%, transparent)`, boxShadow: `inset 0 2px 0 0 ${color}` }}
      >
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-foreground">Master</span>
      </div>
    </div>
  );
}

export function Mixer() {
  const { tracks, transport, selectedId, select, buses, setBus, updateTrack, addTrack } = useStudio();
  const levels = useMeters(tracks, transport);
  const [narrow, setNarrow] = useState(false);
  const [showBuses, setShowBuses] = useState(true);
  const [styleId, setStyleId] = useState<ConsoleStyleId>(() => {
    if (typeof window === "undefined") return "ssl";
    const saved = window.localStorage.getItem("synclab.mixer.style") as ConsoleStyleId | null;
    return CONSOLE_STYLES.some((s) => s.id === saved) ? (saved as ConsoleStyleId) : "ssl";
  });
  const desk = CONSOLE_STYLES.find((s) => s.id === styleId) ?? (CONSOLE_STYLES[0] as ConsoleStyle);
  useEffect(() => {
    window.localStorage.setItem("synclab.mixer.style", styleId);
  }, [styleId]);
  const soloed = tracks.some((t) => t.solo);
  const muted = tracks.some((t) => t.muted);
  const busLevel = (id: BusId) => {
    const members = tracks.filter((t) => t.bus === id && !t.muted);
    const peak = Math.max(0, ...members.map((t) => levels.tracks[t.id] ?? 0));
    return buses[id].muted ? 0 : peak * Math.min(1, buses[id].volume);
  };
  // Only show bus strips that actually have channels routed to them.
  const activeBuses = BUS_STRIPS.filter((id) => tracks.some((t) => t.bus === id));
  return (
    <div
      className="mx-console flex flex-col border border-border bg-surface"
      data-console={desk.id}
      style={
        {
          "--mx-a": desk.a,
          "--mx-b": desk.b,
          "--mx-c": desk.c,
          "--mx-accent": desk.accent,
        } as CSSProperties
      }
    >
      {/* console toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/70 px-2 py-1.5">
        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-primary">Mix Console</span>

        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {tracks.length} ch · {activeBuses.length} buses
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Choose console"
                className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className="size-2.5 rounded-[2px] border border-black/60" style={{ background: desk.accent }} />
                {desk.name}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <div className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                Console desk
              </div>
              {CONSOLE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
                    s.id === styleId && "bg-surface-2"
                  )}
                >
                  <span
                    className="h-7 w-5 shrink-0 rounded-[2px] border border-black/60"
                    style={{
                      background: `linear-gradient(180deg, ${s.a}, ${s.b} 45%, ${s.c})`,
                      boxShadow: `inset 0 2px 0 0 ${s.accent}`,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-foreground">{s.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{s.desc}</span>
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            onClick={() => tracks.forEach((t) => t.solo && updateTrack(t.id, { solo: false }))}
            disabled={!soloed}
            className={cn(
              "flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              soloed ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-surface text-muted-foreground opacity-60"
            )}
          >
            Clear solo
          </button>
          <button
            onClick={() => tracks.forEach((t) => t.muted && updateTrack(t.id, { muted: false }))}
            disabled={!muted}
            className={cn(
              "flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              muted ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-surface text-muted-foreground opacity-60"
            )}
          >
            <VolumeX className="size-3" /> Unmute all
          </button>
          <button
            onClick={() => setShowBuses((v) => !v)}
            className={cn(
              "h-6 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              showBuses ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            Buses
          </button>
          <button
            onClick={() => setNarrow((v) => !v)}
            title={narrow ? "Wide strips" : "Narrow strips"}
            className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {narrow ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
            {narrow ? "Wide" : "Narrow"}
          </button>
        <span className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <Palette className="size-3" /> Out {fracToDb(levels.master).toFixed(0)} dB
          </span>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <Sliders className="size-7 text-muted-foreground/60" />
          <div className="font-display text-[12px] font-bold uppercase tracking-widest text-foreground">
            Console empty
          </div>
          <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-wider text-muted-foreground">
            Channels appear here as soon as you add tracks. Drag a tool from the left rail onto the timeline, or start
            with one below.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            {(
              [
                ["audio", "Audio"],
                ["midi", "MIDI"],
                ["instrument", "Synth"],
                ["drum", "Drums"],
                ["sampler", "Sampler"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                onClick={() => addTrack(kind, label.toUpperCase())}
                className="h-7 rounded-sm border border-border bg-surface-2 px-3 font-mono text-[9px] uppercase tracking-wider text-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex overflow-x-auto">
          <LabelRail />
          {tracks.map((t, i) => (
            <Strip
              key={t.id}
              t={t}
              index={i}
              narrow={narrow}
              level={t.muted ? 0 : (levels.tracks[t.id] ?? 0)}
              selected={t.id === selectedId}
              onSelect={() => select(t.id)}
            />
          ))}
          {showBuses &&
            activeBuses.map((id) => (
              <BusStrip key={id} id={id} state={buses[id]} level={busLevel(id)} onChange={(p) => setBus(id, p)} />
            ))}
          <div className="sticky right-0 z-10 bg-surface shadow-[-12px_0_18px_-12px_rgba(0,0,0,0.8)]">
            <MasterStrip level={levels.master} />
          </div>
        </div>
      )}
    </div>
  );
}
