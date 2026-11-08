import { useState } from "react";
import type { PluginInstance, PluginParam } from "@/lib/synclab/types";
import { withDefaultParams } from "@/lib/synclab/plugins";
import { Knob } from "./Knob";
import { EffectDisplay } from "./EffectDisplay";
import { Scope } from "./Scope";
import { XYPad } from "./XYPad";
import { Button } from "@/components/ui/button";
import { displayPosition, effectBrand, effectCategory, effectForm } from "@/lib/synclab/effect-catalog";

export function effectFamily(plugin: PluginInstance) {
  if (plugin.kind === "delay") return plugin.name.toLowerCase().includes("echo") ? "sequence" : "buffer";
  if (["modulator", "modfx", "unison", "ensemble", "imager", "wah", "univibe", "rotary"].includes(plugin.kind)) return "motion";
  if (plugin.kind === "analogdelay") return "buffer";
  if (plugin.kind === "springverb") return "space";
  if (plugin.kind === "pedalcomp") return "dynamics";
  if (["trigate", "sidechain"].includes(plugin.kind)) return "sequence";
  if (plugin.kind === "maximizer") return "dynamics";
  if (["reverb", "resonator"].includes(plugin.kind)) return "space";
  if (["stepfilter", "bitcrusher", "scalechord"].includes(plugin.kind)) return "sequence";
  if (["compressor", "limiter", "gate", "transient"].includes(plugin.kind)) return "dynamics";
  if (["chorus", "flanger", "phaser", "tremolo", "autopan", "width"].includes(plugin.kind)) return "motion";
  return "tone";
}

/** Same parameters and signal taps in rack and mixer, with distinct physical section layouts. */
export function EffectWorkbench({ plugin, onParam, midiId, midiPrefix = "plugin", onBypass }: {
  plugin: PluginInstance; onParam: (id: string, value: number) => void; midiId: string; midiPrefix?: string;
  /** Pedals show a stomp footswitch wired to the same bypass as the BYPASS button. */
  onBypass?: () => void;
}) {
  const [motion, setMotion] = useState(false);
  const family = effectFamily(plugin);
  const params = withDefaultParams(plugin);
  const isStep = (p: PluginParam) => /^s\d+$/.test(p.id);
  // On amps "Gain" is the preamp drive, so it sits with the tone controls, not the output.
  const outputIds = effectForm(plugin.kind) === "amp" ? ["mix", "output", "makeup", "pan", "width"] : ["mix", "output", "makeup", "gain", "pan", "width"];
  const inputIds = ["input", "lowcut", "tone", "predelay", "threshold", "ceiling", "bits", "root"];
  const input = params.filter(p => inputIds.includes(p.id));
  const output = params.filter(p => outputIds.includes(p.id));
  const core = params.filter(p => !inputIds.includes(p.id) && !outputIds.includes(p.id) && !isStep(p));
  const steps = params.filter(isStep);
  const heading = family === "space" ? "REFLECTIONS" : family === "buffer" ? "ECHO ENGINE" : family === "dynamics" ? "ENVELOPE" : family === "sequence" ? "CLOCK & SHAPE" : family === "motion" ? "MODULATION" : "COLOR ENGINE";
  const controls = (items: PluginParam[], title: string, section: string) => items.length > 0 && <div className={`fx-section fx-section-${section}`}>
    <h4>{title}</h4><div className="fx-section-knobs">{items.map(p => <Knob key={p.id} label={p.name} value={p.value} min={p.min} max={p.max} step={(p.max - p.min) / 200} unit={p.unit ? ` ${p.unit}` : ""} size={section === "core" ? 52 : 44} onChange={v => onParam(p.id, v)} midiTarget={{ id: midiId, param: `${midiPrefix}:${plugin.id}:${p.id}` }} />)}</div>
  </div>;
  return <div className="fx-workbench" data-display-pos={displayPosition(plugin)} data-fx-family={family} data-display-kind={plugin.kind} data-window-variant={plugin.name.toLowerCase().includes("echo") ? "tape" : undefined}>
    <div className="fx-section fx-section-display"><h4>{family === "buffer" ? "DELAY BUFFER" : family === "space" ? "SPACE RESPONSE" : family === "sequence" ? "PATTERN RESPONSE" : "SIGNAL RESPONSE"}</h4>
      <EffectDisplay plugin={plugin} height={112} onParam={onParam} />
      <Scope scopeId={plugin.bypass ? `bypassed:${plugin.id}` : plugin.id} height={52} effectKind={plugin.kind} />
    </div>
    <div className="fx-controls-bank">
    {controls(input, family === "dynamics" ? "DETECTOR" : "INPUT FILTER", "input")}
    {controls(core, heading, "core")}
    {controls(output, "OUTPUT & BLEND", "output")}
    </div>
    {steps.length > 0 && <div className="fx-section fx-section-steps"><h4>STEP LEVELS</h4><div className="fx-step-faders">{steps.map((p, i) => <label key={p.id}><input type="range" aria-label={p.name} min={p.min} max={p.max} step={0.01} value={p.value} onChange={e => onParam(p.id, Number(e.target.value))} /><span>{i + 1}</span></label>)}</div></div>}
    {effectForm(plugin.kind) === "pedal" && onBypass && <div className="fx-pedal-switch">
      <span className="fx-pedal-led" data-on={!plugin.bypass} aria-hidden="true" />
      <button type="button" className="fx-footswitch" aria-pressed={!plugin.bypass} aria-label={plugin.bypass ? `Stomp to turn ${plugin.name} on` : `Stomp to turn ${plugin.name} off`} title="Footswitch: turns the pedal on or off" onClick={onBypass} />
      <span className="fx-pedal-state">{plugin.bypass ? "OFF" : "ON"}</span>
    </div>}
    <div className="fx-workbench-footer"><span>SYNCLAB · {effectBrand(plugin).toUpperCase()} · {effectCategory(plugin.kind).toUpperCase()}</span><Button variant="ghost" size="sm" aria-pressed={motion} onClick={() => setMotion(v => !v)}>X / Y</Button></div>
    {motion && <div className="fx-section fx-section-motion"><XYPad plugin={plugin} onParam={onParam} /></div>}
  </div>;
}