import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance } from "@/lib/synclab/types";

const CARRIERS = ["Saw bank", "Pulse bank", "Noise"];
const PRESETS: { name: string; values: Record<string, number> }[] = [
  { name: "Classic 70s", values: { bands: 16, carrier: 0, pitch: 110, detune: 14, formant: 0, response: 18, sense: 1.4, sibilance: 0.35, mix: 1 } },
  { name: "Robot Choir", values: { bands: 20, carrier: 0, pitch: 82, detune: 28, formant: -3, response: 45, sense: 1.8, sibilance: 0.2, mix: 1 } },
  { name: "Electro Funk", values: { bands: 12, carrier: 1, pitch: 147, detune: 8, formant: 2, response: 10, sense: 2.2, sibilance: 0.5, mix: 1 } },
  { name: "Detroit Talkbox", values: { bands: 24, carrier: 0, pitch: 65, detune: 20, formant: 4, response: 8, sense: 2.6, sibilance: 0.6, mix: 1 } },
  { name: "Whisper Wind", values: { bands: 18, carrier: 2, pitch: 110, detune: 0, formant: 0, response: 30, sense: 1.6, sibilance: 0.7, mix: 0.9 } },
];

function Knob({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string | undefined;
  onChange: (v: number) => void;
}) {
  const step = max - min > 40 ? 1 : (max - min) / 200;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <Slider className="flex-1" min={min} max={max} step={step} value={[value]} onValueChange={([v = value]) => onChange(v)} />
      <span className="w-16 shrink-0 text-right font-mono text-[10px] text-primary">
        {value >= 100 ? value.toFixed(0) : value.toFixed(2)}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

/** Vintage channel vocoder editor: voice on this channel modulates an internal carrier. */
export function VocoderPanel({ trackId, plugin }: { trackId: string; plugin: PluginInstance }) {
  const { setPluginParam } = useStudio();
  const get = (id: string, fb: number) => plugin.params.find((p) => p.id === id)?.value ?? fb;
  const set = (id: string, v: number) => setPluginParam(trackId, plugin.id, id, v);
  const carrier = Math.round(get("carrier", 0));
  const bands = Math.round(get("bands", 16));

  return (
    <div className="space-y-3 rounded-sm border border-border bg-[linear-gradient(180deg,hsl(35_18%_18%),hsl(28_14%_11%))] p-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.2em] text-amber-200/80 uppercase">VX-16 · Analysis / Synthesis</div>
        <div className="flex gap-1">
          {Array.from({ length: bands }).map((_, i) => (
            <span key={i} className="h-3 w-1 rounded-[1px] bg-amber-300/30" />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((pr) => (
          <button
            key={pr.name}
            onClick={() => Object.entries(pr.values).forEach(([k, v]) => set(k, v))}
            className="h-6 rounded-sm border border-amber-300/30 px-2 font-mono text-[9px] uppercase text-amber-100/80 hover:bg-amber-300/10"
          >
            {pr.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Carrier</span>
        <div className="flex gap-1">
          {CARRIERS.map((c, i) => (
            <button
              key={c}
              onClick={() => set("carrier", i)}
              className={`h-6 rounded-sm border px-2 font-mono text-[9px] uppercase ${
                carrier === i ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Knob label="Bands" value={bands} min={8} max={24} onChange={(v) => set("bands", Math.round(v))} />
      <Knob label="Pitch" value={get("pitch", 110)} min={40} max={440} unit="Hz" onChange={(v) => set("pitch", v)} />
      <Knob label="Detune" value={get("detune", 14)} min={0} max={50} unit="ct" onChange={(v) => set("detune", v)} />
      <Knob label="Formant" value={get("formant", 0)} min={-12} max={12} unit="st" onChange={(v) => set("formant", v)} />
      <Knob label="Response" value={get("response", 18)} min={2} max={200} unit="ms" onChange={(v) => set("response", v)} />
      <Knob label="Sensitivity" value={get("sense", 1.4)} min={0.2} max={4} onChange={(v) => set("sense", v)} />
      <Knob label="Sibilance" value={get("sibilance", 0.35)} min={0} max={1} onChange={(v) => set("sibilance", v)} />
      <Knob label="Mix" value={get("mix", 1)} min={0} max={1} onChange={(v) => set("mix", v)} />
      <Knob label="Output" value={get("output", 0)} min={-24} max={12} unit="dB" onChange={(v) => set("output", v)} />

      <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
        Put this on a voice channel: the voice opens the filter bank and the internal oscillator bank sings the words. The
        carrier pitch is set here — it does not follow a MIDI part.
      </p>
    </div>
  );
}
