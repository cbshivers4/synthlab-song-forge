import { usePlayStep } from "@/lib/synclab/playhead";
import { memo, useMemo, useRef, useSyncExternalStore } from "react";
import { stepsPerBar, getBeatsPerBar } from "@/lib/synclab/timebase";
import { snapCut } from "@/lib/synclab/note-cuts";
import { Scissors } from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import type { AutomationParam, BusId, Track } from "@/lib/synclab/types";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { Lane } from "./clips";

export const synclabLogo = synclabLogoAsset.url;


const CORE_LANE_LABEL: Record<Exclude<AutomationParam, `plugin:${string}:${string}`>, string> = {
  volume: "VOLUME",
  pan: "PAN",
  sendReverb: "REVERB SEND",
  sendDelay: "DELAY SEND",
};
export const laneLabel = (track: Track, param: AutomationParam) => {
  if (!param.startsWith("plugin:")) return CORE_LANE_LABEL[param as keyof typeof CORE_LANE_LABEL];
  const [, pluginId, paramId] = param.split(":");
  const plugin = (track.plugins ?? []).find((item) => item.id === pluginId);
  const control = plugin?.params.find((item) => item.id === paramId);
  return `${plugin?.name ?? "DEVICE"} · ${control?.name ?? paramId ?? "CONTROL"}`.toUpperCase();
};

export const EMPTY_PEAKS: number[] = [0];


export const INPUTS = ["Microphone", "Guitar / Line 1", "Keyboard / Line 2", "External Instrument", "MIDI Keyboard", "Internal", "Stereo File"];

/** Cutting overlay owns pointer targeting so clip drag handles cannot mask the tool. */
/** Free (off-grid) cutting toggle, shared by the toolbar and every lane; remembered on this device. */
const CUT_FREE_KEY = "synclab.cutFree";
let cutFreeValue = true;
const cutFreeListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  try { cutFreeValue = window.localStorage.getItem(CUT_FREE_KEY) !== "0"; } catch { /* storage blocked */ }
}
export function setCutFree(v: boolean) {
  cutFreeValue = v;
  try { window.localStorage.setItem(CUT_FREE_KEY, v ? "1" : "0"); } catch { /* storage blocked */ }
  cutFreeListeners.forEach((l) => l());
}
export function useCutFree() {
  return useSyncExternalStore(
    (l) => { cutFreeListeners.add(l); return () => cutFreeListeners.delete(l); },
    () => cutFreeValue,
    () => true,
  );
}
/** The synths a note track can load; the style test matches SynthEditor's panel styling. */
export const SYNTH_CHOICES = [
  { style: "spec4", label: "Spec 4 Synth", preset: "Cybotron Lead" },
  { style: "acid", label: "Acid Bass (TD-3)", preset: "TD-3 Acid Saw" },
  { style: "poly", label: "Poly Synth", preset: "Poly Synth Brass" },
  { style: "modular", label: "Modular Tech Synth", preset: "Modular Tech Empty Rack" },
  { style: "granular", label: "Granular Synth", preset: "Granular Glass Cloud" },
] as const;
export const synthStyleOf = (t: Track) =>
  t.patch?.granular ? "granular"
  : t.patch?.modular ? "modular"
  : t.patch?.name.startsWith("TD-3") || /ACID/i.test(t.name) ? "acid"
  : t.patch?.name.startsWith("Poly Synth") || /POLY/i.test(t.name) ? "poly"
  : "spec4";

/** Cut position in song steps: exact where you click when free (or Alt held on grid), otherwise on the snap grid. */
export function cutPosition(frac: number, total: number, grid: number, altKey: boolean) {
  const free = cutFreeValue !== altKey;
  return Math.max(0, Math.min(total, snapCut(frac * total, grid > 0 ? grid : 1, free)));
}
/** Lane grid sized to the real song: a strong line on every bar, a medium line on every quarter note, a faint line on every eighth note. */
export function laneGridBackground(bars: number) {
  const bar = 100 / Math.max(1, bars);
  const beat = bar / getBeatsPerBar();
  const eighth = beat / 2;
  return [
    `repeating-linear-gradient(to right, var(--grid-line-strong) 0 1px, transparent 1px ${bar}%)`,
    `repeating-linear-gradient(to right, var(--grid-line) 0 1px, transparent 1px ${beat}%)`,
    `repeating-linear-gradient(to right, var(--grid-line-faint, var(--grid-line)) 0 1px, transparent 1px ${eighth}%)`,
  ].join(", ");
}

export function TimelineCutGuide({ tool, selected, total, grid }: { tool: "split" | "razor"; selected: boolean; total: number; grid: number }) {
  const position = Math.min(0.99, Math.max(0, usePlayStep() / Math.max(1, total)));
  const lineRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const showAtPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    const rawX = Math.max(0, Math.min(rect.width, pt.x - rect.left));
    // The guide shows exactly where the cut will land — snapped or free.
    const x = (cutPosition(rawX / Math.max(1, rect.width), total, grid, e.altKey) / Math.max(1, total)) * rect.width;
    const y = Math.max(4, Math.min(rect.height - 32, pt.y - rect.top + 10));
    const line = lineRef.current;
    const icon = iconRef.current;
    if (line) { line.style.left = `${x}px`; line.style.opacity = "1"; }
    if (icon) {
      icon.style.left = `${Math.max(0, Math.min(rect.width - 32, x + 10))}px`;
      icon.style.top = `${y}px`;
      icon.style.opacity = "1";
    }
  };
  return <div
    data-cut-tool={tool}
    className="absolute inset-0 z-30 cursor-none"
    onPointerEnter={showAtPointer}
    onPointerMove={showAtPointer}
    onPointerDown={showAtPointer}
    onPointerLeave={(e) => {
      if (e.pointerType === "touch") return;
      if (lineRef.current) lineRef.current.style.opacity = "0";
      if (iconRef.current) iconRef.current.style.opacity = "0";
    }}
  >
    <div ref={lineRef} data-cut-line className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-primary" style={{ left: `${position * 100}%`, opacity: selected ? 1 : 0 }} />
    <div ref={iconRef} data-cut-icon className="pointer-events-none absolute top-2 flex size-8 items-center justify-center rounded-sm border border-primary bg-background text-foreground shadow-sm" style={{ left: `clamp(0px, ${position * 100}%, calc(100% - 32px))`, opacity: selected ? 1 : 0 }}>
      {tool === "split" ? <Scissors className="size-5" /> : <RazorIcon className="size-5" />}
    </div>
  </div>;
}


export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Hit-envelope view of a drum pattern: every programmed hit draws a decaying
 *  transient sized by its velocity. It reflects the real pattern; recorded audio
 *  (WAVE) shows the true rendered waveform. */
export const DrumHitWave = memo(function DrumHitWave({ pads, steps, total, tone = "text-clip-drum" }: { pads: { steps: number[] }[]; steps: number; total: number; tone?: string }) {
  const path = useMemo(() => {
    const res = 6;
    const n = Math.max(2, total * res);
    const env = new Float32Array(n);
    for (let at = 0; at < total; at++) {
      const i = at % Math.max(1, steps);
      let hit = 0;
      for (const p of pads) hit += p.steps[i] ?? 0;
      if (hit <= 0) continue;
      const amp = Math.min(1, 0.35 + hit * 0.4);
      for (let k = 0; k < res * 3 && at * res + k < n; k++) env[at * res + k] = Math.max(env[at * res + k]!, amp * Math.exp(-k / (res * 0.9)) * (0.85 + 0.15 * Math.sin(k * 2.7)));
    }
    const x = (i: number) => ((i / (n - 1)) * 1000).toFixed(1);
    const top = Array.from(env, (v, i) => `${x(i)},${(50 - Math.max(0.6, v * 46)).toFixed(1)}`);
    const bot = Array.from(env, (v, i) => `${x(i)},${(50 + Math.max(0.6, v * 46)).toFixed(1)}`).reverse();
    return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
  }, [pads, steps, total]);
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${tone}`} role="img" aria-label="Drum pattern hit envelope">
      <path d={path} fill="currentColor" fillOpacity="0.7" />
      <line x1="0" y1="50" x2="1000" y2="50" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" />
    </svg>
  );
});

export type DragPayload =
  | { type: "instrument"; name: string; preset: string }
  | { type: "plugin"; defId: string }
  | { type: "tool"; kind: Track["kind"]; name: string; preset?: string }
  | { type: "localfile"; id: string; name: string };

export const readDrag = (e: React.DragEvent): DragPayload | null => {
  const raw = e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DragPayload;
    return v?.type === "instrument" || v?.type === "plugin" || v?.type === "tool" || v?.type === "localfile" ? v : null;
  } catch {
    return null;
  }
};

export const TRACK_BUSES: { id: BusId; label: string }[] = [
  { id: "drums", label: "Drums bus" },
  { id: "vocals", label: "Vocals bus" },
  { id: "instruments", label: "Instruments bus" },
  { id: "synths", label: "Synths bus" },
  { id: "fx", label: "FX bus" },
  { id: "master", label: "Master (direct)" },
];

/** Grid values in steps (1 step = a 1/16 note). */
export const GRID_OPTIONS = () => [
  { label: "1/32", value: 0.5 },
  { label: "1/16", value: 1 },
  { label: "1/8", value: 2 },
  { label: "1/4", value: 4 },
  { label: "1/2", value: 8 },
  { label: "BAR", value: stepsPerBar() },
];
export const SNAP_OPTIONS = () => [{ label: "OFF", value: 0 }, ...GRID_OPTIONS().slice(1)];

/** Razor-blade tool icon (lucide stroke style) — distinct from the scissors. */
export function RazorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 2h8l3 3v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" />
      <path d="M10 2v3h4V2" />
      <path d="M12 10.5a2 2 0 0 0-2 2v1a2 2 0 0 0 4 0v-1a2 2 0 0 0-2-2z" />
    </svg>
  );
}

