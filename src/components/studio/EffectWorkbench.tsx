import { useState } from "react";
import type { PluginInstance, PluginParam } from "@/lib/synclab/types";
import { withDefaultParams } from "@/lib/synclab/plugins";
import { Knob } from "./Knob";
import { EffectDisplay } from "./EffectDisplay";
import { Scope } from "./Scope";
import { XYPad } from "./XYPad";
import { Button } from "@/components/ui/button";

export function effectFamily(plugin: PluginInstance) {
  if (plugin.kind === "delay") return plugin.name.toLowerCase().includes("echo") ? "sequence" : "buffer";
  if (["reverb", "resonator"].includes(plugin.kind)) return "space";
  if (["stepfilter", "bitcrusher", "scalechord"].includes(plugin.kind)) return "sequence";
  if (["compressor", "limiter", "gate", "transient"].includes(plugin.kind)) return "dynamics";
  if (["chorus", "flanger", "phaser", "tremolo", "autopan", "width"].includes(plugin.kind)) return "motion";
  return "tone";
}

/** Same parameters and signal taps in rack and mixer, with distinct physical section layouts. */
export function EffectWorkbench({ plugin, onParam, midiId, midiPrefix = "plugin" }: {
  plugin: PluginInstance; onParam: (id: string, value: number) => void; midiId: string; midiPrefix?: string;
}) {
  const [motion, setMotion] = useState(false);
  const family = effectFamily(plugin);
  const params = withDefaultParams(plugin);
  const isStep = (p: PluginParam) => /^s\d+$/.test(p.id);
  const outputIds = ["mix", "output", "makeup", "gain", "pan", "width"];
  const inputIds = ["input", "lowcut", "tone", "predelay", "threshold", "ceiling", "bits", "root"];
  const input = params.filter(p => inputIds.includes(p.id));
  const output = params.filter(p => outputIds.includes(p.id));
  const core = params.filter(p => !inputIds.includes(p.id) && !outputIds.includes(p.id) && !isStep(p));
  const steps = params.filter(isStep);
  const heading = family === "space" ? "REFLECTIONS" : family === "buffer" ? "ECHO ENGINE" : family === "dynamics" ? "ENVELOPE" : family === "sequence" ? "CLOCK & SHAPE" : family === "motion" ? "MODULATION" : "COLOR ENGINE";
  const controls = (items: PluginParam[], title: string, section: string) => items.length > 0 && <div className={`fx-section fx-section-${section}`}>
    <h4>{title}</h4><div className="fx-section-knobs">{items.map(p => <Knob key={p.id} label={p.name} value={p.value} min={p.min} max={p.max} step={(p.max - p.min) / 200} unit={p.unit ? ` ${p.unit}` : ""} size={section === "core" ? 60 : 44} onChange={v => onParam(p.id, v)} midiTarget={{ id: midiId, param: `${midiPrefix}:${plugin.id}:${p.id}` }} />)}</div>
  </div>;
  return <div className="fx-workbench" data-fx-family={family}>
    {controls(input, family === "dynamics" ? "DETECTOR" : "INPUT FILTER", "input")}
    <div className="fx-section fx-section-display"><h4>{family === "buffer" ? "DELAY BUFFER" : family === "space" ? "SPACE RESPONSE" : family === "sequence" ? "PATTERN RESPONSE" : "SIGNAL RESPONSE"}</h4>
      <EffectDisplay plugin={plugin} height={140} onParam={onParam} />
      <Scope scopeId={plugin.bypass ? `bypassed:${plugin.id}` : plugin.id} height={40} />
    </div>
    {controls(output, "OUTPUT & BLEND", "output")}
    {controls(core, heading, "core")}
    {steps.length > 0 && <div className="fx-section fx-section-steps"><h4>STEP LEVELS</h4><div className="fx-step-faders">{steps.map((p, i) => <label key={p.id}><input type="range" aria-label={p.name} min={p.min} max={p.max} step={0.01} value={p.value} onChange={e => onParam(p.id, Number(e.target.value))} /><span>{i + 1}</span></label>)}</div></div>}
    <div className="fx-workbench-footer"><span>SYNCLAB · {plugin.kind.toUpperCase()}</span><Button variant="ghost" size="sm" aria-pressed={motion} onClick={() => setMotion(v => !v)}>X / Y</Button></div>
    {motion && <div className="fx-section fx-section-motion"><XYPad plugin={plugin} onParam={onParam} /></div>}
  </div>;
}