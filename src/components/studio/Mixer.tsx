import { levelColor, peakOf, spectrumColor, dbColor, LEVEL_GREEN, LEVEL_ORANGE, LEVEL_RED } from "@/lib/synclab/level-colors";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
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
  Speaker,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";

import { MidiLearnBlock, MidiLearnButton, MidiLearnStrip } from "./MidiLearn";
import { TrackNotes } from "@/components/studio/TrackNotes";
import { QuickNotes } from "@/components/studio/QuickNotes";
import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import { BUILT_IN_PLUGINS, instantiate } from "@/lib/synclab/plugins";
import type { AuxId, BusId, BusState, PluginInstance, Track, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, reportLevel, useClipped } from "@/lib/synclab/clip-monitor";
import { Scope } from "./Scope";
import { XYPad } from "./XYPad";
import { EffectDisplay } from "./EffectDisplay";
import { ProEq } from "./ProEq";
import { VocoderPanel } from "./VocoderPanel";
import { useIsMobile } from "@/hooks/use-mobile";

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

/** Real post-fader signal readings; one shared 20 fps refresh for every strip. */
function useMeters(tracks: Track[]) {
  const [levels, setLevels] = useState<{ tracks: Record<string, number>; buses: Record<string, number>; vcas: Record<string, number>; aux: Record<string, number>; master: number }>({
    tracks: {},
    buses: {}, vcas: {}, aux: {},
    master: 0,
  });
  const smooth = useRef<Record<string, number>>({});
  const idsKey = tracks.map((track) => track.id).join(",");
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  useEffect(() => {
    let timer = 0;
    const loop = () => {
      const engine = getEngine();
      const tracks: Record<string, number> = {};
      const buses: Record<string, number> = {};
      const vcas: Record<string, number> = {};
      const aux: Record<string, number> = {};
      const read = (id: string, raw: number) => {
        reportLevel(id, raw);
        const prev = smooth.current[id] ?? 0;
        const value = raw > prev ? raw : prev * 0.86;
        smooth.current[id] = value;
        return dbToFrac(toDb(Math.max(value, 0.0005)));
      };
      for (const track of tracksRef.current) {
        const id = track.id;
        tracks[id] = read(id, engine.getTrackLevel(id));
      }
      for (const id of BUS_STRIPS) buses[id] = read(`bus:${id}`, engine.getBusLevel(id));
      for (const id of VCA_IDS) vcas[id] = read(`vca:${id}`, engine.getVcaLevel(id));
      for (const id of AUX_IDS) aux[id] = read(`aux:${id}`, engine.getAuxLevel(id));
      setLevels({ tracks, buses, vcas, aux, master: read("master", engine.getLevel()) });
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
  // dB scale: level is a 0..1 linear fraction, so dB = 20·log10(level); show -60..0 dB.
  const DB_TICKS = [0, -6, -12, -24, -36, -48, -60];
  return (
    <div className={cn("flex items-stretch gap-0.5", tall ? "h-full min-h-0" : "h-44")}>
      <div className="relative w-5 shrink-0" aria-hidden>
        {DB_TICKS.map((db) => (
          <div key={db} className="absolute right-0 flex items-center gap-px" style={{ top: `calc(${(db / -60) * 100}% - ${(db / -60) * 7}px)` }}>
            <span className="font-mono text-[6px] leading-none text-muted-foreground/80">{db}</span>
            <span className="inline-block h-px w-1 bg-muted-foreground/60" />
          </div>
        ))}
      </div>
      <div className="flex w-4 flex-col-reverse gap-px rounded-[3px] border border-black/60 bg-black/60 p-[3px] shadow-inner">
      {Array.from({ length: segs }, (_, i) => {
        const on = i < lit;
        const isHold = i === holdSeg;
        // Printed hot zone like a hardware LED ladder: the top segments are
        // physically amber/red even when unlit, so the clipping area reads as
        // a marked danger region instead of a flat recolour.
        const segDb = -60 + ((i + 1) / segs) * 60;
        const zone = segDb >= -1 ? "red" : segDb >= -6 ? "amber" : "green";
        const unlitZone =
          zone === "red" ? "oklch(0.32 0.09 27 / 0.55)" : zone === "amber" ? "oklch(0.38 0.08 55 / 0.35)" : undefined;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[1px] transition-colors duration-75",
              !on && !isHold && !unlitZone && "bg-surface-2/70",
              isHold && !on && "opacity-70"
            )}
            style={
              on || isHold
                ? { background: clipped && i >= segs - 2 ? LEVEL_RED : dbColor(segDb) }
                : unlitZone
                  ? { background: unlitZone }
                  : undefined
            }
          />
        );
      })}
      </div>
    </div>
  );
}

/** Pre-fader GAIN trim at the top of every channel strip — real input gain into the channel. */
function ChannelGain({ t, narrow }: { t: Track; narrow?: boolean }) {
  const { updateTrack } = useStudio();
  const gain = t.gain ?? 1;
  return (
    <div
      className="mx-header-gain flex shrink-0 items-center justify-center"
      onClick={(e) => e.stopPropagation()}
      title={`Input trim ${gain.toFixed(2)}× — before the fader and effects`}
    >
      <Knob
        label={`${t.name} gain`}
        value={gain}
        min={0}
        max={2}
        step={0.01}
        unit="×"
        size={narrow ? 26 : 30}
        onChange={(v) => updateTrack(t.id, { gain: v })}
        midiTarget={{ id: t.id, param: "gain" }}
      />
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

export function InsertRack({
  title,
  midiId,
  midiPrefix = "plugin",
  list,
  onAdd,
  onRemove,
  onBypass,
  onParam,
  openId,
  onOpenChange,
}: {
  title: string;
  midiId: string;
  midiPrefix?: "plugin" | "fx";
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
  // ProEq/VocoderPanel write through the store by track id; bus/master chains use onParam instead.
  const isTrack = !midiId.includes(":") && midiId !== "master";
  return (
    <div>
      <div className="label-xs mb-1">{title}</div>
      <div className="space-y-1">
        {list.length === 0 && <div className="font-mono text-[9px] text-muted-foreground">No effects</div>}
        {list.map((p) => (
          <div key={p.id} className="rounded-md border border-border bg-surface-2/50 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <button aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name}`} aria-pressed={p.bypass} onClick={() => onBypass(p.id)} title="Bypass" className="p-0.5">
                <Power className={cn("size-4", p.bypass ? "text-muted-foreground" : "text-primary")} />
              </button>
              <button className="flex-1 truncate text-left font-mono text-[11px] uppercase" onClick={() => setOpen(open === p.id ? null : p.id)}>
                {p.name}
                <span className="ml-1 text-muted-foreground">{p.format}</span>
              </button>
              <button aria-label={`Remove ${p.name}`} onClick={() => onRemove(p.id)} title="Remove" className="p-0.5">
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
            <Dialog open={open === p.id} onOpenChange={(o) => setOpen(o ? p.id : null)}>
              <DialogContent data-fx-skin={p.kind} data-fx-variant={p.name.toLowerCase().includes("echo") ? "echo" : undefined} className="fx-editor max-h-[86vh] w-[min(97vw,58rem)] max-w-none overflow-y-auto">
                <DialogHeader className="fx-editor-header">
                  <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <button type="button" onClick={() => onBypass(p.id)} title={p.bypass ? "Turn on" : "Bypass"} aria-label="Bypass effect">
                      <Power className={cn("size-4", p.bypass ? "text-muted-foreground" : "text-primary")} />
                    </button>
                    {p.name} <span className="text-xs text-muted-foreground">{title} · {p.format}</span>
                  </DialogTitle>
                </DialogHeader>
                {p.kind === "paraeq" && isTrack ? (
                  <ProEq trackId={midiId} plugin={p} />
                ) : p.kind === "vocoder" && isTrack ? (
                  <VocoderPanel trackId={midiId} plugin={p} />
                ) : (
                <div className="fx-editor-deck grid gap-3 md:grid-cols-[1.4fr_1fr]">
                  <div className="fx-display-deck space-y-2">
                    <EffectDisplay plugin={p} height={220} onParam={(paramId, v) => onParam(p.id, paramId, v)} />
                    <Scope scopeId={p.id} height={96} />
                   </div>
                  <div className="fx-control-deck space-y-2">
                    <XYPad plugin={p} onParam={(paramId, v) => onParam(p.id, paramId, v)} />
                    <div className="fx-knob-bank grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] justify-items-center gap-2">
                      {p.params.map((x) => (
                        <Knob
                          key={x.id}
                          label={x.name}
                          value={x.value}
                          min={x.min}
                          max={x.max}
                          step={(x.max - x.min) / 200}
                          size={56}
                          onChange={(v) => onParam(p.id, x.id, v)}
                          midiTarget={{ id: midiId, param: `${midiPrefix}:${p.id}:${x.id}` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {installedPlugins.map((d) => (
          <button
            key={d.id}
            onClick={() => onAdd(d)}
            className="truncate rounded-md border border-border bg-surface px-2 py-1.5 text-left font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
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
                <Knob
                  label={label}
                  value={value}
                  size={36}
                  onChange={(v) =>
                    updateTrack(t.id, {
                      sends: { reverb: 0, delay: 0, chorus: 0, ...(t.sends ?? {}), [key]: v },
                    })
                  }
                />
                
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
  head: "mx-row-head h-7",
  gain: "mx-row-gain h-[52px]",
  scope: "mx-row-scope h-[48px]",
  eq: "mx-row-eq h-[74px]",
  devices: "mx-row-inserts h-[92px]",
  sends: "mx-row-sends h-7",
  sendBars: "mx-row-send-bars h-[26px]",
  io: "mx-row-routing h-[52px]",
  pan: "mx-row-pan h-[38px]",
  fader: "mx-row-fader h-[300px]",
  readout: "mx-row-readout h-5",
  buttons: "mx-row-buttons h-[68px]",
  name: "mx-row-name h-12",
  icon: "mx-row-icon h-9",
} as const;

/** Console desk finishes the user can pick between. */
export type ConsoleStyleId = "studiopro" | "ssl" | "neve" | "api" | "live" | "vintage" | "neon" | "solid";
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
    id: "studiopro",
    name: "Studio Pro",
    desc: "Flat grey desk with track-colored channels",
    a: "var(--mixer-desk)",
    b: "var(--mixer-desk)",
    c: "var(--mixer-desk)",
    accent: "oklch(0.768 0.146 68)",
    screws: false,
  },
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

/** Dark ink for anything sitting on the desk accent (accents are always light). */
function accentInk(accent: string) {
  const m = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.-]+)\)/.exec(accent);
  if (!m) return "#1a1b1e";
  return `oklch(0.24 ${Math.min(0.05, Number(m[2]) * 0.3)} ${m[3]})`;
}

/** Panel background, driven by the picked desk (vars set on the console root). */
const PANEL =
  "linear-gradient(180deg, var(--mx-a, oklch(0.36 0.008 260)), var(--mx-b, oklch(0.30 0.008 260)) 45%, var(--mx-c, oklch(0.22 0.008 260)))";

/** Console screw head. */
function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mx-screw pointer-events-none inline-block size-[7px] shrink-0 rounded-full border border-black/70 [display:var(--mx-screw-display,inline-block)]",
        "bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.55),rgba(0,0,0,0.65))]",
        className
      )}
    />
  );
}



/** Chunky console fader thumb overrides for the shadcn slider (cap face + centre line live in styles.css). */
const FADER_CAP =
  "mx-fader [&_[role=slider]]:h-6 [&_[role=slider]]:w-9 [&_[role=slider]]:rounded-[3px]";

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
  const { tracks, selectedId, select, setPanel } = useStudio();
  return <aside className="mx-channel-list sticky left-0 z-10 flex shrink-0 flex-col border-r border-border" aria-label="Mixer channel list">
    <div className="border-b border-border px-2 py-2 text-[10px] font-semibold">Channels</div>
    {tracks.map((track, index) => <Button key={track.id} variant="ghost" aria-pressed={track.id === selectedId} className="mx-channel-list-item h-7 w-full min-w-0 justify-start gap-2 rounded-none px-2 text-[10px]" onClick={() => { select(track.id); setPanel("mixer"); }} title={track.name}>
      <span className="w-4 shrink-0 font-mono text-muted-foreground">{index + 1}</span>
      <span className="mx-channel-swatch" style={{ "--mixer-channel-color": track.color } as CSSProperties} />
      <span className="truncate">{track.name}</span>
    </Button>)}
  </aside>;
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
    <div className={cn(ROW.devices, "w-full space-y-0.5 overflow-hidden border-b border-border/60 px-1 py-1")}><div className="mx-inserts-label font-mono text-[8px] text-muted-foreground">Inserts</div>
      {list.slice(0, max).map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-sm px-1 py-[3px]"
          style={{ background: `color-mix(in oklab, ${t.color} 18%, var(--surface-2, transparent))` }}
        >
          <button aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name} on ${t.name}`} aria-pressed={p.bypass} onClick={(e) => { e.stopPropagation(); togglePluginBypass(t.id, p.id); }} title="Bypass">
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
            aria-label={`Remove ${p.name} from ${t.name}`} onClick={(e) => { e.stopPropagation(); removePlugin(t.id, p.id); }}
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
        <PopoverContent onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }} align="start" className="max-h-[70vh] w-[360px] overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
          <InsertRack
            title={`${t.name} — inserts`}
            midiId={t.id}
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

/** Instrument drawing shown on a channel's name plate. */
function KindIcon({ t, className }: { t: Track; className?: string }) {
  return <TrackIcon track={t} className={className} tinted={false} />;
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
  const { updateTrack, setPluginParam, installedPlugins } = useStudio();
  const pendingEq = useRef<PluginInstance | null>(null);
  const eq = (t.plugins ?? []).find((p) => p.kind === "eq") ?? pendingEq.current;
  useEffect(() => { pendingEq.current = null; }, [t.plugins]);
  const bands = [["high", "High"], ["mid", "Mid"], ["low", "Low"]] as const;
  const setBand = (id: string, value: number) => {
    const current = eq ?? pendingEq.current;
    if (current) {
      setPluginParam(t.id, current.id, id, value);
      return;
    }
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (!def) return;
    const instance = instantiate(def);
    instance.params = instance.params.map((param) => param.id === id ? { ...param, value } : param);
    pendingEq.current = instance;
    updateTrack(t.id, { plugins: [...(t.plugins ?? []), instance] });
  };
  return (
    <div
      className={cn(ROW.eq, "mx-channel-eq flex flex-col gap-1 border-b border-border/60 px-1.5 py-1")}
      style={{ "--primary": t.color } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-eq-knobs grid w-full grid-cols-3 gap-1">
        {bands.map(([id, label]) => <Knob key={id} label={label} value={eq?.params.find((param) => param.id === id)?.value ?? 0} min={-18} max={18} step={0.5} unit=" dB" size={32} onChange={(value) => setBand(id, value)} />)}
      </div>
      <div className="mx-eq-curve h-10 w-full shrink-0">
        <EqCurve
          scopeId={`ch:${t.id}`}
          bands={["low", "mid", "high"].map((id) => eq?.params.find((p) => p.id === id)?.value ?? 0) as [number, number, number]}
          color={t.color}
          bypass={!!eq?.bypass}
          onBand={(i, value) => { const id = ["low", "mid", "high"][i]; if (id) setBand(id, value); }}
        />
      </div>
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
          node.setAttribute("stroke", getComputedStyle(node).getPropertyValue("--display-wave").trim());
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
    dragRef.current = { band, startY: canvasPoint(e.clientX, e.clientY).y, startGain: (bandGain[band] ?? 0) };
    setActiveBand(band);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const pxPerDb = (canvasRect(svgRef.current).height - PAD * 2 * 2) / 36;
    const fine = e.shiftKey ? 0.2 : 1;
    const next = Math.max(-18, Math.min(18, d.startGain - ((canvasPoint(e.clientX, e.clientY).y - d.startY) / Math.max(2, pxPerDb)) * fine));
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
        className={cn("w-full flex-1 rounded-sm border border-border/60 signal-screen", bypass && "opacity-40")}
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
            cy={xOf((bandGain[i] ?? 0))}
            r={activeBand === i ? 3.4 : 2.6}
            fill="var(--display-point)"
            stroke="var(--display-black)"
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
        <Button variant="ghost" size="icon"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${t.name} channel menu`} title="Channel menu"
          className="channel-menu-trigger size-6 shrink-0 text-foreground hover:bg-accent"
        >
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="mx-channel-menu w-56 space-y-2 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Channel</div>
        <input
          aria-label={`${t.name} channel name`} value={t.name}
          onChange={(e) => updateTrack(t.id, { name: e.target.value })}
          className="h-7 w-full rounded-sm border border-border bg-surface-2 px-2 font-mono text-[10px] uppercase"
        />
        <div className="label-xs pt-1">Add effect</div>
        <div className="grid grid-cols-3 gap-1">
          {quick.map(([kind, label]) => (
            <button
              key={kind}
              onClick={() => add(kind)}
              className="h-6 rounded-sm border border-border bg-secondary px-1 font-mono text-[9px] uppercase text-secondary-foreground hover:bg-accent"
            >
              {label}
            </button>
          ))}
        </div>
        <MidiLearnBlock id={t.id} />
        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={() => updateTrack(t.id, { volume: 0.8, pan: 0, muted: false, solo: false })}
            className="h-6 rounded-sm border border-border bg-secondary font-mono text-[9px] uppercase text-secondary-foreground hover:bg-accent"
          >
            Reset
          </button>
          <button
            onClick={() => duplicateTrack(t.id)}
            className="h-6 rounded-sm border border-border bg-secondary font-mono text-[9px] uppercase text-secondary-foreground hover:bg-accent"
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
  const { updateTrack, moveTrack, tracks, transport, setTransport, vcas } = useStudio();
  const vcaState = t.vca ? vcas[t.vca] : undefined;
  const vcaGain = vcaState ? (vcaState.muted ? 0 : vcaState.volume) : 1;
  const effective = Math.min(1, t.volume * vcaGain);
  const advanced = useApp().mode === "advanced";

  const [clip, setClip] = useState(false);
  useEffect(() => {
    if (level > 0.985) setClip(true);
  }, [level]);

  const tint = (pct: number) => `color-mix(in oklab, ${t.color} ${pct}%, transparent)`;
  return (
    <div
      role="group" onClick={(e) => { if (e.currentTarget.contains(e.target as Node)) onSelect(); }}
      className={cn(
        "mx-channel flex shrink-0 cursor-pointer flex-col border-r border-border transition-colors",
        narrow ? "w-[92px]" : "w-[132px]"
      )}
      data-selected={selected}
      aria-label={`${t.name} mixer channel`}
      style={{
        "--mixer-channel-color": t.color,
        background: selected
          ? `linear-gradient(${tint(16)}, ${tint(16)}), ${PANEL}`
          : `linear-gradient(${tint(8)}, ${tint(8)}), ${PANEL}`,
        boxShadow: `inset 4px 0 0 0 ${t.color}, inset 0 1px 0 0 rgba(255,255,255,0.08)${selected ? `, inset 0 0 0 1px ${tint(45)}` : ""}`,
      } as CSSProperties}
    >
      {/* channel name plate — sits above the controls and never floats over the level meter */}
      <div
        className={cn(ROW.name, "flex items-center gap-1.5 border-b border-black/40 px-1.5")}
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${t.color} 70%, transparent), color-mix(in oklab, ${t.color} 40%, transparent))`,
          boxShadow: `inset 0 2px 0 0 ${t.color}`,
        }}
        title={t.name}
      >
        <KindIcon t={t} className="size-4 shrink-0" />
        <Button
          variant="ghost"
          aria-label={`Select ${t.name} mixer channel`}
          aria-pressed={selected}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="mx-name-btn h-full min-w-0 flex-1 truncate rounded-none p-0 text-left font-mono text-[12px] font-bold uppercase tracking-wide text-foreground"
        >
          {t.name}
        </Button>
        <button
          onClick={(e) => { e.stopPropagation(); setClip(false); }}
          title="Clip indicator — click to reset"
          aria-label={`Clip indicator for ${t.name} — click to reset`}
          className={cn(
            "size-2.5 shrink-0 rounded-full border border-black/60 transition-shadow",
            clip ? "bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.8)]" : "bg-black/50"
          )}
        />
      </div>

      {/* channel header: number, colour, notes, menu, ordering */}
      <div
        className={cn(ROW.head, "flex items-center gap-1.5 border-b border-black/50 px-1.5")}
        style={{ background: tint(18) }}
      >
        <span className="font-mono text-[11px] font-bold text-foreground">{index + 1}</span>
        <ColorDot t={t} />
        <TrackNotes track={t} />
        <ChannelMenu t={t} />
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, -1); }}
          disabled={index === 0}
          title="Move channel left"
          aria-label="Move channel left"
          className="flex h-5 w-4 items-center justify-center rounded-[2px] text-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, 1); }}
          disabled={index >= tracks.length - 1}
          title="Move channel right"
          aria-label="Move channel right"
          className="flex h-5 w-4 items-center justify-center rounded-[2px] text-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <ChannelGain t={t} narrow={narrow} />
      </div>

      <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")}>
          <Scope scopeId={`ch:${t.id}`} height={40} compact color={t.color} />
        </div>

      <ChannelEq t={t} />

      <DeviceSlots t={t} narrow={narrow} />

      {/* sends */}
      <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
        <SendsMenu t={t} />
      </div>

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
          <SelectTrigger aria-label={`${t.name} output bus`}
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
        onClick={(e) => e.stopPropagation()}
      >
        <Slider
          aria-label={`${t.name} pan`}
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
          aria-label={`${t.name} volume`} aria-valuetext={t.volume === 0 ? "Silent" : `${toDb(t.volume).toFixed(1)} decibels`}
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[t.volume]}
          min={0}
          max={1}
          step={0.01}
          onDoubleClick={() => updateTrack(t.id, { volume: 0.8 })}
          onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
        />
        {vcaState && (
          <div className="relative w-2 shrink-0 rounded-sm bg-surface-2" title={`After VCA ${t.vca}: ${toDb(effective).toFixed(1)} dB`} aria-label={`Level after VCA ${t.vca}`}>
            <div className="absolute inset-x-0 bottom-0 rounded-sm bg-primary/70 transition-[height] duration-75" style={{ height: `${effective * 100}%` }} />
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[7px] text-primary">{t.vca}</span>
          </div>
        )}
        <Meter id={t.id} level={level} tall />
      </div>

      {/* fader dB + live peak dB */}
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className={cn("font-mono text-[9px]", vcaState ? "text-primary" : "text-muted-foreground")} title={vcaState ? `Fader ${toDb(t.volume).toFixed(1)} dB, after VCA ${t.vca}` : undefined}>{toDb(effective).toFixed(1)}</span>
        <span className={cn("font-mono text-[9px]", level > 0.98 ? "text-red-400" : "text-foreground/70")}>
          {fracToDb(level).toFixed(0)}
        </span>
        <ClipLed id={t.id} compact />
      </div>

      {/* M / S / REC / MON — Studio Pro style letter buttons at the bottom (2x2 so they stay big and tappable) */}
      <div className={cn(ROW.buttons, "grid grid-cols-2 gap-1 px-1")}>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { muted: !t.muted }); }}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            t.muted
              ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.muted ? "Muted — click to unmute" : "Mute this channel"}
          aria-label={`Mute ${t.name}`}
          aria-pressed={t.muted}
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            t.solo
              ? "bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.solo ? "Soloed — click to unsolo" : "Solo this channel"}
          aria-label={`Solo ${t.name}`}
          aria-pressed={t.solo}
        >
          S
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { armed: !t.armed }); }}
          title={t.armed ? "Armed for recording" : "Arm this channel for recording"}
          aria-label={`Record arm ${t.name}`}
          aria-pressed={t.armed}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-[3px] transition-colors",
            t.armed ? "bg-red-500/20" : "bg-black/30 hover:bg-black/50"
          )}
        >
          <span className={cn("size-4 rounded-full border", t.armed ? "border-red-300 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" : "border-red-500/60 bg-red-500/20")} />
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
          aria-label={`Monitor ${t.name} input`}
          aria-pressed={t.armed && transport.monitor}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors disabled:opacity-40",
            t.armed && transport.monitor
              ? "bg-sky-400 text-black"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          ⌁
        </button>
      </div>

      {/* channel icon — centred at the foot of the strip, in its own row so nothing overlaps */}
      <div
        className={cn(ROW.icon, "flex shrink-0 items-center justify-center border-t border-border/60")}
        title={t.name}
        aria-hidden
      >
        <TrackIcon track={t} className="size-5" />
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
      className="mx-routing-strip flex w-[116px] shrink-0 flex-col border-r border-black/50"
      style={{ background: `linear-gradient(${tint(8)}, ${tint(8)}), ${PANEL}`, boxShadow: `inset 4px 0 0 0 ${color}, inset 0 1px 0 0 rgba(255,255,255,0.08)` }}
    >
      <div className={cn(ROW.name, "flex items-center justify-center border-b border-black/50 px-1.5 font-mono text-[11px] uppercase tracking-widest")} style={{ background: tint(16) }}><span>{id} BUS</span></div>
      <div className={cn(ROW.head, "flex items-center justify-between border-b border-black/50 px-1.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")} style={{ background: tint(16) }}>
        <Screw />
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        <div className="mx-header-gain"><Knob label={`${id} bus gain`} value={state.volume} min={0} max={1.2} step={0.01} size={30} onChange={(volume) => onChange({ volume })} midiTarget={{ id: `bus:${id}`, param: "volume" }} /></div>
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
          aria-label={`${id} bus volume`}
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[state.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onValueChange={([v = 0]) => onChange({ volume: v })}
        />
        <MidiLearnButton id={`bus:${id}`} param="volume" label={`${id} bus level`} />
        <Meter id={`bus:${id}`} level={level} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-center gap-1 border-b border-border/60")}>
        <span className="font-mono text-[9px] text-muted-foreground">{toDb(state.volume).toFixed(1)} dB</span>
        <ClipLed id={`bus:${id}`} compact />
      </div>
       <div className={cn(ROW.buttons, "flex items-start px-1 pt-1")}>
         <MidiLearnButton id={`bus:${id}`} param="mute" label={`${id} bus mute`} />
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
      <div className={cn(ROW.icon, "flex items-center justify-center border-t border-border/60")} title={`${id} bus`} aria-hidden><Waves className="size-5" /></div>
    </div>
  );
}

/** Picks which tracks a VCA fader scales; a VCA with no members has nothing to control. */
function VcaAssign({ id, memberCount }: { id: VcaId; memberCount: number }) {
  const { tracks, updateTrack } = useStudio();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={memberCount ? "outline" : "secondary"} size="sm" className="h-7 w-full font-mono text-[9px]" aria-label={`Assign tracks to VCA ${id}`}>
          {memberCount ? `${memberCount} TRACK${memberCount > 1 ? "S" : ""}` : "ASSIGN TRACKS"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <div className="mb-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">VCA {id} controls</div>
        {tracks.length === 0 && <div className="text-xs text-muted-foreground">No tracks yet.</div>}
        {tracks.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
            <input type="checkbox" checked={t.vca === id} onChange={(e) => updateTrack(t.id, { vca: e.target.checked ? id : undefined })} aria-label={`${t.name} on VCA ${id}`} />
            <span className="truncate">{t.name}</span>
            {t.vca && t.vca !== id && <span className="ml-auto font-mono text-[9px] text-muted-foreground">VCA {t.vca}</span>}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ControlStrip({ kind, name, state, onChange, memberCount, level }: {
  kind: "VCA" | "AUX";
  name: string;
  state: BusState;
  onChange: (patch: Partial<BusState>) => void;
  memberCount?: number;
  level: number;
}) {
  const advanced = useApp().mode === "advanced";
  const aux = kind === "AUX";
  return (
    <div className="mx-routing-strip flex w-[116px] shrink-0 flex-col border-r border-border bg-surface-2/70">
      <div className={cn(ROW.name, "flex items-center justify-center border-b border-border font-mono text-[11px] font-bold tracking-wider", aux ? "text-primary" : "text-accent-foreground")}>{kind} {name}</div>
      <div className={cn(ROW.head, "flex items-center justify-end gap-1.5 border-b border-border px-1.5")}><ChevronRight className="size-3.5 shrink-0" aria-hidden /><div className="mx-header-gain"><Knob label={`${kind} ${name} gain`} value={state.volume} min={0} max={1.2} step={0.01} size={30} onChange={(volume) => onChange({ volume })} midiTarget={{ id: `${aux ? "aux" : "vca"}:${name}`, param: "volume" }} /></div></div>
       <div className={cn(ROW.eq, "flex items-center justify-center gap-1 border-b border-border/60")}><MidiLearnButton id={`${aux ? "aux" : "vca"}:${name}`} param="volume" label={`${kind} ${name} level`} /><MidiLearnButton id={`${aux ? "aux" : "vca"}:${name}`} param="mute" label={`${kind} ${name} mute`} /></div>
      {advanced && <div className={cn(ROW.scope, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] text-muted-foreground")}>{aux ? "FX RETURN" : `${memberCount ?? 0} CHANNELS`}</div>}
      <div className={cn(ROW.devices, "flex items-center border-b border-border/60 p-2")}>
        {aux ? <FxMenu target={`send:${name}`} label="Return FX" /> : <VcaAssign id={name as VcaId} memberCount={memberCount ?? 0} />}
      </div>
      {advanced && <div className={cn(ROW.sends, "border-b border-border/60")} />}
      {advanced && <div className={cn(ROW.sendBars, "border-b border-border/60")} />}
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] uppercase text-muted-foreground")}>{aux ? "Master" : "Assigned channels"}</div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div className={cn(ROW.fader, "flex items-stretch justify-center gap-2 border-b border-border/60 py-1")}>
        <Slider aria-label={`${kind} ${name} level`} orientation="vertical" className={cn("h-full w-8", FADER_CAP)} value={[state.volume]} min={0} max={1.2} step={0.01} onValueChange={([value = 0]) => onChange({ volume: value })} />
        <Meter id={`${aux ? "aux" : "vca"}:${name}`} level={level} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-between gap-1 border-b border-border/60 px-1 font-mono text-[9px] text-muted-foreground")}><span>{toDb(state.volume).toFixed(1)}</span><span>{fracToDb(level).toFixed(0)}</span><ClipLed id={`${aux ? "aux" : "vca"}:${name}`} compact /></div>
      <div className={cn(ROW.buttons, "px-2 pt-1")}>
        <Button variant={state.muted ? "destructive" : "outline"} size="sm" className="h-8 w-full text-[10px]" onClick={() => onChange({ muted: !state.muted })} aria-label={`${state.muted ? "Unmute" : "Mute"} ${kind} ${name}`}>{state.muted ? "MUTED" : "MUTE"}</Button>
      </div>
      <div className={cn(ROW.icon, "flex items-center justify-center border-t border-border/60")} title={`${kind} ${name}`} aria-hidden>{aux ? <Waves className="size-5" /> : <Sliders className="size-5" />}</div>
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
            "flex h-7 w-full items-center justify-center gap-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider transition-colors",
            list.length > 0 ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 className="size-3.5" /> {label}
          {list.length > 0 ? ` ${list.length}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }} align="start" className="w-80 p-3">
        <InsertRack
          title={`${target.split(":")[1]?.toUpperCase()} effects`}
            midiId={target}
            midiPrefix="fx"
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
function MasterChain({ color, className }: { color: string; className?: string }) {
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
    <div className={cn(className ?? ROW.eq, "space-y-0.5 overflow-y-auto border-b border-border/60 px-1 py-1")}>
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
          <button aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name} on master`} aria-pressed={p.bypass} onClick={() => toggleFxBypass("bus:master", p.id)} title="Bypass">
            <Power className="size-2.5" style={{ color: p.bypass ? "var(--muted-foreground)" : color }} />
          </button>
          <span className="flex-1 truncate font-mono text-[8px] uppercase">{p.name}</span>
          <button
            aria-label={`Remove ${p.name} from master`} onClick={() => removeFxPlugin("bus:master", p.id)}
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

/** Master 3-band EQ — the same controls and markings every channel strip carries. */
function MasterEq({ color }: { color: string }) {
  const { fxChains, addFxPlugin, setFxParam, installedPlugins } = useStudio();
  const eq = (fxChains["bus:master"] ?? []).find((p) => p.kind === "eq");
  const pending = useRef<[string, number] | null>(null);
  // The store builds the instance, so the first knob move lands as soon as it exists.
  useEffect(() => {
    const wanted = pending.current;
    if (!eq || !wanted) return;
    pending.current = null;
    setFxParam("bus:master", eq.id, wanted[0], wanted[1]);
  }, [eq, setFxParam]);
  const setBand = (id: string, value: number) => {
    if (eq) {
      setFxParam("bus:master", eq.id, id, value);
      return;
    }
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (!def) return;
    pending.current = [id, value];
    addFxPlugin("bus:master", def);
  };
  const bands = [["high", "High"], ["mid", "Mid"], ["low", "Low"]] as const;
  return (
    <div
      className={cn(ROW.eq, "mx-channel-eq mx-master-eq flex flex-col gap-1 border-b border-border/60 px-1.5 py-1")}
      style={{ "--primary": color } as CSSProperties}
    >
      <div className="mx-eq-knobs grid w-full grid-cols-3 gap-1">
        {bands.map(([id, label]) => (
          <Knob
            key={id}
            label={label}
            value={eq?.params.find((param) => param.id === id)?.value ?? 0}
            min={-18}
            max={18}
            step={0.5}
            unit=" dB"
            size={32}
            onChange={(value) => setBand(id, value)}
          />
        ))}
      </div>
      <div className="mx-eq-curve h-10 w-full shrink-0">
        <EqCurve
          scopeId="master"
          bands={["low", "mid", "high"].map((id) => eq?.params.find((param) => param.id === id)?.value ?? 0) as [number, number, number]}
          color={color}
          bypass={!!eq?.bypass}
          onBand={(i, value) => {
            const id = ["low", "mid", "high"][i];
            if (id) setBand(id, value);
          }}
        />
      </div>
    </div>
  );
}

/** Master stereo width — the row every channel uses for its pan control. */
function MasterWidth({ color }: { color: string }) {
  const { fxChains, addFxPlugin, setFxParam, installedPlugins } = useStudio();
  const width = (fxChains["bus:master"] ?? []).find((p) => p.kind === "width");
  const pending = useRef<number | null>(null);
  // The store builds the instance, so the first slider move lands as soon as it exists.
  useEffect(() => {
    const wanted = pending.current;
    if (!width || wanted === null) return;
    pending.current = null;
    setFxParam("bus:master", width.id, "width", wanted);
  }, [width, setFxParam]);
  const setWidth = (value: number) => {
    if (width) {
      setFxParam("bus:master", width.id, "width", value);
      return;
    }
    const def = installedPlugins.find((d) => d.kind === "width") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "width");
    if (!def) return;
    pending.current = value;
    addFxPlugin("bus:master", def);
  };
  const v = width?.params.find((p) => p.id === "width")?.value ?? 1;
  return (
    <div className={cn(ROW.pan, "flex flex-col justify-center border-b border-border/60 px-1.5")} style={{ "--primary": color } as CSSProperties}>
      <Slider
        aria-label="Master stereo width"
        aria-valuetext={v === 0 ? "Mono" : `${Math.round(v * 100)} percent`}
        value={[v]}
        min={0}
        max={2}
        step={0.01}
        className="h-3"
        onDoubleClick={() => setWidth(1)}
        onValueChange={([n = 1]) => setWidth(n)}
      />
      <button
        onClick={() => setWidth(1)}
        title="Reset the main output to its original stereo width"
        className="mt-0.5 text-center font-mono text-[8px] text-muted-foreground hover:text-foreground"
      >
        {v === 0 ? "MONO" : `${Math.round(v * 100)}%`}
      </button>
    </div>
  );
}

function MasterStrip({ level: peak }: { level: number }) {
  const { buses, setBus } = useStudio();
  const master = buses["master"] as BusState;
  const clip = useClipped("master");
  const setClip = (on: boolean) => {
    if (!on) clearClip("master");
  };
  const color = BUS_COLOR["master"] as string;
  return (
    <div
      className="mx-master flex w-[210px] shrink-0 flex-col border-l-2 border-border"
      style={{
        background: `linear-gradient(color-mix(in oklab, ${color} 12%, transparent), color-mix(in oklab, ${color} 12%, transparent)), ${PANEL}`,
        boxShadow: `inset 4px 0 0 0 ${color}, inset 0 1px 0 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* master name plate — the same row every channel strip carries */}
      <div
        className={cn(ROW.name, "flex items-center gap-1.5 border-b border-black/40 px-1.5")}
        style={
          {
            background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, transparent), color-mix(in oklab, ${color} 40%, transparent))`,
            boxShadow: `inset 0 2px 0 0 ${color}`,
            "--mixer-channel-color": color,
          } as CSSProperties
        }
        title="Master"
      >
        <Volume2 className="size-4 shrink-0" />
        <span className="mx-name-btn min-w-0 flex-1 truncate font-mono text-[12px] font-bold uppercase tracking-wide text-foreground">
          Master
        </span>
        <button
          onClick={() => setClip(false)}
          title="Clip indicator — click to reset"
          aria-label="Clip indicator for master — click to reset"
          className={cn(
            "size-2.5 shrink-0 rounded-full border border-black/60 transition-shadow",
            clip ? "bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.8)]" : "bg-black/50"
          )}
        />
      </div>
      <div
        className={cn(ROW.head, "flex items-center justify-between border-b border-black/50 px-1.5 font-mono text-[8px] uppercase tracking-widest")}
        style={{ background: `color-mix(in oklab, ${color} 22%, transparent)` }}
      >
        <Screw />
        Master
        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Master MIDI controls" title="Master hardware control" className="text-muted-foreground hover:text-foreground">
              <Sliders className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <MidiLearnBlock id="master" params={["volume", "mute"]} />
          </PopoverContent>
        </Popover>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
      <div
        className="mx-header-gain flex shrink-0 items-center justify-center"
        title={`Master input trim ${(master.gain ?? 1).toFixed(2)}× — before the master fader`}
      >
        <Knob
          label="Master gain"
          value={master.gain ?? 1}
          min={0}
          max={2}
          step={0.01}
          unit="×"
          size={30}
          onChange={(v) => setBus("master", { gain: v })}
          midiTarget={{ id: "master", param: "gain" }}
        />
      </div>
      </div>
      {/* live output scope, 3-band EQ and inserts — the same rows, meters and markings as every channel */}
      <div className={cn(ROW.scope, "border-b border-black/50 p-[3px]")}>
        <Scope scopeId="master" height={40} compact color={color} />
      </div>
      <MasterEq color={color} />
      <MasterChain color={color} className={ROW.devices} />
      <div className={cn(ROW.sends, "border-b border-black/50 px-1 py-[2px]")}>
        <FxMenu target="bus:master" label="Master FX" />
      </div>
      <div className={cn(ROW.sendBars, "border-b border-border/60")} />
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[8px] uppercase tracking-widest text-muted-foreground")}>
        Main out
      </div>
      <MasterWidth color={color} />
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}
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
          aria-label="Master volume"
          aria-valuetext={master.volume === 0 ? "Silent" : `${toDb(master.volume).toFixed(1)} decibels`}
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
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className="font-mono text-[9px] text-muted-foreground" title="Fader position">
          {toDb(master.volume).toFixed(1)}
        </span>
        <span className={cn("font-mono text-[9px]", peak > 0.98 ? "text-red-400" : "text-foreground/70")} title="Output level">
          {fracToDb(peak).toFixed(1)}
        </span>
        <ClipLed id="master" compact />
      </div>
      <div className={cn(ROW.buttons, "grid grid-cols-2 gap-1 px-1")}>
        <button
          onClick={() => setBus("master", { muted: !master.muted })}
          title={master.muted ? "Muted — click to unmute" : "Mute the main output"}
          aria-label="Mute master"
          aria-pressed={master.muted}
          className={cn(
            "col-span-2 h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            master.muted
              ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          M
        </button>
        <button
          onClick={() => setClip(false)}
          title={clip ? "Clipping — click to reset" : "No clipping"}
          aria-label="Master clip indicator — click to reset"
          aria-pressed={clip}
          className={cn(
            "col-span-2 h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            clip
              ? "bg-red-500 text-black shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          CLIP
        </button>
      </div>
      <div className={cn(ROW.icon, "flex shrink-0 items-center justify-center border-t border-border/60")} title="Master" aria-hidden>
        <Speaker className="size-5" />
      </div>
    </div>
  );
}

export function Mixer({ phonePage = 0, phoneChannels, phoneControlPage = "levels", desktopLayout = false }: { phonePage?: number; phoneChannels?: number; phoneControlPage?: "levels" | "performance"; desktopLayout?: boolean }) {
  const mobileDevice = useIsMobile();
  const isMobile = mobileDevice && !desktopLayout;
  const { tracks, selectedId, select, setPanel, buses, setBus, vcas, setVca, auxReturns, setAuxReturn, updateTrack, addTrack } = useStudio();
  const levels = useMeters(tracks);
  const [narrow, setNarrow] = useState(false);
  // Timeline tracks are always mirrored in the mixer. Extra routing strips open on request.
  const [showBuses, setShowBuses] = useState(false);
  const [showVcas, setShowVcas] = useState(false);
  const [showAux, setShowAux] = useState(false);
  // How many bus / VCA / aux strips to show. Bus 0 = auto (only buses in use).
  const [counts, setCounts] = useState<{ bus: number; vca: number; aux: number }>({ bus: 0, vca: VCA_IDS.length, aux: AUX_IDS.length });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("synclab.mixer.counts");
      if (raw) {
        const c = JSON.parse(raw);
        setCounts({
          bus: Math.min(BUS_STRIPS.length, Math.max(0, Number(c.bus) || 0)),
          vca: Math.min(VCA_IDS.length, Math.max(0, Number(c.vca ?? VCA_IDS.length))),
          aux: Math.min(AUX_IDS.length, Math.max(0, Number(c.aux ?? AUX_IDS.length))),
        });
      }
    } catch { /* ignore */ }
  }, []);
  const setCount = (k: "bus" | "vca" | "aux", v: number) => {
    setCounts((prev) => {
      const next = { ...prev, [k]: v };
      try { window.localStorage.setItem("synclab.mixer.counts", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [styleId, setStyleId] = useState<ConsoleStyleId>(() => {
    if (typeof window === "undefined") return "studiopro";
    const saved = window.localStorage.getItem("synclab.mixer.style") as ConsoleStyleId | null;
    return CONSOLE_STYLES.some((s) => s.id === saved) ? (saved as ConsoleStyleId) : "studiopro";
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
  // Only show bus strips that actually have channels routed to them.
  const activeBuses = BUS_STRIPS.filter((id) => tracks.some((t) => t.bus === id));
  return (
    <div
      className={cn("mx-console flex flex-col overflow-hidden border border-border bg-surface shadow-panel", isMobile && "mx-phone", mobileDevice && "mx-phone-master")}
      data-console={desk.id}
      data-touch-console={mobileDevice ? "true" : undefined}
      data-phone-controls={phoneControlPage}
      style={
        {
          "--mx-a": deskColors.a,
          "--mx-b": deskColors.b,
          "--mx-c": deskColors.c,
          "--mx-accent": desk.accent,
          "--mx-screw-display": desk.screws ? "inline-block" : "none",
          // Highlight colours inside the console follow the desk accent, not the app blue.
          "--primary": desk.accent,
          "--primary-foreground": accentInk(desk.accent),
          "--ring": desk.accent,
        } as CSSProperties
      }
    >
      {/* console toolbar */}
      <div className="mx-console-toolbar flex min-h-10 items-center gap-3 overflow-x-auto border-b border-border px-3 py-2">
        {mobileDevice && (() => { const st = tracks.find((x) => x.id === selectedId); return st ? <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="shrink-0" aria-label="Mixer MIDI Learn">MIDI Learn</Button></PopoverTrigger><PopoverContent className="w-[min(88vw,520px)]"><MidiLearnStrip id={st.id} label={`${st.name} channel — move a knob/fader after tapping`} /></PopoverContent></Popover> : null; })()}
        {isMobile ? (
          <>
            <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Mixer</span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" className="shrink-0" aria-label="Toggle full screen mixer" onClick={() => window.dispatchEvent(new CustomEvent("synclab:mixer-full"))}>Full screen</Button>
              <QuickNotes label />
              <PhoneFxMenu />
              <PhoneEqButton />
            </div>
          </>
        ) : (
          <>
        <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Mix Console</span>

        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {tracks.length} ch · {activeBuses.length} buses
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {mobileDevice && <Button variant="secondary" size="sm" className="shrink-0" aria-label="Toggle full screen mixer" onClick={() => window.dispatchEvent(new CustomEvent("synclab:mixer-full"))}>Full screen</Button>}
          <QuickNotes label />
          <Popover>
            <PopoverTrigger asChild>
              <button title="Choose how many bus, VCA and aux channels to show" className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Channels
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Channel count</div>
              {([
                ["bus", "Buses", BUS_STRIPS.length],
                ["vca", "VCA groups", VCA_IDS.length],
                ["aux", "Aux returns", AUX_IDS.length],
              ] as const).map(([k, label, max]) => (
                <div key={k} className="mb-2">
                  <div className="mb-1 text-[11px] text-foreground">{label}</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: max + 1 }, (_, n) => (
                      <button
                        key={n}
                        onClick={() => setCount(k, n)}
                        className={cn("h-7 min-w-7 rounded-sm border px-1.5 font-mono text-[10px]", counts[k] === n ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                      >
                        {k === "bus" && n === 0 ? "Auto" : n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[10px] leading-snug text-muted-foreground">Up to {BUS_STRIPS.length} buses, {VCA_IDS.length} VCAs and {AUX_IDS.length} aux returns are available. Auto shows only buses that have tracks.</p>
            </PopoverContent>
          </Popover>
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
          </>
        )}
      </div>

      {!mobileDevice && (() => { const st = tracks.find((x) => x.id === selectedId); return st ? <div className="px-2 py-1"><MidiLearnStrip id={st.id} label={`${st.name} channel — move a knob/fader after tapping`} /></div> : null; })()}
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
        <div className="mobile-mixer-strips flex overflow-x-auto" role="region" aria-label="Mixer channels" tabIndex={0}>
          {!isMobile && <LabelRail />}
          {(isMobile && phoneChannels != null ? tracks.slice(phonePage * phoneChannels, (phonePage + 1) * phoneChannels) : tracks).map((t) => (
            <Strip
              key={t.id}
              t={t}
              index={tracks.indexOf(t)}
              narrow={isMobile || narrow}
              level={t.muted ? 0 : (levels.tracks[t.id] ?? 0)}
              selected={t.id === selectedId}
              onSelect={() => { select(t.id); setPanel("mixer"); }}
            />
          ))}
          {showBuses &&
            (counts.bus === 0 ? activeBuses : BUS_STRIPS.slice(0, counts.bus)).map((id) => (
              <BusStrip key={id} id={id} state={buses[id]} level={levels.buses[id] ?? 0} onChange={(p) => setBus(id, p)} />
            ))}
          {showVcas && VCA_IDS.slice(0, counts.vca).map((id) => (
            <ControlStrip key={`vca-${id}`} kind="VCA" name={id} state={vcas[id]} level={levels.vcas[id] ?? 0} memberCount={tracks.filter((t) => t.vca === id).length} onChange={(patch) => setVca(id, patch)} />
          ))}
          {showAux && AUX_IDS.slice(0, counts.aux).map((id) => (
            <ControlStrip key={`aux-${id}`} kind="AUX" name={id} state={auxReturns[id]} level={levels.aux[id] ?? 0} onChange={(patch) => setAuxReturn(id, patch)} />
          ))}
          <div className={cn("mx-output-dock bg-surface", !isMobile && "sticky right-0 z-10")}>
            <MasterStrip level={levels.master} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Phone mixer: add effects to the selected channel from one menu. */
function PhoneFxMenu() {
  const { tracks, selectedId, addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const track = tracks.find((t) => t.id === selectedId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!track}
          title={track ? `Add effects to ${track.name}` : "Select a channel first"}
          className="flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 font-mono text-[10px] uppercase tracking-wider text-foreground hover:text-primary disabled:opacity-40"
        >
          <Settings2 className="size-4" /> Add effects
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto p-3"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }}
      >
        {track ? (
          <InsertRack
            title={`${track.name} — inserts`}
            midiId={track.id}
            list={track.plugins ?? []}
            onAdd={(def) => addPlugin(track.id, def)}
            onRemove={(id) => removePlugin(track.id, id)}
            onBypass={(id) => togglePluginBypass(track.id, id)}
            onParam={(id, p, v) => setPluginParam(track.id, id, p, v)}
          />
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tap a channel first, then add effects here.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Phone mixer: one-tap 3-band EQ on the selected channel. */
function PhoneEqButton() {
  const { tracks, selectedId, addPlugin, installedPlugins } = useStudio();
  const track = tracks.find((t) => t.id === selectedId);
  const eq = track?.plugins?.find((p) => p.kind === "eq");
  const addEq = () => {
    if (!track) return;
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (def) addPlugin(track.id, def);
  };
  return (
    <button
      type="button"
      onClick={addEq}
      disabled={!track || !!eq}
      title={!track ? "Select a channel first" : eq ? `${track.name} already has a Channel EQ` : `Add a 3-band EQ to ${track.name}`}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-sm border px-3 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40",
        eq ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface text-foreground hover:text-primary"
      )}
    >
      {eq ? "EQ on" : "+ EQ"}
    </button>
  );
}

function PhoneChannel({ track, level, selected, index }: { track?: Track; level: number; selected: boolean; index: number }) {
  const { updateTrack, buses, setBus, transport, setTransport, select, setPanel } = useStudio();
  const name = track?.name ?? "MASTER";
  const volume = track?.volume ?? buses.master.volume;
  const choose = () => { if (track) { select(track.id); setPanel("mixer"); } };
  const channelColor = track?.color;
  return <section aria-label={`${name} mixer channel`} style={{ "--mixer-channel-color": channelColor ?? "var(--mixer-output-accent)" } as CSSProperties} className={cn("phone-mix-channel flex w-[216px] shrink-0 snap-start flex-col border-r border-border bg-surface", selected && "ring-2 ring-inset ring-primary")}>
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-2"
      style={channelColor ? { background: channelColor } : undefined}
    >
      <Button variant="ghost" className={cn("h-12 min-w-0 justify-start px-1", channelColor && "text-[#0b0d0e] hover:text-[#0b0d0e]")} onClick={choose} title={name}><span className="truncate font-semibold">{track ? `${index + 1}. ${name}` : name}</span></Button>
      {track ? <span style={channelColor ? { color: "#0b0d0e" } : undefined}><PhoneChannelFxMenu track={track} /></span> : <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="size-12" aria-label={`${name} channel controls`} title="Channel controls"><Settings2 className="size-5" /></Button></DialogTrigger><DialogContent className="phone-channel-details max-h-[88dvh] w-[min(94vw,420px)] overflow-y-auto"><DialogHeader><DialogTitle className="truncate">{name}</DialogTitle></DialogHeader><div className="flex justify-center"><MasterStrip level={level} /></div></DialogContent></Dialog>}
    </div>
    <div className="flex items-center justify-between px-3 py-2"><span className="font-mono text-base font-bold text-foreground">{toDb(volume).toFixed(1)} dB</span><ClipLed id={track?.id ?? "master"} /></div>
    <div className="flex h-48 items-stretch justify-center gap-4 px-3 py-2">
      <div aria-hidden className="flex flex-col items-end justify-between py-1 font-mono text-[10px] font-bold leading-none text-foreground">
        {(track ? ["0", "-6", "-12", "-24", "-∞"] : ["+6", "0", "-6", "-12", "-24", "-∞"]).map((m) => <span key={m}>{m}</span>)}
      </div>
      <Slider aria-label={`${name} volume`} orientation="vertical" className={cn("mx-fader h-full w-12", FADER_CAP)} value={[volume]} min={0} max={track ? 1 : 1.5} step={0.01} onValueChange={([v = 0]) => track ? updateTrack(track.id, { volume: v }) : setBus("master", { volume: v })} /><Meter id={track?.id ?? "master"} level={level} tall />
    </div>
    {track ? <>
      <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_48px] items-center gap-2 border-y border-border px-3"><span aria-hidden className="font-mono text-[10px] font-bold text-foreground">PAN</span><Slider aria-label={`${name} pan`} className="h-12" value={[track.pan]} min={-1} max={1} step={0.01} onValueChange={([pan = 0]) => updateTrack(track.id, { pan })} /><Button variant="ghost" className="size-12 px-0 font-mono text-xs font-bold text-foreground" title="Reset pan to centre" onClick={() => updateTrack(track.id, { pan: 0 })}>{track.pan === 0 ? "C" : `${track.pan < 0 ? "L" : "R"}${Math.round(Math.abs(track.pan) * 100)}`}</Button></div>
      <div className="grid grid-cols-4 gap-1 p-2"><Button variant={track.muted ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Mute ${name}`} aria-pressed={track.muted} onClick={() => updateTrack(track.id, { muted: !track.muted })}>M</Button><Button variant={track.solo ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Solo ${name}`} aria-pressed={track.solo} onClick={() => updateTrack(track.id, { solo: !track.solo })}>S</Button><Button variant={track.armed ? "destructive" : "outline"} className="h-12 p-0" aria-label={`Record arm ${name}`} aria-pressed={track.armed} onClick={() => updateTrack(track.id, { armed: !track.armed })}><span className="size-4 rounded-full bg-destructive" /></Button><Button variant={transport.monitor ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Monitor ${name}`} aria-pressed={transport.monitor} onClick={() => setTransport({ monitor: !transport.monitor })}><Waves className="size-5" /></Button></div>
      <div className="mx-row-scope h-12 shrink-0 border-t border-border p-1"><Scope scopeId={`ch:${track.id}`} height={40} compact color={track.color} /></div>
      <div className="mx-row-icon flex h-14 shrink-0 items-center justify-center border-t border-border" title={name} aria-hidden><TrackIcon track={track} className="size-7" /></div>
    </> : <div className="flex h-[120px] items-center justify-center"><Button variant="outline" className="h-12" onClick={() => clearClip("master")}>Reset clip</Button></div>}
    {track && <ChannelEq t={track} />}
  </section>;
}

/** Phone mixer channel header: effects & EQ menu for one track (no desktop strip). */
function PhoneChannelFxMenu({ track }: { track: Track }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam, installedPlugins } = useStudio();
  const eq = track.plugins?.find((p) => p.kind === "eq");
  const count = track.plugins?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Effects and EQ for ${track.name}`}
          title={`Effects and EQ for ${track.name}`}
          className={cn("flex size-12 flex-col items-center justify-center gap-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider", count > 0 ? "text-primary" : "text-foreground")}
        >
          <Settings2 className="size-5" />
          <span>{count > 0 ? `FX ${count}` : "FX"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(55dvh,420px)] w-[min(92vw,360px)] overflow-y-auto p-3"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 bg-popover pb-2">
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {track.name} — effects & EQ
          </span>
          <button
            type="button"
            disabled={!!eq}
            title={eq ? `${track.name} already has a Channel EQ` : `Add a 3-band EQ to ${track.name}`}
            onClick={() => {
              const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
              if (def) addPlugin(track.id, def);
            }}
            className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-wider disabled:opacity-70 ${
              eq ? "border-primary/60 text-primary" : "border-border text-foreground hover:text-primary"
            }`}
          >
            {eq ? "EQ on" : "+ EQ"}
          </button>
        </div>
        <InsertRack
          title={`${track.name} — inserts`}
          midiId={track.id}
          list={track.plugins ?? []}
          onAdd={(def) => addPlugin(track.id, def)}
          onRemove={(id) => removePlugin(track.id, id)}
          onBypass={(id) => togglePluginBypass(track.id, id)}
          onParam={(id, p, v) => setPluginParam(track.id, id, p, v)}
        />
      </PopoverContent>
    </Popover>
  );
}
