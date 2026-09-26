import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
// Console fader thumb sizing is provided by FADER_CAP below.
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MoreVertical,
  Palette,
  Power,
  Settings2,
  Sliders,
  Trash2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";

import { MidiLearnBlock } from "./MidiLearn";
import { TrackNotes } from "@/components/studio/TrackNotes";
import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { AuxId, BusId, BusState, PluginInstance, Track, Transport, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, reportLevel, useClipped } from "@/lib/synclab/clip-monitor";
import { Scope } from "./Scope";
import { XYPad } from "./XYPad";
import { EffectDisplay } from "./EffectDisplay";

const BUSES: BusId[] = ["drums", "vocals", "instruments", "synths", "fx", "master"];
const DB_TICKS = [6, 0, -6, -12, -24, -48];
const SEND_KEYS: [keyof NonNullable<Track["sends"]>, string][] = [
  ["reverb", "REV"],
  ["delay", "DLY"],
  ["chorus", "CHO"],
];
const BUS_STRIPS: BusId[] = ["drums", "vocals", "instruments", "synths", "fx"];
const VCA_IDS: VcaId[] = ["A", "B", "C", "D"];
const AUX_IDS: AuxId[] = ["reverb", "delay", "chorus"];
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
    let timer = 0;
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
      reportLevel("master", mRaw);
      const mPrev = smooth.current["__master"] ?? 0;
      const m = mRaw > mPrev ? mRaw : mPrev * 0.86;
      smooth.current["__master"] = m;
      setLevels({ tracks, master: dbToFrac(toDb(Math.max(m, 0.0005))) });
    };
    loop();
    timer = window.setInterval(loop, 50);
    return () => window.clearInterval(timer);
  }, [idsKey]);
  return levels;
}

/** Segmented LED meter: green at normal levels, red after the channel clips. */
function Meter({ id, level, tall }: { id: string; level: number; tall?: boolean }) {
  const segs = 32;
  const lit = Math.round(level * segs);
  const clipped = useClipped(id);
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
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[1px] transition-colors duration-75",
              !on && !isHold && "bg-surface-2/70",
              on && (clipped ? "bg-red-500" : "bg-emerald-500"),
              isHold && !on && (clipped ? "bg-red-400" : "bg-emerald-300")
            )}
          />
        );
      })}
    </div>
  );
}

/** Clip LED — lights red when the channel has peaked; click to reset. */
function ClipLed({ id, compact }: { id: string; compact?: boolean }) {
  const clipped = useClipped(id);
  return (
    <button
      type="button"
      title={clipped ? "Clipping — click to reset" : "No clipping"}
      onClick={(e) => {
        e.stopPropagation();
        clearClip(id);
      }}
      className={cn(
        "rounded-[2px] font-mono text-[8px] font-bold uppercase tracking-wider transition-colors",
        compact ? "px-1 leading-[13px]" : "px-1.5 py-[1px]",
        clipped ? "animate-pulse bg-red-500 text-black" : "bg-black/40 text-muted-foreground"
      )}
    >
      CLIP
    </button>
  );
}

function InsertRack({
  title,
  list,
  onAdd,
  onRemove,
  onBypass,
  onParam,
  openId,
  onOpenChange,
}: {
  title: string;
  list: PluginInstance[];
  onAdd: (def: import("@/lib/synclab/types").PluginDef) => void;
  onRemove: (id: string) => void;
  onBypass: (id: string) => void;
  onParam: (id: string, paramId: string, value: number) => void;
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
}) {
  const { installedPlugins } = useStudio();
  const [ownOpen, setOwnOpen] = useState<string | null>(null);
  const open = openId !== undefined ? openId : ownOpen;
  const setOpen = (id: string | null) => {
    if (onOpenChange) onOpenChange(id);
    else setOwnOpen(id);
  };
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
            {open === p.id && (
              <div className="space-y-1 pt-1">
                <EffectDisplay plugin={p} height={72} onParam={(paramId, v) => onParam(p.id, paramId, v)} />
                <Scope scopeId={p.id} height={52} />
                <XYPad plugin={p} onParam={(paramId, v) => onParam(p.id, paramId, v)} />
              </div>
            )}
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
  return <TrackIcon track={t} className={className} tinted={false} />;
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
  scope: "h-[48px]",
  eq: "h-[74px]",
  devices: "h-[92px]",
  sends: "h-7",
  sendBars: "h-[26px]",
  io: "h-[52px]",
  pan: "h-[38px]",
  fader: "h-[300px]",
  readout: "h-5",
  buttons: "h-[68px]",
  name: "h-12",
} as const;

/** Console desk finishes the user can pick between. */
export type ConsoleStyleId = "ssl" | "neve" | "api" | "live" | "vintage" | "neon" | "solid";
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
  {
    id: "solid",
    name: "Solid Colour",
    desc: "One flat colour you pick — no gradient",
    a: "#232428",
    b: "#232428",
    c: "#232428",
    accent: "oklch(0.82 0.17 185)",
    screws: false,
  },
];

/** Preset swatches for the Solid Colour desk. */
const SOLID_PRESETS: { name: string; hex: string }[] = [
  { name: "Charcoal", hex: "#1a1b1e" },
  { name: "Graphite", hex: "#2b2d31" },
  { name: "Studio Grey", hex: "#4a4d52" },
  { name: "Midnight Navy", hex: "#1b2432" },
  { name: "Deep Teal", hex: "#15282a" },
  { name: "Detroit Magenta", hex: "#2c1626" },
  { name: "Electric Violet", hex: "#221b33" },
  { name: "Warm Walnut", hex: "#2a211a" },
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
  const advanced = useApp().mode === "advanced";
  return (
    <div className="sticky left-0 z-10 flex w-[76px] shrink-0 flex-col border-r border-border bg-surface-2/85 backdrop-blur">
      <SectionLabel className={cn(ROW.head, "bg-surface-2")}>Ch</SectionLabel>
      {advanced && <SectionLabel className={ROW.scope}>Scope</SectionLabel>}
      <SectionLabel className={ROW.eq}>EQ</SectionLabel>
      <SectionLabel className={ROW.devices}>Devices</SectionLabel>
      {advanced && <SectionLabel className={ROW.sends}>Sends</SectionLabel>}
      {advanced && <SectionLabel className={ROW.sendBars}>R / D / C</SectionLabel>}
      <SectionLabel className={ROW.io}>Audio to</SectionLabel>
      <SectionLabel className={ROW.pan}>Pan</SectionLabel>
      <SectionLabel className={cn(ROW.fader, "items-start pt-2")}>Vol</SectionLabel>
      <SectionLabel className={ROW.readout}>Peak</SectionLabel>
      <SectionLabel className={ROW.name}>Track</SectionLabel>
      <SectionLabel className={cn(ROW.buttons, "border-b-0 items-start pt-1")}>Mute / Solo</SectionLabel>
    </div>
  );
}


/** Compact device chain shown directly on the strip. */
function DeviceSlots({ t, narrow }: { t: Track; narrow: boolean }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const list = t.plugins ?? [];
  const max = narrow ? 2 : 3;
  const [editorOpen, setEditorOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openEditor = (id: string | null) => {
    setOpenId(id);
    setEditorOpen(true);
  };
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
          <button
            className="flex-1 truncate text-left font-mono text-[8px] uppercase hover:text-primary"
            title={`Open ${p.name} editor`}
            onClick={(e) => { e.stopPropagation(); openEditor(p.id); }}
          >
            {p.name}
          </button>
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
        <button
          onClick={(e) => { e.stopPropagation(); openEditor(list[max]?.id ?? null); }}
          className="w-full px-1 text-left font-mono text-[8px] text-muted-foreground hover:text-foreground"
        >
          +{list.length - max} more
        </button>
      )}
      <Popover open={editorOpen} onOpenChange={setEditorOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenId(list[0]?.id ?? null); }}
            className="flex h-5 w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-2.5" /> {list.length ? `Edit ${list.length}` : "Add"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[70vh] w-[360px] overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
          <InsertRack
            title={`${t.name} — inserts`}
            list={list}
            openId={openId}
            onOpenChange={setOpenId}
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

/** Colour + icon picker so every channel can be restyled from the console. */
function ColorDot({ t }: { t: Track }) {
  return (
    <TrackStylePicker track={t}>
      <button
        onClick={(e) => e.stopPropagation()}
        title="Channel colour and icon"
        aria-label="Channel colour and icon"
        className="size-3.5 shrink-0 rounded-full border border-black/40"
        style={{ background: t.color }}
      />
    </TrackStylePicker>
  );
}

/** Always-visible 3-band channel EQ. Creates a real Channel EQ insert on first use. */
function ChannelEq({ t }: { t: Track }) {
  const { addPlugin, setPluginParam, installedPlugins } = useStudio();
  const eq = (t.plugins ?? []).find((p) => p.kind === "eq");
  const bands: [string, string][] = [
    ["low", "LO"],
    ["mid", "MID"],
    ["high", "HI"],
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
        <EqCurve
          scopeId={`ch:${t.id}`}
          bands={bands.map(([id]) => eq.params.find((p) => p.id === id)?.value ?? 0) as [number, number, number]}
          color={t.color}
          bypass={!!eq.bypass}
          onBand={(i, v) => setPluginParam(t.id, eq.id, bands[i]![0], v)}
        />
      )}
    </div>
  );
}

/**
 * Interactive EQ curve display: shows the combined low/mid/high response,
 * drag a band handle up/down to set its gain, double-click a handle to reset.
 */
function EqCurve({
  scopeId,
  bands,
  color,
  bypass,
  onBand,
}: {
  scopeId: string;
  bands: [number, number, number]; // [low, mid, high] gains in dB
  color: string;
  bypass: boolean;
  onBand: (index: number, gain: number) => void;
}) {
  const W = 100;
  const H = 46;
  const PAD = 3;
  const [lo, mid, hi] = bands;
  // Band handles sit at fixed x positions: LO 18%, MID 50%, HI 82%.
  const bandX = [18, 50, 82];
  const bandLabel = ["LO", "MID", "HI"];
  const bandGain = [lo, mid, hi];
  // Log-frequency response model (smooth shelves + bell), x in 0..100.
  const resp = (x: number) => {
    const t01 = x / 100; // 0 = 20 Hz, 1 = 20 kHz (log)
    const lowW = 1 / (1 + Math.exp((t01 - 0.28) * 10));
    const highW = 1 / (1 + Math.exp(-(t01 - 0.72) * 10));
    const midW = Math.exp(-Math.pow((t01 - 0.5) * 4.2, 2));
    return lo * lowW + mid * midW + hi * highW;
  };
  const yOf = (db: number) => PAD + (1 - (db + 18) / 36) * (H - PAD * 2);
  const xOf = (db: number) => yOf(db); // same vertical mapping for handles
  let path = "";
  for (let x = 0; x <= W; x += 2) {
    path += `${x === 0 ? "M" : "L"}${x.toFixed(1)},${yOf(resp(x)).toFixed(2)} `;
  }
  const areaPath = `${path}L${W},${yOf(0)} L0,${yOf(0)} Z`;
  const dragRef = useRef<{ band: number; startY: number; startGain: number } | null>(null);
  const [activeBand, setActiveBand] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const waveRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const node = waveRef.current;
      if (node) {
        const wave = getEngine().getScopeWave(scopeId);
        if (!wave?.length) {
          node.setAttribute("d", `M0,${H / 2} L${W},${H / 2}`);
        } else {
          const stride = Math.max(1, Math.floor(wave.length / W));
          let wavePath = "";
          for (let i = 0; i < wave.length; i += stride) {
            const x = (i / Math.max(1, wave.length - 1)) * W;
            const sample = Math.max(-1, Math.min(1, wave[i] ?? 0));
            const y = H / 2 - sample * (H / 2 - PAD);
            wavePath += `${wavePath ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
          }
          node.setAttribute("d", wavePath);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scopeId]);
  const onPointerDown = (band: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers */
    }
    dragRef.current = { band, startY: e.clientY, startGain: bandGain[band]! };
    setActiveBand(band);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const pxPerDb = (svgRef.current.getBoundingClientRect().height - PAD * 2 * 2) / 36;
    const fine = e.shiftKey ? 0.2 : 1;
    const next = Math.max(-18, Math.min(18, d.startGain - ((e.clientY - d.startY) / Math.max(2, pxPerDb)) * fine));
    onBand(d.band, Math.round(next * 2) / 2);
  };
  const endDrag = () => {
    dragRef.current = null;
    setActiveBand(null);
  };
  return (
    <div className="flex h-full flex-col gap-0.5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn("w-full flex-1 rounded-sm border border-border/60 bg-black/40", bypass && "opacity-40")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* grid: 0 dB line + ±12 dB hints */}
        <line x1="0" y1={yOf(0)} x2={W} y2={yOf(0)} stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <line x1="0" y1={yOf(12)} x2={W} y2={yOf(12)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        <line x1="0" y1={yOf(-12)} x2={W} y2={yOf(-12)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        {[25, 50, 75].map((x) => (
          <line key={x} x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
        ))}
        <path
          ref={waveRef}
          d={`M0,${H / 2} L${W},${H / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
          style={{ color }}
        />
        <path d={areaPath} fill={color} opacity={0.16} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {bandX.map((bx, i) => (
          <circle
            key={i}
            cx={bx}
            cy={xOf(bandGain[i]!)}
            r={activeBand === i ? 3.4 : 2.6}
            fill={color}
            stroke="black"
            strokeWidth="0.6"
            style={{ cursor: "ns-resize", touchAction: "none" }}
            onPointerDown={onPointerDown(i)}
            onDoubleClick={() => onBand(i, 0)}
          />
        ))}
      </svg>
      <div className="flex items-center justify-between font-mono text-[7px]">
        {bandGain.map((g, i) => (
          <span key={i} className={cn(activeBand === i ? "text-foreground" : "text-muted-foreground")}>
            {bandLabel[i]} <span style={{ color: g !== 0 ? color : undefined }}>{g > 0 ? `+${g.toFixed(0)}` : g.toFixed(0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Channel menu: rename, quick inserts, reset, duplicate, delete. */

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
  const { updateTrack, moveTrack, tracks, transport, setTransport } = useStudio();
  const advanced = useApp().mode === "advanced";

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
        <TrackNotes track={t} />
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

      {advanced && (
        <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")}>
          <Scope scopeId={`ch:${t.id}`} height={40} compact color={t.color} />
        </div>
      )}

      <ChannelEq t={t} />

      <DeviceSlots t={t} narrow={narrow} />

      {/* sends */}
      {advanced && (
        <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
          <SendsMenu t={t} />
        </div>
      )}

      {/* send amount bars */}
      {advanced && (
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
      )}


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
        <Select value={t.vca ?? "none"} onValueChange={(v) => updateTrack(t.id, { vca: v === "none" ? undefined : v as VcaId })}>
          <SelectTrigger onClick={(e) => e.stopPropagation()} aria-label={`${t.name} VCA group`} className="h-5 w-full rounded-sm border-border px-1 font-mono text-[8px] uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No VCA</SelectItem>
            {VCA_IDS.map((id) => <SelectItem key={id} value={id}>VCA {id}</SelectItem>)}
          </SelectContent>
        </Select>
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
        <Meter id={t.id} level={level} tall />
      </div>

      {/* fader dB + live peak dB */}
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(t.volume).toFixed(1)}</span>
        <span className={cn("font-mono text-[9px]", level > 0.98 ? "text-red-400" : "text-foreground/70")}>
          {fracToDb(level).toFixed(0)}
        </span>
        <ClipLed id={t.id} compact />
      </div>

      {/* coloured name plate */}
      <div
        className={cn(ROW.name, "flex flex-col items-center justify-center gap-0.5 border-b border-black/40 px-1.5 text-center")}
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${t.color} 70%, transparent), color-mix(in oklab, ${t.color} 40%, transparent))`,
          boxShadow: `inset 0 2px 0 0 ${t.color}`,
        }}
        title={t.name}
      >
        <KindIcon t={t} className="size-9 shrink-0" />
        <span className="w-full truncate font-mono text-[9px] font-semibold uppercase tracking-wider text-foreground">
          {t.name}
        </span>
      </div>

      {/* MUTE / SOLO / REC / MONITOR — the controls you reach for live, at the bottom */}
      <div className={cn(ROW.buttons, "grid grid-cols-2 gap-1 px-1 pt-1")}>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { muted: !t.muted }); }}
          className={cn(
            "h-8 rounded-sm font-mono text-[10px] font-bold tracking-wider transition-colors",
            t.muted
              ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.muted ? "Muted — click to unmute" : "Mute this channel"}
        >
          {t.muted ? "MUTED" : "MUTE"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }}
          className={cn(
            "h-8 rounded-sm font-mono text-[10px] font-bold tracking-wider transition-colors",
            t.solo
              ? "bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.solo ? "Soloed — click to unsolo" : "Solo this channel"}
        >
          {t.solo ? "SOLOED" : "SOLO"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { armed: !t.armed }); }}
          title={t.armed ? "Armed for recording" : "Arm this channel for recording"}
          className={cn(
            "h-6 rounded-sm font-mono text-[9px] font-bold tracking-wider transition-colors",
            t.armed ? "bg-red-500 text-black" : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          ● REC
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTransport({ monitor: !transport.monitor });
          }}
          disabled={!t.armed}
          title={
            t.armed
              ? "Input monitoring — hear the live input on armed channels. This switch is studio-wide."
              : "Arm this channel to monitor its input"
          }
          className={cn(
            "h-6 rounded-sm font-mono text-[9px] font-bold tracking-wider transition-colors disabled:opacity-40",
            t.armed && transport.monitor
              ? "bg-sky-400 text-black"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          MON
        </button>
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
  const advanced = useApp().mode === "advanced";

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
      {advanced && (
        <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")}>
          <Scope scopeId={`bus:${id}`} height={40} compact color={color} />
        </div>
      )}
      <div className={cn(ROW.eq, "flex items-center justify-center border-b border-border/60 font-mono text-[7px] uppercase tracking-widest text-muted-foreground")}>
        Bus FX below
      </div>
      <div className={cn(ROW.devices, "border-b border-border/60 p-1")}>
        <FxMenu target={`bus:${id}`} label="Devices" />
      </div>
      {advanced && <div className={cn(ROW.sends, "border-b border-border/60")} />}
      {advanced && <div className={cn(ROW.sendBars, "border-b border-border/60")} />}

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
        <Meter id={`bus:${id}`} level={level} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center gap-1 border-b border-border/60")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(state.volume).toFixed(1)} dB</span>
        <ClipLed id={`bus:${id}`} compact />
      </div>
      <div
        className={cn(ROW.name, "flex items-center justify-center border-b border-black/40")}
        style={{ background: tint(45), boxShadow: `inset 0 2px 0 0 ${color}` }}
      >
        <span className="truncate font-mono text-[9px] font-bold uppercase tracking-wider text-foreground">{id}</span>
      </div>
      <div className={cn(ROW.buttons, "flex items-start px-1 pt-1")}>
        <button
          onClick={() => onChange({ muted: !state.muted })}
          title={state.muted ? "Bus muted — click to unmute" : "Mute this bus"}
          className={cn(
            "h-8 w-full rounded-sm font-mono text-[10px] font-bold tracking-wider transition-colors",
            state.muted
              ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          {state.muted ? "MUTED" : "MUTE"}
        </button>
      </div>
    </div>
  );
}

function ControlStrip({ kind, name, state, onChange, memberCount }: {
  kind: "VCA" | "AUX";
  name: string;
  state: BusState;
  onChange: (patch: Partial<BusState>) => void;
  memberCount?: number;
}) {
  const advanced = useApp().mode === "advanced";
  const aux = kind === "AUX";
  return (
    <div className="flex w-[116px] shrink-0 flex-col border-r border-border bg-surface-2/70">
      <div className={cn(ROW.head, "flex items-center justify-center border-b border-border font-mono text-[9px] font-bold tracking-wider", aux ? "text-primary" : "text-accent-foreground")}>{kind}</div>
      {advanced && <div className={cn(ROW.scope, "border-b border-border/60")} />}
      <div className={cn(ROW.eq, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] text-muted-foreground")}>{aux ? "FX RETURN" : `${memberCount ?? 0} CHANNELS`}</div>
      <div className={cn(ROW.devices, "flex items-center border-b border-border/60 p-2")}>
        {aux ? <FxMenu target={`send:${name}`} label="Return FX" /> : <span className="w-full text-center font-mono text-[9px] text-muted-foreground">LEVEL CONTROL</span>}
      </div>
      {advanced && <div className={cn(ROW.sends, "border-b border-border/60")} />}
      {advanced && <div className={cn(ROW.sendBars, "border-b border-border/60")} />}
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] uppercase text-muted-foreground")}>{aux ? "Master" : "Assigned channels"}</div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div className={cn(ROW.fader, "flex justify-center border-b border-border/60 py-1")}>
        <Slider aria-label={`${kind} ${name} level`} orientation="vertical" className={cn("h-full w-8", FADER_CAP)} value={[state.volume]} min={0} max={1.2} step={0.01} onValueChange={([value = 0]) => onChange({ volume: value })} />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] text-muted-foreground")}>{toDb(state.volume).toFixed(1)} dB</div>
      <div className={cn(ROW.name, "flex items-center justify-center border-b border-border/60 px-2 text-center font-mono text-[10px] font-bold uppercase text-foreground")}>{aux ? name : `VCA ${name}`}</div>
      <div className={cn(ROW.buttons, "px-2 pt-1")}>
        <Button variant={state.muted ? "destructive" : "outline"} size="sm" className="h-8 w-full text-[10px]" onClick={() => onChange({ muted: !state.muted })} aria-label={`${state.muted ? "Unmute" : "Mute"} ${kind} ${name}`}>{state.muted ? "MUTED" : "MUTE"}</Button>
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
  const advanced = useApp().mode === "advanced";

  const master = buses["master"] as BusState;
  const clip = useClipped("master");
  const setClip = (on: boolean) => {
    if (!on) clearClip("master");
  };
  const color = BUS_COLOR["master"] as string;
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
      {advanced && (
        <div className={cn(ROW.scope, "border-b border-black/50 p-[3px]")}>
          <Scope scopeId="master" height={40} compact color={color} />
        </div>
      )}
      <MasterChain color={color} />
      <div className={cn(ROW.devices, "flex flex-col gap-1 border-b border-black/50 px-1.5 py-1")}>
        <div className="flex flex-1 items-center gap-1">
          <VuMeter level={peak} label="L" />
          <VuMeter level={peak} label="R" />
        </div>
        {!advanced && <FxMenu target="bus:master" label="Master FX" />}
      </div>
      {advanced && (
        <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
          <FxMenu target="bus:master" label="Master FX" />
        </div>
      )}
      {advanced && <div className={cn(ROW.sendBars, "border-b border-border/60")} />}

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
        <Meter id="master" level={peak} tall />
        <Meter id="master" level={peak} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center border-b border-border/60")}>
        <span className={cn("font-mono text-[9px]", peak > 0.98 ? "text-red-400" : "text-muted-foreground")}>
          {fracToDb(peak).toFixed(1)} dB
        </span>
      </div>
      <div
        className={cn(ROW.name, "flex items-center justify-center border-b border-border/60")}
        style={{ background: `color-mix(in oklab, ${color} 55%, transparent)`, boxShadow: `inset 0 2px 0 0 ${color}` }}
      >
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-foreground">Master</span>
      </div>
      <div className={cn(ROW.buttons, "flex items-start justify-center px-1 pt-1")}>
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
    </div>
  );
}

export function Mixer() {
  const { tracks, transport, selectedId, select, buses, setBus, vcas, setVca, auxReturns, setAuxReturn, updateTrack, addTrack } = useStudio();
  const levels = useMeters(tracks, transport);
  const [narrow, setNarrow] = useState(false);
  const [showBuses, setShowBuses] = useState(true);
  const [showVcas, setShowVcas] = useState(true);
  const [showAux, setShowAux] = useState(true);
  const [styleId, setStyleId] = useState<ConsoleStyleId>(() => {
    if (typeof window === "undefined") return "ssl";
    const saved = window.localStorage.getItem("synclab.mixer.style") as ConsoleStyleId | null;
    return CONSOLE_STYLES.some((s) => s.id === saved) ? (saved as ConsoleStyleId) : "ssl";
  });
  const [solid, setSolid] = useState<string>(() => {
    if (typeof window === "undefined") return "#1a1b1e";
    return window.localStorage.getItem("synclab.mixer.solid") ?? "#1a1b1e";
  });
  useEffect(() => {
    window.localStorage.setItem("synclab.mixer.solid", solid);
  }, [solid]);
  const desk = CONSOLE_STYLES.find((s) => s.id === styleId) ?? (CONSOLE_STYLES[0] as ConsoleStyle);
  useEffect(() => {
    window.localStorage.setItem("synclab.mixer.style", styleId);
  }, [styleId]);
  // The Solid Colour desk paints its single picked colour across the whole panel.
  const deskColors =
    desk.id === "solid" ? { a: solid, b: solid, c: solid } : { a: desk.a, b: desk.b, c: desk.c };
  const soloed = tracks.some((t) => t.solo);
  const muted = tracks.some((t) => t.muted);
  const busLevel = (id: BusId) => {
    const members = tracks.filter((t) => t.bus === id && !t.muted);
    const peak = Math.max(0, ...members.map((t) => levels.tracks[t.id] ?? 0));
    const out = buses[id].muted ? 0 : peak * Math.min(1, buses[id].volume);
    reportLevel(`bus:${id}`, out);
    return out;
  };
  // Only show bus strips that actually have channels routed to them.
  const activeBuses = BUS_STRIPS.filter((id) => tracks.some((t) => t.bus === id));
  return (
    <div
      className="mx-console flex flex-col overflow-hidden border border-border bg-surface shadow-panel"
      data-console={desk.id}
      style={
        {
          "--mx-a": deskColors.a,
          "--mx-b": deskColors.b,
          "--mx-c": deskColors.c,
          "--mx-accent": desk.accent,
        } as CSSProperties
      }
    >
      {/* console toolbar */}
      <div className="mx-console-toolbar flex min-h-10 items-center gap-3 border-b border-border px-3 py-2">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Mix Console</span>

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
                      background: s.id === "solid" ? solid : `linear-gradient(180deg, ${s.a}, ${s.b} 45%, ${s.c})`,
                      boxShadow: `inset 0 2px 0 0 ${s.accent}`,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-foreground">{s.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{s.desc}</span>
                  </span>
                </button>
              ))}
              {styleId === "solid" && (
                <div className="mt-1 border-t border-border px-2 pb-2 pt-2">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                    Solid colour
                  </div>
                  <div className="mt-1.5 grid grid-cols-8 gap-1">
                    {SOLID_PRESETS.map((p) => (
                      <button
                        key={p.hex}
                        title={p.name}
                        aria-label={`${p.name} solid colour`}
                        onClick={() => setSolid(p.hex)}
                        className={cn(
                          "h-6 w-full rounded-[3px] border transition-transform hover:scale-105",
                          solid.toLowerCase() === p.hex ? "border-primary ring-1 ring-primary" : "border-black/60"
                        )}
                        style={{ background: p.hex }}
                      />
                    ))}
                  </div>
                  <label className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Custom</span>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(solid) ? solid : "#1a1b1e"}
                      onChange={(e) => setSolid(e.target.value)}
                      title="Pick any solid colour"
                      aria-label="Custom mixer colour"
                      className="h-7 w-full cursor-pointer rounded-[3px] border border-border bg-surface p-0.5"
                    />
                  </label>
                </div>
              )}
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
          <Button variant={showVcas ? "secondary" : "ghost"} size="sm" className="h-7 text-[10px]" onClick={() => setShowVcas((v) => !v)} aria-pressed={showVcas}>VCA</Button>
          <Button variant={showAux ? "secondary" : "ghost"} size="sm" className="h-7 text-[10px]" onClick={() => setShowAux((v) => !v)} aria-pressed={showAux}>Aux</Button>
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
        <div className="mobile-mixer-strips flex overflow-x-auto">
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
          {showVcas && VCA_IDS.map((id) => (
            <ControlStrip key={`vca-${id}`} kind="VCA" name={id} state={vcas[id]} memberCount={tracks.filter((t) => t.vca === id).length} onChange={(patch) => setVca(id, patch)} />
          ))}
          {showAux && AUX_IDS.map((id) => (
            <ControlStrip key={`aux-${id}`} kind="AUX" name={id} state={auxReturns[id]} onChange={(patch) => setAuxReturn(id, patch)} />
          ))}
          <div className="sticky right-0 z-10 bg-surface shadow-[-12px_0_18px_-12px_rgba(0,0,0,0.8)]">
            <MasterStrip level={levels.master} />
          </div>
        </div>
      )}
    </div>
  );
}
