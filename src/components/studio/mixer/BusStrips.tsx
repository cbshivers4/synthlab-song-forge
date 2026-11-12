import { FADER_MAX_GAIN, faderGain, faderPosition } from "@/lib/synclab/fader-taper";
import { type CSSProperties } from "react";
import { ChevronRight, Settings2, Sliders, Waves } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Knob } from "../Knob";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { MidiLearnButton } from "../MidiLearn";
import type { BusId, BusState, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { Scope } from "../Scope";
import { InsertRack } from "./InsertRack";
import { BUS_COLOR, ClipLed, FADER_CAP, Meter, PANEL, ROW, Screw, fracToDb, toDb } from "./shared";

export function BusStrip({
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
        <div className="mx-header-gain"><Knob label={`${id} bus gain`} value={state.volume} min={0} max={FADER_MAX_GAIN} step={0.01} size={30} onChange={(volume) => onChange({ volume })} midiTarget={{ id: `bus:${id}`, param: "volume" }} /></div>
      </div>
      <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")}>
        <Scope scopeId={`bus:${id}`} height={40} compact color={color} />
      </div>
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
          value={[faderPosition(state.volume)]}
          min={0}
          max={1}
          step={0.001}
          onValueChange={([v = 0]) => onChange({ volume: faderGain(v) })}
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
export function VcaAssign({ id, memberCount, className, short }: { id: VcaId; memberCount: number; className?: string; short?: boolean }) {
  const { tracks, updateTrack } = useStudio();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={memberCount ? "outline" : "secondary"} size="sm" className={cn("h-7 w-full font-mono text-[9px]", className)} aria-label={`Assign tracks to VCA ${id}`} title={`Choose which tracks VCA ${id} controls`}>
          {short ? (memberCount ? `${memberCount} TR` : "SET") : memberCount ? `${memberCount} TRACK${memberCount > 1 ? "S" : ""}` : "ASSIGN TRACKS"}
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

export function ControlStrip({ kind, name, state, onChange, memberCount, level }: {
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
      <div className={cn(ROW.head, "flex items-center justify-end gap-1.5 border-b border-border px-1.5")}><ChevronRight className="size-3.5 shrink-0" aria-hidden /><div className="mx-header-gain"><Knob label={`${kind} ${name} gain`} value={state.volume} min={0} max={FADER_MAX_GAIN} step={0.01} size={30} onChange={(volume) => onChange({ volume })} midiTarget={{ id: `${aux ? "aux" : "vca"}:${name}`, param: "volume" }} /></div></div>
       <div className={cn(ROW.eq, "flex items-center justify-center gap-1 border-b border-border/60")}><MidiLearnButton id={`${aux ? "aux" : "vca"}:${name}`} param="volume" label={`${kind} ${name} level`} /><MidiLearnButton id={`${aux ? "aux" : "vca"}:${name}`} param="mute" label={`${kind} ${name} mute`} /></div>
      <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")} title={aux ? "Return output after its effects" : `Sum of the ${memberCount ?? 0} channels on this VCA`}>
        <Scope scopeId={`${aux ? "aux" : "vca"}:${name}`} height={40} compact color={aux ? "var(--primary)" : "var(--accent)"} />
      </div>
      <div className={cn(ROW.devices, "flex items-center border-b border-border/60 p-2")}>
        {aux ? <FxMenu target={`send:${name}`} label="Return FX" /> : <VcaAssign id={name as VcaId} memberCount={memberCount ?? 0} />}
      </div>
      {advanced && <div className={cn(ROW.sends, "border-b border-border/60")} />}
      {advanced && <div className={cn(ROW.sendBars, "border-b border-border/60")} />}
      <div className={cn(ROW.io, "flex items-center justify-center border-b border-border/60 font-mono text-[9px] uppercase text-muted-foreground")}>{aux ? "Master" : "Assigned channels"}</div>
      <div className={cn(ROW.pan, "border-b border-border/60")} />
      <div className={cn(ROW.fader, "flex items-stretch justify-center gap-2 border-b border-border/60 py-1")}>
        <Slider aria-label={`${kind} ${name} level`} orientation="vertical" className={cn("h-full w-8", FADER_CAP)} value={[faderPosition(state.volume)]} min={0} max={1} step={0.001} onValueChange={([value = 0]) => onChange({ volume: faderGain(value) })} />
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

export function FxMenu({ target, label, className }: { target: string; label: string; className?: string }) {
  const { fxChains, addFxPlugin, removeFxPlugin, toggleFxBypass, setFxParam } = useStudio();
  const list = fxChains[target] ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${label} — ${target.split(":")[1] ?? target}`}
          className={cn(
            "flex h-7 w-full items-center justify-center gap-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider transition-colors",
            list.length > 0 ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground",
            className,
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
