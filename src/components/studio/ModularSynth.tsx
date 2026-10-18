import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import {
  CABLE_COLORS, MODULAR_PRESETS, MODULE_DEFS, cableId, newModule, normalizeModular,
  type CableColor, type ModModule, type ModuleType, type ModularPatch, type PortRef,
} from "@/lib/synclab/modular";
import type { SynthPatch, Track } from "@/lib/synclab/types";

const SHORT: Record<string, string> = { sine: "SIN", triangle: "TRI", sawtooth: "SAW", square: "SQR", lowpass: "LP", highpass: "HP", bandpass: "BP", white: "WHT", pink: "PNK" };
const pkey = (p: PortRef) => `${p.module}|${p.port}`;

/** Empty Eurorack-style case: add devices, then tap an output jack and an input jack to run a coloured cable. */
export function ModularSynth({ track }: { track: Track }) {
  const { updatePatch, previewNote } = useStudio();
  const patch = track.patch as SynthPatch;
  const m: ModularPatch = normalizeModular(patch.modular);
  const [pending, setPending] = useState<PortRef | null>(null);
  const [color, setColor] = useState<CableColor>("red");
  const boxRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ id: string; d: string; color: CableColor }[]>([]);

  const save = (next: ModularPatch) => updatePatch(track.id, { modular: next });
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
    const mods = [...m.modules]; [mods[i], mods[j]] = [mods[j]!, mods[i]!];
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
      if (!box) return;
      const r = box.getBoundingClientRect();
      const pos = (p: PortRef) => {
        const el = box.querySelector<HTMLElement>(`[data-jack="${CSS.escape(pkey(p))}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
      };
      setLines(m.cables.flatMap((c) => {
        const a = pos(c.from), b = pos(c.to);
        if (!a || !b) return [];
        const sag = 40 + Math.abs(a.x - b.x) * 0.15 + Math.abs(a.y - b.y) * 0.1;
        return [{ id: c.id, color: c.color, d: `M${a.x},${a.y} C${a.x},${a.y + sag} ${b.x},${b.y + sag} ${b.x},${b.y}` }];
      }));
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [patch.modular]);

  const jack = (p: PortRef, out: boolean, text: string) => {
    const isPending = !!pending && pkey(pending) === pkey(p);
    return (
      <div key={p.port + (out ? "o" : "i")} className="flex flex-col items-center gap-0.5">
        <button
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

  const Device = ({ mod, index }: { mod: ModModule; index: number }) => {
    const def = MODULE_DEFS[mod.type];
    const num = m.modules.filter((x) => x.type === mod.type).indexOf(mod) + 1;
    return (
      <div className="modular-module" data-module-type={mod.type}>
        <div className="flex w-full items-center justify-between gap-1">
          <button type="button" aria-label={`Move ${def.label} ${num} left`} disabled={index === 0} onClick={() => moveModule(mod.id, -1)} className="modular-screw"><ChevronLeft className="size-3" /></button>
          <h4>{def.label} {num}</h4>
          <button type="button" aria-label={`Move ${def.label} ${num} right`} disabled={index === m.modules.length - 1} onClick={() => moveModule(mod.id, 1)} className="modular-screw"><ChevronRight className="size-3" /></button>
        </div>
        {def.params.map((p) =>
          p.options ? (
            <div key={p.id} className="flex flex-wrap justify-center gap-0.5" role="group" aria-label={p.label}>
              {p.options.map((o) => (
                <button key={o} type="button" aria-pressed={mod.params[p.id] === o} onClick={() => setParam(mod.id, p.id, o)} className={`modular-switch ${mod.params[p.id] === o ? "is-on" : ""}`}>{SHORT[o] ?? o}</button>
              ))}
            </div>
          ) : null,
        )}
        <div className="flex flex-wrap justify-center gap-1">
          {def.params.filter((p) => !p.options).map((p) => (
            <Knob key={p.id} label={p.label} size={34} min={p.min ?? 0} max={p.max ?? 1} step={p.step ?? 0.01} unit={p.unit ?? ""} value={Number(mod.params[p.id] ?? p.def)} onChange={(v) => setParam(mod.id, p.id, v)} />
          ))}
        </div>
        <div className="modular-jacks">
          {def.inputs.map((i) => jack({ module: mod.id, port: i.id }, false, i.label))}
          {def.outputs.map((o) => jack({ module: mod.id, port: o.id }, true, o.label))}
        </div>
        <button type="button" aria-label={`Remove ${def.label} ${num} from rack`} onClick={() => removeModule(mod.id)} className="modular-screw mt-1"><Trash2 className="size-3" /></button>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Patched rack presets">
        <span className="label-xs mr-1">PRESET RACKS</span>
        {MODULAR_PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => { setPending(null); save(structuredClone(p.modular)); previewNote(track.id, 48); }} className="modular-add">
            {p.name.replace("Modular Tech ", "")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Add devices to the rack">
        <span className="label-xs mr-1">ADD DEVICE</span>
        {(Object.keys(MODULE_DEFS) as ModuleType[]).map((t) => (
          <button key={t} type="button" onClick={() => addModule(t)} className="modular-add"><Plus className="size-3" />{MODULE_DEFS[t].label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cable colour">
        <span className="label-xs mr-1">CABLE COLOUR</span>
        {CABLE_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`${c} cable`} onClick={() => setColor(c)} className={`modular-swatch cable-${c} ${color === c ? "is-on" : ""}`} />
        ))}
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {pending ? `Cable from ${label(pending)} — tap a glowing input.` : "Tap an output jack (ringed), then an input jack."}
        </span>
        {pending && <button type="button" className="modular-add" onClick={() => setPending(null)}>CANCEL</button>}
      </div>

      <div ref={boxRef} className="modular-case relative" aria-label="Modular Tech Synth case">
        <div className="modular-rail" aria-hidden />
        {m.modules.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-6 text-center font-mono text-xs text-muted-foreground">
            EMPTY RACK — add devices above (start with VCO, VCA, ENVELOPE and OUTPUT), then patch them with cables.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 p-2">
            {m.modules.map((mod, i) => <Device key={mod.id} mod={mod} index={i} />)}
          </div>
        )}
        <div className="modular-rail" aria-hidden />
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id}>
              <path d={l.d} className="modular-cable-shadow" />
              <path d={l.d} className={`modular-cable cable-${l.color}`} />
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-1" aria-label="Patch cables">
        <div className="flex items-center gap-2">
          <h4 className="label-xs">CABLES ({m.cables.length})</h4>
          {m.cables.length > 0 && <button type="button" className="modular-add ml-auto" onClick={() => save({ ...m, cables: [] })}>UNPLUG ALL</button>}
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
            <button type="button" aria-label={`Unplug ${label(c.from)} to ${label(c.to)}`} onClick={() => save({ ...m, cables: m.cables.filter((x) => x.id !== c.id) })} className="rounded-[3px] border border-border p-0.5 hover:border-destructive"><X className="size-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
