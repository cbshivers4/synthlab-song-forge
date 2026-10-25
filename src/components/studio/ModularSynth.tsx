import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { canvasPoint } from "@/lib/synclab/canvas-point";
import { useStudio } from "@/lib/synclab/store";
import {
  CABLE_COLORS, MODULAR_PRESETS, initModularPatch, MODULE_DEFS, cableId, newModule, normalizeModular,
  type CableColor, type ModModule, type ModuleType, type ModularPatch, type PortRef,
} from "@/lib/synclab/modular";
import type { SynthPatch, Track } from "@/lib/synclab/types";
import { MODULAR_SCOPE_TYPES } from '@/lib/synclab/modular-scopes';
import { ModularScope } from './ModularScope';
import { PresetNavigator } from './PresetNavigator';
import { HardwareBypass } from './HardwareBypass';

const SHORT: Record<string, string> = { sine: "SIN", triangle: "TRI", sawtooth: "SAW", square: "SQR", lowpass: "LP", highpass: "HP", bandpass: "BP", white: "WHT", pink: "PNK" };
const pkey = (p: PortRef) => `${p.module}|${p.port}`;
const DEVICE_SERIES: Partial<Record<ModuleType, string>> = {
  sub: "S-01 • ANALOG LOW END", formant: "VF-03 • RESONANT VOICE", phaser: "PA-04 • FOUR STAGES",
  compressor: "D-05 • DYNAMICS PROCESSOR", stereo: "SM-02 • PAN MODULATOR", attenuverter: "CV-02 • BIPOLAR UTILITY",
};

/** Empty Eurorack-style case: add devices, then tap an output jack and an input jack to run a coloured cable. */
export function ModularSynth({ track }: { track: Track }) {
  const { updatePatch, previewNote } = useStudio();
  const patch = track.patch as SynthPatch;
  const m: ModularPatch = normalizeModular(patch.modular);
  const [pending, setPending] = useState<PortRef | null>(null);
  const [rackPreset, setRackPreset] = useState("");
  const [color, setColor] = useState<CableColor>("red");
  const boxRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<{ id: string; d: string; color: CableColor; a: { x: number; y: number }; b: { x: number; y: number } }[]>([]);

  const save = (next: ModularPatch) => updatePatch(track.id, { modular: next });
  const selectRackPreset = (name: string) => {
    const preset = MODULAR_PRESETS.find(p => p.name === name);
    if (!preset) return;
    const modular = structuredClone(preset.modular);
    setRackPreset(name);
    setPending(null);
    save(modular);
    previewNote(track.id, 48, 0.75, false, { ...patch, modular });
  };
  const label = (p: PortRef) => {
    const mod = m.modules.find((x) => x.id === p.module);
    if (!mod) return p.port;
    const def = MODULE_DEFS[mod.type];
    const idx = m.modules.filter((x) => x.type === mod.type).indexOf(mod) + 1;
    const port = [...def.inputs, ...def.outputs].find((x) => x.id === p.port)?.label ?? p.port;
    return `${def.label} ${idx} ${port}`;
  };

  const addModule = (type: ModuleType) => save({ ...m, modules: [...m.modules, newModule(type)] });
  const removeModule = (id: string) => save({ ...m, modules: m.modules.filter((x) => x.id !== id), cables: m.cables.filter((c) => c.from.module !== id && c.to.module !== id) });
  const moveModule = (id: string, dir: -1 | 1) => {
    const i = m.modules.findIndex((x) => x.id === id), j = i + dir;
    if (j < 0 || j >= m.modules.length) return;
    const mods = [...m.modules];
    const current = mods[i], neighbor = mods[j];
    if (!current || !neighbor) return;
    mods[i] = neighbor; mods[j] = current;
    save({ ...m, modules: mods });
  };
  const setParam = (id: string, k: string, v: number | string) => save({ ...m, modules: m.modules.map((x) => (x.id === id ? { ...x, params: { ...x.params, [k]: v } } : x)) });
  const connect = (to: PortRef) => {
    if (!pending) return;
    if (pending.module === to.module) return setPending(null);
    if (!m.cables.some((c) => pkey(c.from) === pkey(pending) && pkey(c.to) === pkey(to)))
      save({ ...m, cables: [...m.cables, { id: cableId(), from: pending, to, amount: 0.8, color }] });
    setPending(null);
    previewNote(track.id, 48);
  };

  useLayoutEffect(() => {
    const draw = () => {
      const box = boxRef.current;
      const layer = cableRef.current;
      if (!box || !layer) return;
      const r = layer.getBoundingClientRect();
      const origin = canvasPoint(r.left + r.width / 2, r.top + r.height / 2);
      const pos = (p: PortRef) => {
        const el = box.querySelector<HTMLElement>(`[data-jack="${CSS.escape(pkey(p))}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const center = canvasPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { x: center.x - origin.x + box.clientWidth / 2, y: center.y - origin.y + box.clientHeight / 2 };
      };
      setLines(m.cables.flatMap((c) => {
        const a = pos(c.from), b = pos(c.to);
        if (!a || !b) return [];
        const sag = Math.min(40 + Math.abs(a.x - b.x) * 0.15 + Math.abs(a.y - b.y) * 0.1, Math.max(12, box.clientHeight - Math.max(a.y, b.y) - 10));
        return [{ id: c.id, color: c.color, a, b, d: `M${a.x},${a.y} C${a.x},${a.y + sag} ${b.x},${b.y + sag} ${b.x},${b.y}` }];
      }));
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", draw);
    return () => { ro.disconnect(); window.removeEventListener("resize", draw); };
  }, [patch.modular]);

  const jack = (p: PortRef, out: boolean, text: string) => {
    const isPending = !!pending && pkey(pending) === pkey(p);
    return (
      <div key={p.port + (out ? "o" : "i")} className="flex flex-col items-center gap-0.5">
        <Button variant="ghost"
          type="button"
          data-jack={pkey(p)}
          aria-label={`${label(p)}${out ? " output — pick to start a cable" : " input — connect cable here"}`}
          aria-pressed={out ? isPending : undefined}
          onClick={() => (out ? setPending(isPending ? null : p) : connect(p))}
          className={`modular-jack ${out ? "is-out" : "is-in"} ${isPending ? "is-pending" : ""} ${!out && pending && pending.module !== p.module ? "is-target" : ""}`}
        />
        <span className="modular-jack-label">{text}</span>
      </div>
    );
  };

  const renderDevice = (mod: ModModule, index: number) => {
    const def = MODULE_DEFS[mod.type];
    const num = m.modules.filter((x) => x.type === mod.type).indexOf(mod) + 1;
    return (
      <div key={mod.id} className="modular-module" data-module-type={mod.type} data-module-width={def.hp}>
        <div className="modular-module-header flex w-full items-center justify-between gap-1">
          <Button variant="ghost" type="button" aria-label={`Move ${def.label} ${num} left`} disabled={index === 0} onClick={() => moveModule(mod.id, -1)} className="modular-screw"><ChevronLeft className="size-3" /></Button>
          <h4>{def.label} {num}</h4>
          <Button variant="ghost" type="button" aria-label={`Move ${def.label} ${num} right`} disabled={index === m.modules.length - 1} onClick={() => moveModule(mod.id, 1)} className="modular-screw"><ChevronRight className="size-3" /></Button>
        </div>
        {DEVICE_SERIES[mod.type] && <div className="modular-model-plate">{DEVICE_SERIES[mod.type]}</div>}
        {MODULAR_SCOPE_TYPES.includes(mod.type) && <ModularScope trackId={track.id} moduleId={mod.id} label={`${def.label} ${num}`} />}
        {(mod.type === "phaser" || mod.type === "stereo") && <output className="modular-rate-window" aria-label={`${def.label} rate`}>{Number(mod.params["rate"] ?? 0).toFixed(2)} <small>Hz</small></output>}
        {def.params.map((p) =>
          p.options ? (
            <div key={p.id} className="flex flex-wrap justify-center gap-0.5" role="group" aria-label={p.label}>
              {p.options.map((o) => (
                <Button variant="ghost" key={o} type="button" aria-pressed={(mod.params[p.id] ?? p.def) === o} onClick={() => setParam(mod.id, p.id, o)} className={`modular-switch ${(mod.params[p.id] ?? p.def) === o ? "is-on" : ""}`}>{SHORT[o] ?? o}</Button>
              ))}
            </div>
          ) : null,
        )}
        <div className="modular-knob-bank flex flex-wrap justify-center gap-1">
          {def.params.filter((p) => !p.options).map((p) => (
            <Knob key={p.id} label={p.label} size={42} min={p.min ?? 0} max={p.max ?? 1} step={p.step ?? 0.01} unit={p.unit ?? ""} value={Number(mod.params[p.id] ?? p.def)} onChange={(v) => setParam(mod.id, p.id, v)} />
          ))}
        </div>
        <div className="modular-jacks">
          {def.inputs.map((i) => jack({ module: mod.id, port: i.id }, false, i.label))}
          {def.outputs.map((o) => jack({ module: mod.id, port: o.id }, true, o.label))}
        </div>
        <div className="modular-device-actions">
          <Button variant="ghost" type="button" title={`Reset ${def.label} controls`} aria-label={`Reset ${def.label} ${num} controls`} onClick={() => save({ ...m, modules: m.modules.map(x => x.id === mod.id ? { ...x, params: Object.fromEntries(def.params.map(p => [p.id, p.def])) } : x) })} className="modular-screw"><RotateCcw className="size-3" /></Button>
          <Button variant="ghost" type="button" title={`Remove ${def.label}`} aria-label={`Remove ${def.label} ${num} from rack`} onClick={() => removeModule(mod.id)} className="modular-screw"><Trash2 className="size-3" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="modular-workstation space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Patched rack presets">
        <span className="label-xs mr-1">PRESET RACKS</span>
        <HardwareBypass track={track} name="Modular Tech" />
        <PresetNavigator label="modular rack preset" options={MODULAR_PRESETS.map(p => p.name)} current={rackPreset} onSelect={selectRackPreset}>
          <span className="max-w-48 truncate font-mono text-xs text-primary" aria-live="polite">{rackPreset.replace("Modular Tech ", "") || "Custom rack"}</span>
        </PresetNavigator>
        <Button variant="ghost" type="button" aria-label="Initialize modular patch" onClick={() => {
          const modular = initModularPatch();
          setRackPreset("");
          setPending(null);
          save(modular);
          previewNote(track.id, 48, 0.75, false, { ...patch, modular });
        }} className="modular-add font-bold">INITIALIZE</Button>
        {MODULAR_PRESETS.map((p) => (
          <Button variant="ghost" key={p.name} type="button" onClick={() => selectRackPreset(p.name)} className="modular-add">
            {p.name.replace("Modular Tech ", "")}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Add devices to the rack">
        <span className="label-xs mr-1">ADD DEVICE</span>
        {(Object.keys(MODULE_DEFS) as ModuleType[]).map((t) => (
          <Button variant="ghost" key={t} type="button" onClick={() => addModule(t)} className="modular-add"><Plus className="size-3" />{MODULE_DEFS[t].label}</Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cable colour">
        <span className="label-xs mr-1">CABLE COLOUR</span>
        {CABLE_COLORS.map((c) => (
          <Button variant="ghost" key={c} type="button" role="radio" aria-checked={color === c} aria-label={`${c} cable`} onClick={() => setColor(c)} className={`modular-swatch cable-${c} ${color === c ? "is-on" : ""}`} />
        ))}
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {pending ? `Cable from ${label(pending)} — tap a glowing input.` : "Tap an output jack (ringed), then an input jack."}
        </span>
        {pending && <Button variant="ghost" type="button" className="modular-add" onClick={() => setPending(null)}>CANCEL</Button>}
      </div>

      <div ref={boxRef} className="modular-case relative" aria-label="Modular Tech Synth case">
        <div className="modular-rail" aria-hidden />
        {m.modules.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-6 text-center font-mono text-xs text-muted-foreground">
            EMPTY RACK — add devices above (start with VCO, VCA, ENVELOPE and OUTPUT), then patch them with cables.
          </div>
        ) : (
          <div className="modular-module-grid">
            {m.modules.map(renderDevice)}
          </div>
        )}
        <div className="modular-rail" aria-hidden />
        <svg ref={cableRef} className="modular-cable-layer pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id}>
              <path d={l.d} className="modular-cable-shadow" />
              <path d={l.d} className={`modular-cable cable-${l.color}`} />
              <path d={l.d} className="modular-cable-sheen" />
              {[l.a, l.b].map((p, i) => <g key={i} className={`cable-${l.color}`}><circle cx={p.x} cy={p.y + 6} r="5" className="modular-plug-boot" /><circle cx={p.x} cy={p.y} r="6" className="modular-plug" /></g>)}
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-1" aria-label="Patch cables">
        <div className="flex items-center gap-2">
          <h4 className="label-xs">CABLES ({m.cables.length})</h4>
          {m.cables.length > 0 && <Button variant="ghost" type="button" className="modular-add ml-auto" onClick={() => save({ ...m, cables: [] })}>UNPLUG ALL</Button>}
        </div>
        {m.cables.length === 0 && <p className="text-[11px] text-muted-foreground">No cables — nothing reaches an OUTPUT, so the synth is silent.</p>}
        {m.cables.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className={`modular-swatch small cable-${c.color}`} aria-hidden />
            <span className="min-w-48">{label(c.from)} → {label(c.to)}</span>
            <select aria-label="Cable colour" value={c.color} onChange={(e) => save({ ...m, cables: m.cables.map((x) => (x.id === c.id ? { ...x, color: e.target.value as CableColor } : x)) })} className="rounded-[3px] border border-border bg-surface px-1 py-0.5">
              {CABLE_COLORS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input type="range" aria-label={`Cable amount ${label(c.from)} to ${label(c.to)}`} min={-1} max={2} step={0.01} value={c.amount}
              onChange={(e) => save({ ...m, cables: m.cables.map((x) => (x.id === c.id ? { ...x, amount: Number(e.target.value) } : x)) })} className="w-28 accent-primary" />
            <span className="w-10 tabular-nums">{c.amount.toFixed(2)}</span>
            <Button variant="ghost" type="button" aria-label={`Unplug ${label(c.from)} to ${label(c.to)}`} onClick={() => save({ ...m, cables: m.cables.filter((x) => x.id !== c.id) })} className="rounded-[3px] border border-border p-0.5 hover:border-destructive"><X className="size-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
