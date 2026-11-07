import { faderTickPosition } from "@/lib/synclab/fader-taper";
import { dbColor, LEVEL_RED, mixerDbToFraction, mixerFractionToDb, mixerSegmentDb } from "@/lib/synclab/level-colors";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Knob } from "../Knob";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { useStudio } from "@/lib/synclab/store";
import { TrackIcon, TrackStylePicker } from "@/components/studio/TrackStyle";
import type { AuxId, BusId, Track, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, reportLevel, useClipped } from "@/lib/synclab/clip-monitor";

export const BUSES: BusId[] = ["drums", "vocals", "instruments", "synths", "fx", "master"];
export const DB_TICKS = [6, 0, -6, -12, -24, -48];
export const SEND_KEYS: [keyof NonNullable<Track["sends"]>, string][] = [
  ["reverb", "REV"],
  ["delay", "DLY"],
  ["chorus", "CHO"],
];
export const BUS_STRIPS: BusId[] = ["drums", "vocals", "instruments", "synths", "fx"];
export const VCA_IDS: VcaId[] = ["A", "B", "C", "D"];
export const AUX_IDS: AuxId[] = ["reverb", "delay", "chorus"];
export const BUS_COLOR: Record<string, string> = {
  drums: "oklch(0.75 0.19 30)",
  vocals: "oklch(0.75 0.19 330)",
  instruments: "oklch(0.82 0.17 95)",
  synths: "oklch(0.72 0.18 265)",
  fx: "oklch(0.78 0.18 145)",
  master: "oklch(0.78 0.16 195)",
};

export function toDb(v: number) {
  return 20 * Math.log10(Math.max(0.001, v));
}

function dbToFrac(db: number) {
  return mixerDbToFraction(db);
}

export function fracToDb(frac: number) {
  return mixerFractionToDb(frac);
}

/** dB marks beside a fader, placed on the same console taper the fader uses. */
export function FaderScale() {
  return (
    <div className="relative my-2 w-4 shrink-0" aria-hidden>
      {DB_TICKS.map((db) => (
        <div key={db} className="absolute right-0 flex translate-y-1/2 items-center gap-0.5" style={{ bottom: `${faderTickPosition(db) * 100}%` }}>
          <span className={cn("font-mono text-[7px] leading-none", db > 0 ? "text-destructive" : "text-muted-foreground")}>{db > 0 ? `+${db}` : db}</span>
          <span className="h-px w-1 bg-border" />
        </div>
      ))}
    </div>
  );
}

/** Real post-fader signal readings; one shared 20 fps refresh for every strip. */
export function useMeters(tracks: Track[]) {
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
export function Meter({ id, level, tall }: { id: string; level: number; tall?: boolean }) {
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
  const DB_TICKS = [6, 0, -6, -12, -24, -36, -48];
  return (
    <div className={cn("flex items-stretch gap-0.5", tall ? "h-full min-h-0" : "h-44")}>
      <div className="relative w-5 shrink-0" aria-hidden>
        {DB_TICKS.map((db) => (
          <div key={db} className="absolute right-0 flex items-center gap-px" style={{ top: `calc(${(1 - dbToFrac(db)) * 100}% - ${(1 - dbToFrac(db)) * 7}px)` }}>
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
        const segDb = mixerSegmentDb(i, segs);
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
export function ChannelGain({ t, narrow }: { t: Track; narrow?: boolean }) {
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
export function ClipLed({ id, compact }: { id: string; compact?: boolean }) {
  const clipped = useClipped(id);
  return (
    <button
      type="button"
      title={clipped ? "Clipping — click to reset the clip light and peak hold" : "No clipping — click to reset the peak hold"}
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

/* ---- Console section geometry: every column shares these row heights ---- */
export const ROW = {
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
export type ConsoleStyle = {
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

export const CONSOLE_STYLES: ConsoleStyle[] = [
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
export const SOLID_PRESETS: { name: string; hex: string }[] = [
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
export function accentInk(accent: string) {
  const m = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.-]+)\)/.exec(accent);
  if (!m) return "#1a1b1e";
  return `oklch(0.24 ${Math.min(0.05, Number(m[2]) * 0.3)} ${m[3]})`;
}

/** Panel background, driven by the picked desk (vars set on the console root). */
export const PANEL =
  "linear-gradient(180deg, var(--mx-a, oklch(0.36 0.008 260)), var(--mx-b, oklch(0.30 0.008 260)) 45%, var(--mx-c, oklch(0.22 0.008 260)))";

/** Console screw head. */
export function Screw({ className }: { className?: string }) {
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
export const FADER_CAP =
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
export function LabelRail() {
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

/** Instrument drawing shown on a channel's name plate. */
export function KindIcon({ t, className }: { t: Track; className?: string }) {
  return <TrackIcon track={t} className={className} tinted={false} />;
}

/** Colour + icon picker so every channel can be restyled from the console. */
export function ColorDot({ t }: { t: Track }) {
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
