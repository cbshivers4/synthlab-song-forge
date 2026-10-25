import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { levelColor, peakOf } from "@/lib/synclab/level-colors";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance } from "@/lib/synclab/types";
import { EffectDisplay } from "./EffectDisplay";
import { Knob } from "./Knob";
import { EffectWorkbench, effectFamily } from "./EffectWorkbench";
import { ProEq } from "./ProEq";
import { VocoderPanel } from "./VocoderPanel";
import { EffectPresetMenu } from "./EffectPresetMenu";
import { effectBrand, effectCategory } from "@/lib/synclab/effect-catalog";

const meterListeners = new Set<() => void>();
let meterTimer: ReturnType<typeof setInterval> | undefined;
function subscribeMeter(draw: () => void) {
  meterListeners.add(draw);
  meterTimer ??= setInterval(() => meterListeners.forEach((listener) => listener()), 50);
  draw();
  return () => {
    meterListeners.delete(draw);
    if (!meterListeners.size) { clearInterval(meterTimer); meterTimer = undefined; }
  };
}

/** One post-insert signal, not a simulated stereo or input meter. */
function RackMeter({ plugin }: { plugin: PluginInstance }) {
  const fill = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const clip = useRef<HTMLButtonElement>(null);
  const heldClip = useRef(false);
  useEffect(() => {
    heldClip.current = false;
    let smooth = 0;
    return subscribeMeter(() => {
      const data = plugin.bypass ? null : getEngine().getScopeWave(plugin.id);
      const peak = peakOf(data);
      smooth = Math.max(peak, smooth * 0.82);
      const db = 20 * Math.log10(Math.max(smooth, 0.000001));
      if (peak >= 1) heldClip.current = true;
      if (fill.current) {
        fill.current.style.width = `${Math.max(0, Math.min(100, (db + 60) / 60 * 100))}%`;
        fill.current.style.backgroundColor = levelColor(smooth);
      }
      if (readout.current) readout.current.textContent = plugin.bypass ? "BYPASS" : data && db > -60 ? `${db.toFixed(1)} dBFS` : "−∞ dBFS";
      if (clip.current) clip.current.classList.toggle("text-destructive", heldClip.current);
    });
  }, [plugin.id, plugin.bypass]);
  return <div className="flex min-w-0 items-center gap-2" aria-label={`${plugin.name} output meter`}>
    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">OUT</span>
    <div className="relative h-3 min-w-8 flex-1 overflow-hidden rounded-sm border border-border bg-background">
      <div ref={fill} className="h-full w-0" />
      <span className="absolute inset-y-0 left-[90%] border-l border-foreground/30" />
    </div>
    <span ref={readout} className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">−∞ dBFS</span>
    <Button ref={clip} variant="ghost" className="h-9 shrink-0 px-1 text-[10px] text-muted-foreground" title="Reset output clipping indicator" aria-label={`Reset ${plugin.name} clip`} onClick={() => { heldClip.current = false; }}>CLIP</Button>
  </div>;
}

export function RackEffect({ trackId, plugin: p, index, count }: { trackId: string; plugin: PluginInstance; index: number; count: number }) {
  const { togglePluginBypass, movePlugin, removePlugin, setPluginParam } = useStudio();
  const [expanded, setExpanded] = useState(true);
  const readoutParam = p.params.find(param => ["time", "cutoff", "threshold", "drive", "decay", "rate"].includes(param.id)) ?? p.params[0];
  return <section aria-label={`${p.name} rack module`} data-fx-family={effectFamily(p)} data-fx-kind={p.kind} data-fx-skin={p.kind} data-fx-variant={p.name.toLowerCase().includes("echo") ? "echo" : undefined} data-bypassed={p.bypass} className="fx-face hardware-device relative border-y border-border bg-surface">
    <div className="hardware-rack-ear pointer-events-none absolute inset-y-0 left-0 flex w-3 flex-col justify-between border-r border-border py-3 sm:w-5">
      {[0, 1].map((s) => <span key={s} className="hardware-rack-screw mx-auto size-2 rounded-full" />)}
    </div>
    <div className="hardware-rack-ear pointer-events-none absolute inset-y-0 right-0 flex w-3 flex-col justify-between border-l border-border py-3 sm:w-5">
      {[0, 1].map((s) => <span key={s} className="hardware-rack-screw mx-auto size-2 rounded-full" />)}
    </div>
    <div className="fx-rack-vents" aria-hidden="true" />
    <div className="fx-module-body mx-3 sm:mx-5">
      <header className="hardware-device-header flex flex-wrap items-center gap-1 border-b border-border px-2 py-2">
        <Button size="icon" variant="ghost" className={`size-10 shrink-0 ${p.bypass ? "text-muted-foreground" : "text-primary"}`} aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name}`} aria-pressed={!p.bypass} title="Enable / bypass effect" onClick={() => togglePluginBypass(trackId, p.id)}><Power className="size-4" /></Button>
        <div className="fx-nameplate min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{String(index + 1).padStart(2, "0")} · {effectBrand(p)}</h3><span className="font-mono text-[9px] text-muted-foreground">SYNCLAB · {p.name} · {effectCategory(p.kind)}</span></div>
        {readoutParam && p.kind !== "paraeq" && <div className="fx-parameter-window" aria-label={`${p.name} ${readoutParam.name} readout`}><span>{readoutParam.name}</span><strong>{Number(readoutParam.value.toFixed(2))}<small>{readoutParam.unit}</small></strong></div>}
        <div className="ml-auto flex shrink-0">
          <Button size="icon" variant="ghost" className="size-10" disabled={index === 0} title="Move effect up" aria-label={`Move ${p.name} up`} onClick={() => movePlugin(trackId, p.id, -1)}><ChevronUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" disabled={index === count - 1} title="Move effect down" aria-label={`Move ${p.name} down`} onClick={() => movePlugin(trackId, p.id, 1)}><ChevronDown className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" title="Remove effect" aria-label={`Remove ${p.name}`} onClick={() => removePlugin(trackId, p.id)}><Trash2 className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" title={expanded ? "Fold controls" : "Expand controls"} aria-label={`${expanded ? "Fold" : "Expand"} ${p.name} controls`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button>
        </div>
      </header>
      <EffectPresetMenu plugin={p} onParam={(id, value) => setPluginParam(trackId, p.id, id, value)} />
       <div className="fx-output-strip mx-2 py-1"><RackMeter plugin={p} /></div>
      {expanded && (p.kind === "paraeq" ? <div className="min-w-0 border-t border-border p-2"><ProEq trackId={trackId} plugin={p} /></div> : p.kind === "eq" ? <div className="min-w-0 space-y-2 border-t border-border p-2"><EffectDisplay plugin={p} height={200} onParam={(id, value) => setPluginParam(trackId, p.id, id, value)} /><div className="flex flex-wrap justify-center gap-2">{p.params.filter(param => param.id !== "low" && param.id !== "mid" && param.id !== "high").map(param => <Knob key={param.id} label={param.name} value={param.value} min={param.min} max={param.max} step={1} unit={param.unit ? ` ${param.unit}` : ""} size={48} onChange={value => setPluginParam(trackId, p.id, param.id, value)} midiTarget={{ id: trackId, param: `plugin:${p.id}:${param.id}` }} />)}</div></div> : p.kind === "vocoder" ? <div className="fx-control-deck"><VocoderPanel trackId={trackId} plugin={p} /></div> : <EffectWorkbench plugin={p} midiId={trackId} onParam={(id, value) => setPluginParam(trackId, p.id, id, value)} />)}
    </div>
  </section>;
}