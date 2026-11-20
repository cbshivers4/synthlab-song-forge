import type { CSSProperties, ReactNode } from "react";
import { Power } from "lucide-react";
import { Knob } from "@/components/studio/Knob";
import { cn } from "@/lib/utils";
import { MASTER_DEFAULTS, type MasterSettings } from "@/lib/synclab/mastering";

type NumKey = {
  [K in keyof MasterSettings]: MasterSettings[K] extends number ? K : never;
}[keyof MasterSettings];
type OnKey = "eqOn" | "mbOn" | "imgOn" | "excOn";

interface Props {
  settings: MasterSettings;
  set: (k: keyof MasterSettings, v: number | boolean) => void;
  /** re-render the master after a knob is released or a device is switched */
  commit: (next?: MasterSettings) => void;
  /** deepest limiter gain reduction of the last render, dB */
  reductionDb?: number | undefined;
}

const hz = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz` : `${Math.round(v)} Hz`;
const dbf = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const ratio = (v: number) => `${v.toFixed(1)}:1`;
const ms = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)} ms`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const wid = (v: number) => (v === 0 ? "Mono" : `${v.toFixed(2)}x`);

function Device({
  title,
  subtitle,
  hue,
  on,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  hue: number;
  on: boolean | null;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="fx-face hardware-device flex min-w-0 flex-col gap-2 p-2.5"
      style={{ "--fx-hue": hue } as CSSProperties}
      data-bypassed={on === false ? "true" : undefined}
      aria-label={title}
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[11px] font-semibold uppercase">{title}</h3>
          <div className="label-xs truncate">{subtitle}</div>
        </div>
        {on !== null && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={on}
            aria-label={`${on ? "Turn off" : "Turn on"} ${title}`}
            className={cn(
              "ml-auto flex h-7 items-center gap-1 rounded-sm border px-2 font-mono text-[9px] uppercase tracking-widest",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-2 text-muted-foreground",
            )}
          >
            <Power className="size-3" /> {on ? "On" : "Off"}
          </button>
        )}
      </header>
      <div
        className={cn(
          "flex flex-wrap justify-center gap-x-2 gap-y-2",
          on === false && "opacity-60",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Advanced mastering rack — every knob drives real processing in lib/synclab/mastering.ts. */
export function MasterDevices({ settings, set, commit, reductionDb }: Props) {
  const knob = (
    key: NumKey,
    label: string,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string,
  ) => (
    <Knob
      key={key}
      label={label}
      value={settings[key]}
      min={min}
      max={max}
      step={step}
      size={42}
      className="w-16"
      defaultValue={MASTER_DEFAULTS[key]}
      format={format}
      onChange={(v) => set(key, v)}
      onCommit={() => commit()}
    />
  );
  const toggle = (key: OnKey) => () => {
    const next = { ...settings, [key]: !settings[key] };
    set(key, !settings[key]);
    commit(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <div className="label-xs">Mastering devices</div>
        <div className="text-[9px] text-muted-foreground">
          Signal flows left to right, then into the maximizer.
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Device
          title="Master EQ"
          subtitle="4-band · shelves and bells"
          hue={150}
          on={settings.eqOn}
          onToggle={toggle("eqOn")}
        >
          {knob("eqLowFreq", "Low", 30, 300, 1, hz)}
          {knob("eqLowGain", "Low gain", -12, 12, 0.25, dbf)}
          {knob("eqLmFreq", "Low-mid", 150, 1500, 5, hz)}
          {knob("eqLmGain", "LM gain", -12, 12, 0.25, dbf)}
          {knob("eqLmQ", "LM Q", 0.3, 4, 0.05, (v) => v.toFixed(2))}
          {knob("eqHmFreq", "High-mid", 1000, 8000, 10, hz)}
          {knob("eqHmGain", "HM gain", -12, 12, 0.25, dbf)}
          {knob("eqHmQ", "HM Q", 0.3, 4, 0.05, (v) => v.toFixed(2))}
          {knob("eqHighFreq", "High", 5000, 18000, 50, hz)}
          {knob("eqHighGain", "High gain", -12, 12, 0.25, dbf)}
        </Device>

        <Device
          title="Multiband"
          subtitle="3-band dynamics · replaces Glue while on"
          hue={60}
          on={settings.mbOn}
          onToggle={toggle("mbOn")}
        >
          {knob("mbLowX", "Low split", 60, 500, 5, hz)}
          {knob("mbHighX", "High split", 1500, 8000, 50, hz)}
          {knob("mbAttack", "Attack", 1, 80, 0.5, ms)}
          {knob("mbRelease", "Release", 30, 600, 5, ms)}
          <div className="flex w-full flex-wrap justify-center gap-x-2 gap-y-2 border-t border-border pt-2">
            {knob("mbLowThr", "Low thr", -40, 0, 0.5, dbf)}
            {knob("mbLowRatio", "Low ratio", 1, 10, 0.1, ratio)}
            {knob("mbLowGain", "Low out", -6, 12, 0.25, dbf)}
            {knob("mbMidThr", "Mid thr", -40, 0, 0.5, dbf)}
            {knob("mbMidRatio", "Mid ratio", 1, 10, 0.1, ratio)}
            {knob("mbMidGain", "Mid out", -6, 12, 0.25, dbf)}
            {knob("mbHighThr", "High thr", -40, 0, 0.5, dbf)}
            {knob("mbHighRatio", "High ratio", 1, 10, 0.1, ratio)}
            {knob("mbHighGain", "High out", -6, 12, 0.25, dbf)}
          </div>
        </Device>

        <Device
          title="Stereo Imager"
          subtitle="Width per band · 0 = mono"
          hue={185}
          on={settings.imgOn}
          onToggle={toggle("imgOn")}
        >
          {knob("imgLowX", "Low split", 60, 800, 5, hz)}
          {knob("imgHighX", "High split", 1500, 10000, 50, hz)}
          {knob("imgLow", "Low width", 0, 2, 0.05, wid)}
          {knob("imgMid", "Mid width", 0, 2, 0.05, wid)}
          {knob("imgHigh", "High width", 0, 2, 0.05, wid)}
        </Device>

        <Device
          title="Exciter"
          subtitle="Harmonics on the top end only"
          hue={30}
          on={settings.excOn}
          onToggle={toggle("excOn")}
        >
          {knob("excFreq", "Freq", 2000, 12000, 50, hz)}
          {knob("excAmount", "Harmonics", 0, 1, 0.01, pct)}
          {knob("excMix", "Mix", 0, 1, 0.01, pct)}
        </Device>

        <Device title="Maximizer" subtitle="True-peak limiter · always on" hue={12} on={null}>
          {knob("limLookahead", "Lookahead", 0.5, 5, 0.1, ms)}
          {knob("limRelease", "Release", 10, 500, 5, ms)}
          <div className="flex w-16 flex-col items-center justify-center rounded-sm border border-border bg-surface-2 px-1 py-1.5 text-center">
            <div className="label-xs">Reduction</div>
            <div className="font-mono text-xs text-foreground">
              {reductionDb === undefined
                ? "—"
                : reductionDb < 0.05
                  ? "0.0"
                  : `-${reductionDb.toFixed(1)}`}
            </div>
            <div className="text-[8px] text-muted-foreground">dB max</div>
          </div>
          <div className="w-full text-center text-[9px] text-muted-foreground">
            Aims for {settings.targetLufs.toFixed(1)} LUFS, never above{" "}
            {settings.ceilingDb.toFixed(1)} dBTP — set with Loudness and Ceiling above.
          </div>
        </Device>
      </div>
    </div>
  );
}
