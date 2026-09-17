import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { PluginInstance, PluginKind } from "@/lib/synclab/types";

/**
 * Visual display for an effect: draws what the processor is actually doing
 * (EQ curve, filter slope, compressor transfer curve, delay taps, reverb tail,
 * LFO shape, bit-crush staircase, stereo field, gain trim) and lets you drag
 * inside the picture to change the two parameters that shape it.
 */

type Shape = {
  title: string;
  xLabel: string;
  yLabel: string;
  /** parameter driven by horizontal drag */
  xParam?: string;
  /** parameter driven by vertical drag */
  yParam?: string;
  /** curve in 0..1 display space, y measured from the bottom */
  curve: (get: (id: string) => number) => [number, number][];
  /** optional vertical guide lines at 0..1 */
  marks?: (get: (id: string) => number) => number[];
  /** readout under the graph */
  readout: (get: (id: string) => number) => string;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const logX = (hz: number) => clamp01((Math.log10(hz) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)));
const dbToY = (db: number, range = 24) => clamp01(0.5 + db / (range * 2));
const N = 128;
const sweep = (fn: (t: number) => number): [number, number][] =>
  Array.from({ length: N + 1 }, (_, i) => [i / N, clamp01(fn(i / N))] as [number, number]);

const DISPLAY_BANDS = [
  { id: "low", label: "Bass", short: "BASS", from: 0, to: 0.33, color: "#22d3ee" },
  { id: "mid", label: "Mids", short: "MIDS", from: 0.33, to: 0.67, color: "#facc15" },
  { id: "high", label: "Highs", short: "HIGHS", from: 0.67, to: 1, color: "#f472b6" },
] as const;

/** magnitude in dB of a peaking/shelf/pass response, rough but visually faithful */
function peak(f: number, freq: number, gain: number, q: number) {
  const x = Math.log2(f / freq);
  return gain * Math.exp(-(x * x) * (q * q) * 1.4);
}
function shelf(f: number, freq: number, gain: number, high: boolean) {
  const x = Math.log2(f / freq);
  const s = 1 / (1 + Math.exp(high ? -x * 2 : x * 2));
  return gain * s;
}
function passFilter(f: number, cutoff: number, q: number, mode: number) {
  const r = f / cutoff;
  const res = Math.max(0, (q - 0.7) * 1.6) * Math.exp(-Math.pow(Math.log2(r) * 2.2, 2));
  if (mode === 1) return -24 * Math.log10(1 + 1 / (r * r * 4)) + res; // high pass
  if (mode === 2) return -14 * Math.abs(Math.log2(r)) + res; // band pass
  return -24 * Math.log10(1 + r * r * 0.25) + res; // low pass
}

const freqAxis = (fn: (f: number) => number, range = 24) =>
  sweep((t) => dbToY(fn(Math.pow(10, Math.log10(20) + t * (Math.log10(20000) - Math.log10(20)))), range));

const SHAPES: Partial<Record<PluginKind, Shape>> = {
  eq: {
    title: "FREQUENCY RESPONSE",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "midFreq",
    yParam: "mid",
    curve: (g) =>
      freqAxis(
        (f) => shelf(f, 120, g("low"), false) + peak(f, g("midFreq"), g("mid"), 1) + shelf(f, 6000, g("high"), true),
      ),
    marks: (g) => [logX(120), logX(g("midFreq")), logX(6000)],
    readout: (g) => `LOW ${g("low").toFixed(1)} dB · MID ${g("mid").toFixed(1)} dB @ ${Math.round(g("midFreq"))} Hz · HIGH ${g("high").toFixed(1)} dB`,
  },
  filter: {
    title: "FILTER SLOPE",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "cutoff",
    yParam: "resonance",
    curve: (g) => freqAxis((f) => passFilter(f, g("cutoff"), g("resonance"), Math.round(g("type")))),
    marks: (g) => [logX(g("cutoff"))],
    readout: (g) =>
      `${["LOW PASS", "HIGH PASS", "BAND PASS"][Math.round(g("type"))] ?? "LOW PASS"} · ${Math.round(g("cutoff"))} Hz · Q ${g("resonance").toFixed(1)}`,
  },
  drive: {
    title: "SATURATION CURVE",
    xLabel: "input",
    yLabel: "output",
    xParam: "drive",
    yParam: "output",
    curve: (g) =>
      sweep((t) => {
        const x = (t - 0.5) * 2;
        const k = 1 + g("drive") * 12;
        return 0.5 + Math.tanh(x * k) / 2.1;
      }),
    readout: (g) => `DRIVE ${(g("drive") * 100).toFixed(0)}% · TONE ${Math.round(g("tone"))} Hz · OUT ${g("output").toFixed(1)} dB`,
  },
  compressor: {
    title: "GAIN TRANSFER",
    xLabel: "-60 → 0 dBFS in",
    yLabel: "out",
    xParam: "threshold",
    yParam: "ratio",
    curve: (g) =>
      sweep((t) => {
        const inDb = -60 + t * 60;
        const th = g("threshold");
        const out = inDb <= th ? inDb : th + (inDb - th) / Math.max(1, g("ratio"));
        return (out + 60 + g("makeup")) / 60;
      }),
    marks: (g) => [(g("threshold") + 60) / 60],
    readout: (g) => `THRESH ${g("threshold").toFixed(1)} dB · ${g("ratio").toFixed(1)}:1 · ATK ${g("attack").toFixed(1)} ms · REL ${Math.round(g("release"))} ms`,
  },
  limiter: {
    title: "CEILING TRANSFER",
    xLabel: "-60 → 0 dBFS in",
    yLabel: "out",
    xParam: "ceiling",
    yParam: "release",
    curve: (g) =>
      sweep((t) => {
        const inDb = -60 + t * 60;
        return (Math.min(inDb, g("ceiling")) + 60) / 60;
      }),
    marks: (g) => [(g("ceiling") + 60) / 60],
    readout: (g) => `CEILING ${g("ceiling").toFixed(2)} dB · RELEASE ${Math.round(g("release"))} ms`,
  },
  gate: {
    title: "GATE TRANSFER",
    xLabel: "-80 → 0 dBFS in",
    yLabel: "out",
    xParam: "threshold",
    yParam: "release",
    curve: (g) =>
      sweep((t) => {
        const inDb = -80 + t * 80;
        return inDb < g("threshold") ? 0 : (inDb + 80) / 80;
      }),
    marks: (g) => [(g("threshold") + 80) / 80],
    readout: (g) => `THRESH ${g("threshold").toFixed(1)} dB · ATK ${g("attack").toFixed(1)} ms · REL ${Math.round(g("release"))} ms`,
  },
  delay: {
    title: "ECHO TAPS",
    xLabel: "0 → 3 s",
    yLabel: "level",
    xParam: "time",
    yParam: "feedback",
    curve: (g) =>
      sweep((t) => {
        const ms = t * 3000;
        const step = Math.max(10, g("time"));
        const n = ms / step;
        const near = Math.abs(n - Math.round(n));
        const amp = Math.pow(g("feedback"), Math.round(n)) * g("mix");
        return near < 0.02 && Math.round(n) > 0 ? amp : 0;
      }),
    readout: (g) => `TIME ${Math.round(g("time"))} ms · FEEDBACK ${(g("feedback") * 100).toFixed(0)}% · MIX ${(g("mix") * 100).toFixed(0)}%`,
  },
  reverb: {
    title: "REVERB TAIL",
    xLabel: "0 → 8 s",
    yLabel: "level",
    xParam: "decay",
    yParam: "mix",
    curve: (g) =>
      sweep((t) => {
        const s = t * 8;
        const pre = g("predelay") / 1000;
        if (s < pre) return 0;
        return Math.exp(-(s - pre) * (3 / Math.max(0.2, g("decay")))) * g("mix");
      }),
    marks: (g) => [g("predelay") / 8000],
    readout: (g) => `DECAY ${g("decay").toFixed(2)} s · PRE-DELAY ${Math.round(g("predelay"))} ms · MIX ${(g("mix") * 100).toFixed(0)}%`,
  },
  chorus: lfoShape("CHORUS MODULATION", "mix"),
  flanger: lfoShape("FLANGER SWEEP", "feedback"),
  phaser: lfoShape("PHASE SWEEP", "center"),
  tremolo: lfoShape("TREMOLO LFO"),
  autopan: lfoShape("AUTO-PAN LFO"),
  bitcrusher: {
    title: "QUANTISATION",
    xLabel: "one cycle",
    yLabel: "sample value",
    xParam: "bits",
    yParam: "mix",
    curve: (g) =>
      sweep((t) => {
        const raw = Math.sin(t * Math.PI * 2);
        const levels = Math.pow(2, Math.max(2, Math.round(g("bits")))) / 2;
        const crushed = Math.round(raw * levels) / levels;
        const out = raw + (crushed - raw) * g("mix");
        return 0.5 + out * 0.45;
      }),
    readout: (g) => `${Math.round(g("bits"))} BIT · MIX ${(g("mix") * 100).toFixed(0)}%`,
  },
  width: {
    title: "STEREO FIELD",
    xLabel: "left → right",
    yLabel: "energy",
    xParam: "width",
    yParam: "output",
    curve: (g) =>
      sweep((t) => {
        const x = (t - 0.5) * 2;
        const w = Math.max(0.05, g("width"));
        return clamp01(Math.exp(-(x * x) / (0.08 * w * w + 0.02)) * 0.9 + 0.05);
      }),
    readout: (g) => `WIDTH ${(g("width") * 100).toFixed(0)}% · OUT ${g("output").toFixed(1)} dB`,
  },
  gain: {
    title: "OUTPUT TRIM",
    xLabel: "-24 → +12 dB",
    yLabel: "level",
    xParam: "gain",
    curve: (g) => {
      const n = (g("gain") + 24) / 36;
      return sweep((t) => (t <= n ? n : 0));
    },
    marks: (g) => [(g("gain") + 24) / 36],
    readout: (g) => `${g("gain") >= 0 ? "+" : ""}${g("gain").toFixed(1)} dB`,
  },
};

function lfoShape(title: string, third?: string): Shape {
  return {
    title,
    xLabel: "2 seconds",
    yLabel: "depth",
    xParam: "rate",
    yParam: "depth",
    curve: (g) =>
      sweep((t) => 0.5 + Math.sin(t * 2 * Math.PI * Math.max(0.05, g("rate"))) * g("depth") * 0.45),
    readout: (g) =>
      `RATE ${g("rate").toFixed(2)} Hz · DEPTH ${(g("depth") * 100).toFixed(0)}%` +
      (third ? ` · ${third.toUpperCase()} ${g(third).toFixed(2)}` : ""),
  };
}

export function EffectDisplay({
  plugin,
  onParam,
  height = 96,
}: {
  plugin: PluginInstance;
  onParam: (paramId: string, value: number) => void;
  height?: number;
}) {
  const shape = SHAPES[plugin.kind];
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const isChannelEq = plugin.kind === "eq";

  const get = useMemo(() => {
    const map = new Map(plugin.params.map((p) => [p.id, p.value]));
    return (id: string) => map.get(id) ?? 0;
  }, [plugin.params]);

  const points = useMemo(() => (shape ? shape.curve(get) : []), [shape, get]);
  const marks = useMemo(() => (shape?.marks ? shape.marks(get) : []), [shape, get]);

  useEffect(() => {
    if (!shape) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const box = boxRef.current;
      if (!canvas || !box) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const band of DISPLAY_BANDS) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `${band.color}2f`);
        grad.addColorStop(1, `${band.color}07`);
        ctx.fillStyle = grad;
        ctx.fillRect(band.from * w, 0, (band.to - band.from) * w, h);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const engine = getEngine();
      const spectrum = engine.getScopeSpectrum(plugin.id);
      if (spectrum) {
        const rate = engine.sampleRate;
        const bins = spectrum.length;
        for (let x = 0; x < w; x += 2) {
          const nx = x / Math.max(1, w);
          const f = 20 * Math.pow(1000, nx);
          const bin = Math.min(bins - 1, Math.max(0, Math.round((f / (rate / 2)) * bins)));
          const db = spectrum[bin] ?? -120;
          const mag = clamp01((Math.max(-96, Math.min(0, db)) + 96) / 96);
          const band = DISPLAY_BANDS.find((b) => nx >= b.from && nx <= b.to) ?? DISPLAY_BANDS[1];
          if (!band) continue;
          const bar = Math.max(1, mag * h);
          const grad = ctx.createLinearGradient(0, h - bar, 0, h);
          grad.addColorStop(0, `${band.color}d9`);
          grad.addColorStop(1, `${band.color}2f`);
          ctx.fillStyle = grad;
          ctx.fillRect(x, h - bar, 1.5, bar);
        }
      }

      const wave = engine.getScopeWave(plugin.id);
      ctx.beginPath();
      if (wave) {
        for (let i = 0; i < wave.length; i++) {
          const x = (i / Math.max(1, wave.length - 1)) * w;
          const y = h / 2 - Math.max(-1, Math.min(1, wave[i] ?? 0)) * (h / 2 - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [plugin.id, shape]);

  if (!shape) return null;

  const param = (id?: string) => (id ? plugin.params.find((p) => p.id === id) : undefined);
  const xP = param(shape.xParam);
  const yP = param(shape.yParam);

  const setEqBandGain = (bandId: (typeof DISPLAY_BANDS)[number]["id"], normalizedY: number) => {
    const p = param(bandId);
    if (!p) return;
    onParam(p.id, p.min + normalizedY * (p.max - p.min));
  };

  const apply = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = clamp01((clientX - r.left) / r.width);
    const ny = 1 - clamp01((clientY - r.top) / r.height);
    if (isChannelEq) {
      const band = DISPLAY_BANDS.find((b) => nx >= b.from && nx <= b.to) ?? DISPLAY_BANDS[1];
      if (band) setEqBandGain(band.id, ny);
      return;
    }
    if (xP) onParam(xP.id, xP.min + nx * (xP.max - xP.min));
    if (yP) onParam(yP.id, yP.min + ny * (yP.max - yP.min));
  };

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${(x * 100).toFixed(2)},${((1 - y) * 100).toFixed(2)}`).join(" ");
  const fill = `${path} L100,100 L0,100 Z`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="label-xs">{shape.title}</span>
        <span className="ml-auto font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {isChannelEq ? "drag color bands · bass / mids / highs" : xP ? `drag ↔ ${xP.name}` : ""}
          {!isChannelEq && yP ? ` · ↕ ${yP.name}` : ""}
        </span>
      </div>
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`${shape.title} display for ${plugin.name}`}
        aria-valuenow={Math.round((xP ? (xP.value - xP.min) / (xP.max - xP.min) : 0) * 100)}
        className="panel relative touch-none overflow-hidden bg-surface-2/50"
        style={{ height, cursor: xP ? "crosshair" : "default" }}
        onPointerDown={(e) => {
          if (!xP && !yP) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging && apply(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:25%_25%]" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
          <path d={fill} fill="hsl(187 85% 55% / 0.16)" />
          <path d={path} fill="none" stroke="hsl(187 85% 55%)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </svg>
        {marks.map((m, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-y-0 w-px bg-primary/40"
            style={{ left: `${clamp01(m) * 100}%` }}
          />
        ))}
        {isChannelEq && DISPLAY_BANDS.map((band) => {
          const p = param(band.id);
          const value = p ? (p.value - p.min) / (p.max - p.min) : 0.5;
          return (
            <div key={band.id} className="pointer-events-none absolute inset-y-0 border-l border-white/10" style={{ left: `${band.from * 100}%`, width: `${(band.to - band.from) * 100}%` }}>
              <span className="absolute left-1 top-1 font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: band.color }}>
                {band.short}
              </span>
              <span
                className="absolute left-1/2 size-3 -translate-x-1/2 rounded-full border-2 bg-background shadow-[0_0_10px_currentColor]"
                style={{ top: `${(1 - clamp01(value)) * 100}%`, borderColor: band.color, color: band.color }}
              />
            </div>
          );
        })}
        <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {shape.xLabel}
        </span>
        <span className="pointer-events-none absolute right-1.5 top-1 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {shape.yLabel}
        </span>
      </div>
      {isChannelEq && (
        <div className="grid grid-cols-3 gap-1">
          {DISPLAY_BANDS.map((band) => {
            const p = param(band.id);
            if (!p) return null;
            return (
              <div key={band.id} className="rounded-sm border border-border bg-surface-2/45 px-1.5 py-1" style={{ boxShadow: `inset 0 2px 0 ${band.color}` }}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: band.color }}>{band.label}</span>
                  <span className="font-mono text-[8px] text-muted-foreground">{p.value > 0 ? "+" : ""}{p.value.toFixed(1)} dB</span>
                </div>
                <Slider
                  value={[p.value]}
                  min={p.min}
                  max={p.max}
                  step={0.5}
                  onDoubleClick={() => onParam(p.id, 0)}
                  onValueChange={([v = p.value]) => onParam(p.id, v)}
                />
              </div>
            );
          })}
        </div>
      )}
      <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">{shape.readout(get)}</p>
    </div>
  );
}
