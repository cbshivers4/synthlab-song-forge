import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { IN_JACKS, OUT_JACKS, cableId, defaultModular, type ModInJack, type ModOutJack, type ModularPatch } from "@/lib/synclab/modular";
import type { SynthPatch, Track } from "@/lib/synclab/types";

const WAVES: OscillatorType[] = ["sine", "triangle", "sawtooth", "square"];
const WAVE_LABEL: Record<string, string> = { sine: "SIN", triangle: "TRI", sawtooth: "SAW", square: "SQR" };
const jackLabel = (id: string) => [...OUT_JACKS, ...IN_JACKS].find((j) => j.id === id)?.label ?? id;

/** Patchable Eurorack-style panel. Click an output jack, then an input jack, to run a cable. */
export function ModularSynth({ track }: { track: Track }) {
  const { updatePatch, previewNote } = useStudio();
  const patch = track.patch as SynthPatch;
  const m: ModularPatch = patch.modular ?? defaultModular();
  const [pending, setPending] = useState<ModOutJack | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ id: string; d: string; hue: number }[]>([]);

  const set = (next: Partial<ModularPatch>) => updatePatch(track.id, { modular: { ...m, ...next } });
  const mod = <K extends keyof ModularPatch>(k: K, v: Partial<ModularPatch[K]>) => set({ [k]: { ...(m[k] as object), ...v } } as Partial<ModularPatch>);

  const connect = (to: ModInJack) => {
    if (!pending) return;
    if (m.cables.some((c) => c.from === pending && c.to === to)) return setPending(null);
    set({ cables: [...m.cables, { id: cableId(), from: pending, to, amount: 0.7 }] });
    setPending(null);
    previewNote(track.id, 48);
  };

  useLayoutEffect(() => {
    const draw = () => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const pos = (id: string) => {
        const el = box.querySelector<HTMLElement>(`[data-jack="${id}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
      };
      setLines(m.cables.flatMap((c, i) => {
        const a = pos(c.from), b = pos(c.to);
        if (!a || !b) return [];
        const sag = 40 + Math.abs(a.x - b.x) * 0.15;
        return [{ id: c.id, d: `M${a.x},${a.y} C${a.x},${a.y + sag} ${b.x},${b.y + sag} ${b.x},${b.y}`, hue: (i * 67 + 20) % 360 }];
      }));
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [m.cables]);

  const Jack = ({ id, out }: { id: string; out?: boolean }) => (
    <button
      type="button"
      data-jack={id}
      aria-label={`${jackLabel(id)}${out ? " — pick to start a cable" : " — connect cable here"}`}
      aria-pressed={out ? pending === id : undefined}
      onClick={() => (out ? setPending(pending === id ? null : (id as ModOutJack)) : connect(id as ModInJack))}
      className={`modular-jack ${out ? "is-out" : "is-in"} ${pending === id ? "is-pending" : ""} ${!out && pending ? "is-target" : ""}`}
    >
      <span className="sr-only">{jackLabel(id)}</span>
    </button>
  );
  const JackRow = ({ id, label, out }: { id: string; label: string; out?: boolean }) => (
    <div className="flex flex-col items-center gap-0.5"><Jack id={id} out={out} /><span className="modular-jack-label">{label}</span></div>
  );
  const WaveSel = ({ value, onChange }: { value: OscillatorType; onChange: (w: OscillatorType) => void }) => (
    <div className="flex gap-0.5">{WAVES.map((w) => <button key={w} type="button" aria-pressed={value === w} onClick={() => onChange(w)} className={`modular-switch ${value === w ? "is-on" : ""}`}>{WAVE_LABEL[w]}</button>)}</div>
  );
  const Env = ({ k }: { k: "env1" | "env2" }) => (
    <div className="modular-module">
      <h4>{k === "env1" ? "ENV 1" : "ENV 2"}</h4>
      <div className="grid grid-cols-2 gap-1">
        <Knob label="ATK" size={36} min={0.001} max={3} step={0.001} value={m[k].attack} onChange={(v) => mod(k, { attack: v })} />
        <Knob label="DEC" size={36} min={0.005} max={3} step={0.005} value={m[k].decay} onChange={(v) => mod(k, { decay: v })} />
        <Knob label="SUS" size={36} min={0} max={1} value={m[k].sustain} onChange={(v) => mod(k, { sustain: v })} />
        <Knob label="REL" size={36} min={0.005} max={4} step={0.005} value={m[k].release} onChange={(v) => mod(k, { release: v })} />
      </div>
      <div className="modular-jacks"><JackRow id={k} label="OUT" out /></div>
    </div>
  );
  const Vco = ({ k }: { k: "vco1" | "vco2" }) => (
    <div className="modular-module">
      <h4>{k === "vco1" ? "VCO 1" : "VCO 2"}</h4>
      <WaveSel value={m[k].wave} onChange={(wave) => mod(k, { wave })} />
      <div className="flex gap-1">
        <Knob label="OCT" size={36} min={-3} max={3} step={1} value={m[k].octave} onChange={(v) => mod(k, { octave: v })} />
        <Knob label="FINE" size={36} min={-100} max={100} step={1} value={m[k].fine} unit="c" onChange={(v) => mod(k, { fine: v })} />
      </div>
      <div className="modular-jacks">
        <JackRow id={`${k}.pitch`} label="PITCH" />
        {k === "vco2" && <JackRow id="vco2.fm" label="FM" />}
        <JackRow id={k} label="OUT" out />
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono text-muted-foreground">
          {pending ? `Cable from ${jackLabel(pending)} — now tap a glowing input jack.` : "Tap an output jack (ringed), then an input jack, to patch a cable. Tap a cable's × below to unplug it."}
        </span>
        {pending && <button type="button" className="modular-switch" onClick={() => setPending(null)}>CANCEL</button>}
        <button type="button" className="modular-switch ml-auto" onClick={() => set({ cables: [] })}>UNPLUG ALL</button>
      </div>

      <div ref={boxRef} className="modular-case relative" aria-label="Modular Tech Synth case">
        <div className="modular-rail" aria-hidden />
        <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3 lg:grid-cols-5">
          <Vco k="vco1" />
          <Vco k="vco2" />
          <div className="modular-module">
            <h4>NOISE</h4>
            <div className="flex gap-0.5">{(["white", "pink"] as const).map((c) => <button key={c} type="button" aria-pressed={m.noise.color === c} onClick={() => mod("noise", { color: c })} className={`modular-switch ${m.noise.color === c ? "is-on" : ""}`}>{c.toUpperCase()}</button>)}</div>
            <div className="modular-jacks"><JackRow id="noise" label="OUT" out /></div>
          </div>
          <div className="modular-module">
            <h4>LFO</h4>
            <WaveSel value={m.lfo.wave} onChange={(wave) => mod("lfo", { wave })} />
            <Knob label="RATE" size={36} min={0.05} max={40} step={0.05} value={m.lfo.rate} unit="Hz" onChange={(v) => mod("lfo", { rate: v })} />
            <div className="modular-jacks"><JackRow id="lfo" label="OUT" out /></div>
          </div>
          <div className="modular-module">
            <h4>VCF</h4>
            <div className="flex gap-0.5">{(["lowpass", "highpass", "bandpass"] as const).map((t) => <button key={t} type="button" aria-pressed={m.vcf.type === t} onClick={() => mod("vcf", { type: t })} className={`modular-switch ${m.vcf.type === t ? "is-on" : ""}`}>{t.slice(0, 2).toUpperCase()}</button>)}</div>
            <div className="flex gap-1">
              <Knob label="CUTOFF" size={36} min={40} max={16000} step={10} value={m.vcf.cutoff} onChange={(v) => mod("vcf", { cutoff: v })} midiTarget={{ id: track.id, param: "modular:cutoff" }} />
              <Knob label="RES" size={36} min={0} max={25} step={0.5} value={m.vcf.resonance} onChange={(v) => mod("vcf", { resonance: v })} />
            </div>
            <div className="modular-jacks"><JackRow id="vcf.in" label="IN" /><JackRow id="vcf.cutoff" label="CV" /><JackRow id="vcf" label="OUT" out /></div>
          </div>
          <Env k="env1" />
          <Env k="env2" />
          <div className="modular-module">
            <h4>VCA</h4>
            <Knob label="BIAS" size={36} min={0} max={1} value={m.vca.bias} onChange={(v) => mod("vca", { bias: v })} />
            <div className="modular-jacks"><JackRow id="vca.in" label="IN" /><JackRow id="vca.cv" label="CV" /><JackRow id="vca" label="OUT" out /></div>
          </div>
          <div className="modular-module">
            <h4>OUTPUT</h4>
            <Knob label="LEVEL" size={36} min={0} max={1} value={m.out.level} onChange={(v) => mod("out", { level: v })} />
            <div className="modular-jacks"><JackRow id="out.in" label="IN" /><JackRow id="out.pan" label="PAN" /></div>
          </div>
        </div>
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id}>
              <path d={l.d} className="modular-cable-shadow" />
              <path d={l.d} className="modular-cable" style={{ ["--cable-hue" as string]: l.hue }} />
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-1" aria-label="Patch cables">
        <h4 className="label-xs">CABLES ({m.cables.length})</h4>
        {m.cables.length === 0 && <p className="text-[11px] text-muted-foreground">No cables — nothing reaches the OUTPUT, so the synth is silent.</p>}
        {m.cables.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className="min-w-40">{jackLabel(c.from)} → {jackLabel(c.to)}</span>
            <input type="range" aria-label={`Cable amount ${jackLabel(c.from)} to ${jackLabel(c.to)}`} min={-1} max={2} step={0.01} value={c.amount}
              onChange={(e) => set({ cables: m.cables.map((x) => (x.id === c.id ? { ...x, amount: Number(e.target.value) } : x)) })}
              className="w-32 accent-primary" />
            <span className="w-10 tabular-nums">{c.amount.toFixed(2)}</span>
            <button type="button" aria-label={`Unplug ${jackLabel(c.from)} to ${jackLabel(c.to)}`} onClick={() => set({ cables: m.cables.filter((x) => x.id !== c.id) })} className="rounded-[3px] border border-border p-0.5 hover:border-destructive"><X className="size-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
