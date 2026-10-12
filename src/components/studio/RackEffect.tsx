import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { levelColor, peakOf } from "@/lib/synclab/level-colors";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance } from "@/lib/synclab/types";
import { EffectDisplay } from "./EffectDisplay";
import { Scope } from "./Scope";
import { Knob } from "./Knob";
import { XYPad } from "./XYPad";
import { ProEq } from "./ProEq";
import { VocoderPanel } from "./VocoderPanel";

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
  return <section aria-label={`${p.name} rack module`} className="relative border-y border-border bg-surface">
    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-3 flex-col justify-between border-r border-border bg-surface-2 py-3 sm:w-5">
      {[0, 1].map((s) => <span key={s} className="mx-auto size-1.5 rounded-full border border-muted-foreground/60 bg-background" />)}
    </div>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-3 flex-col justify-between border-l border-border bg-surface-2 py-3 sm:w-5">
      {[0, 1].map((s) => <span key={s} className="mx-auto size-1.5 rounded-full border border-muted-foreground/60 bg-background" />)}
    </div>
    <div className="mx-3 sm:mx-5">
      <header className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2">
        <Button size="icon" variant="ghost" className={`size-10 shrink-0 ${p.bypass ? "text-muted-foreground" : "text-primary"}`} aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name}`} aria-pressed={!p.bypass} title="Enable / bypass effect" onClick={() => togglePluginBypass(trackId, p.id)}><Power className="size-4" /></Button>
        <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{String(index + 1).padStart(2, "0")} · {p.name}</h3><span className="font-mono text-[9px] text-muted-foreground">{p.format} · {p.kind.toUpperCase()}</span></div>
        <div className="ml-auto flex shrink-0">
          <Button size="icon" variant="ghost" className="size-10" disabled={index === 0} title="Move effect up" aria-label={`Move ${p.name} up`} onClick={() => movePlugin(trackId, p.id, -1)}><ChevronUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" disabled={index === count - 1} title="Move effect down" aria-label={`Move ${p.name} down`} onClick={() => movePlugin(trackId, p.id, 1)}><ChevronDown className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" title="Remove effect" aria-label={`Remove ${p.name}`} onClick={() => removePlugin(trackId, p.id)}><Trash2 className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-10" title={expanded ? "Fold controls" : "Expand controls"} aria-label={`${expanded ? "Fold" : "Expand"} ${p.name} controls`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button>
        </div>
      </header>
      <div className="px-2 pb-2"><RackMeter plugin={p} />
        <Scope scopeId={p.bypass ? `bypassed:${p.id}` : p.id} height={88} />
      </div>
      {expanded && <div className="grid min-w-0 gap-4 border-t border-border p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3"><EffectDisplay plugin={p} height={160} onParam={(id, value) => setPluginParam(trackId, p.id, id, value)} /><XYPad trackId={trackId} plugin={p} /></div>
        <div className="min-w-0">
          {p.kind === "paraeq" ? <ProEq trackId={trackId} plugin={p} /> : p.kind === "vocoder" ? <VocoderPanel trackId={trackId} plugin={p} /> : <div className="flex flex-wrap justify-center gap-3">{p.params.map((param) => <Knob key={param.id} label={param.name} value={param.value} min={param.min} max={param.max} step={param.max - param.min > 40 ? 1 : (param.max - param.min) / 200} unit={param.unit ? ` ${param.unit}` : ""} size={52} onChange={(value) => setPluginParam(trackId, p.id, param.id, value)} midiTarget={{ id: trackId, param: `plugin:${p.id}:${param.id}` }} />)}</div>}
        </div>
      </div>}
    </div>
  </section>;
}