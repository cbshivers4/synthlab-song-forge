import { faderGain, faderPosition } from "@/lib/synclab/fader-taper";
import { TRIM_MAX_DB, TRIM_MIN_DB, trimDb, trimGain, trimKnobText, trimText } from "@/lib/synclab/trim-gain";
import { availableEffects } from "@/lib/synclab/effect-catalog";
import { EffectPicker } from "../EffectPicker";
import { useEffect, useRef, type CSSProperties } from "react";
import { ChevronRight, Power, Sliders, Speaker, Trash2, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Knob } from "../Knob";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { MidiLearnBlock } from "../MidiLearn";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { BusState } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, peakHoldDb, peakHoldText, useClipped } from "@/lib/synclab/clip-monitor";
import { Scope } from "../Scope";
import { FxMenu } from "./BusStrips";
import { EqCurve } from "./ChannelEq";
import { BUS_COLOR, ClipLed, FADER_CAP, FaderScale, Meter, PANEL, ROW, Screw, fracToDb, toDb } from "./shared";

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
      <Popover><PopoverTrigger asChild><Button variant="ghost" className="h-8 w-full text-[10px]" aria-label="Add any effect to master">Add effect</Button></PopoverTrigger><PopoverContent className="w-72" onClick={event => event.stopPropagation()}><EffectPicker effects={availableEffects(installedPlugins)} onAdd={def => addFxPlugin("bus:master", def)} /></PopoverContent></Popover>
    </div>
  );
}

/** One master-bus effect's parameters; the first move adds that effect to the master chain. Shared by desk and phone views. */
export function useMasterFx(kind: "eq" | "width") {
  const { fxChains, addFxPlugin, setFxParam, installedPlugins } = useStudio();
  const inst = (fxChains["bus:master"] ?? []).find((p) => p.kind === kind);
  const pending = useRef<[string, number] | null>(null);
  useEffect(() => {
    const wanted = pending.current;
    if (!inst || !wanted) return;
    pending.current = null;
    setFxParam("bus:master", inst.id, wanted[0], wanted[1]);
  }, [inst, setFxParam]);
  const set = (id: string, value: number) => {
    if (inst) {
      setFxParam("bus:master", inst.id, id, value);
      return;
    }
    const def = installedPlugins.find((d) => d.kind === kind) ?? BUILT_IN_PLUGINS.find((d) => d.kind === kind);
    if (!def) return;
    pending.current = [id, value];
    addFxPlugin("bus:master", def);
  };
  const get = (id: string, fallback: number) => inst?.params.find((p) => p.id === id)?.value ?? fallback;
  return { inst, set, get };
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
    <div className={cn(ROW.pan, "flex items-center justify-center border-b border-border/60 px-1.5")} style={{ "--primary": color } as CSSProperties}>
      <Knob
        label="WIDTH"
        ariaLabel="Master stereo width"
        layout="inline"
        size={30}
        value={v}
        min={0}
        max={2}
        step={0.01}
        defaultValue={1}
        format={(n) => (n === 0 ? "MONO" : `${Math.round(n * 100)}%`)}
        onChange={setWidth}
      />
    </div>
  );
}

export function MasterStrip({ level: peak }: { level: number }) {
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
            <MidiLearnBlock id="master" params={["volume", "mute", "gain"]} />
          </PopoverContent>
        </Popover>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
      <div
        className="mx-header-gain flex shrink-0 items-center justify-center"
        title={`Master input gain ${trimText(master.gain)} (−24 to +24 dB) — before the master fader · double-click for 0 dB`}
      >
        <Knob
          label="Master gain"
          value={trimDb(master.gain)}
          min={TRIM_MIN_DB}
          max={TRIM_MAX_DB}
          step={0.5}
          defaultValue={0}
          format={trimKnobText}
          size={30}
          onChange={(db) => setBus("master", { gain: trimGain(db) })}
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
        <FaderScale />
        <Slider
          aria-label="Master volume"
          aria-valuetext={master.volume === 0 ? "Silent" : `${toDb(master.volume).toFixed(1)} decibels`}
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[faderPosition(master.volume)]}
          min={0}
          max={1}
          step={0.001}
          onDoubleClick={() => setBus("master", { volume: 1 })}
          onValueChange={([v = 0]) => setBus("master", { volume: faderGain(v) })}
        />
        <Meter id="master" level={peak} tall />
        <Meter id="master" level={peak} tall />
      </div>
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className="font-mono text-[9px] text-muted-foreground" title="Fader position">
          {toDb(master.volume).toFixed(1)}
        </span>
        <span className={cn("font-mono text-[9px]", peakHoldDb("master") > -0.2 ? "text-red-400" : "text-foreground/70")} title="Master peak hold (dBFS) — highest level since reset; click CLIP to reset" aria-label={`Master peak hold ${peakHoldText("master")} dB`}>
          {peakHoldText("master")}
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
