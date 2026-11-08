import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { levelColor, peakOf, spectrumColor, dbColor, LEVEL_GREEN, LEVEL_ORANGE, LEVEL_RED } from "@/lib/synclab/level-colors";
import { useEffect, useMemo, useRef, useState } from "react";
import { EqGrid } from "./EqGrid";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { PluginInstance, PluginKind } from "@/lib/synclab/types";
import { BASS_CABS, LEAD_CABS, fuzzTransfer, overdriveTransfer, wahFrequency } from "@/lib/synclab/creative-fx";

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
  { id: "low", label: "Bass", short: "BASS", from: 0, to: 0.33, color: "var(--display-cyan)" },
  { id: "mid", label: "Mids", short: "MIDS", from: 0.33, to: 0.67, color: "var(--display-yellow)" },
  { id: "high", label: "Highs", short: "HIGHS", from: 0.67, to: 1, color: "var(--display-pink)" },
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
  stepfilter: {
    title: "PULSE GRID",
    xLabel: "16 / 32 steps",
    yLabel: "cutoff",
    xParam: "rate",
    yParam: "depth",
    curve: (g) => sweep((t) => g(`s${Math.min(Math.round(g("steps")), Math.floor(t * Math.round(g("steps"))) + 1)}`)),
    readout: (g) => `${Math.round(g("steps"))} STEPS · ${g("rate").toFixed(1)} Hz · DEPTH ${(g("depth") * 100).toFixed(0)}% · SMOOTH ${Math.round(g("smooth") * 1000)} ms`,
  },
  resonator: {
    title: "HARMONIC RESONANCE",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "resonance",
    xParam: "root",
    yParam: "decay",
    curve: (g) => {
      const root = 440 * Math.pow(2, (g("root") - 69) / 12);
      const spread = g("spread");
      const ratios = [1, Math.pow(2, 7 / 12), 2, Math.pow(2, 16 / 12)];
      return freqAxis((f) => ratios.reduce((sum, ratio, index) => sum + peak(f, root * ratio * (1 + (index - 1.5) * spread * 0.025), 10 - index, 5 + g("decay") * 2), 0), 18);
    },
    marks: (g) => {
      const root = 440 * Math.pow(2, (g("root") - 69) / 12);
      return [root, root * Math.pow(2, 7 / 12), root * 2, root * Math.pow(2, 16 / 12)].map(logX);
    },
    readout: (g) => `ROOT MIDI ${Math.round(g("root"))} · DECAY ${g("decay").toFixed(2)} s · DAMP ${(g("damping") * 100).toFixed(0)}%`,
  },
  scalechord: {
    title: "CHORD COMPASS",
    xLabel: "root / scale",
    yLabel: "voicing",
    xParam: "root",
    yParam: "chord",
    curve: (g) => sweep((t) => 0.18 + (((Math.floor(t * 12) + Math.round(g("root"))) % 12) / 12) * 0.65),
    marks: (g) => [g("root") / 11],
    readout: (g) => `ROOT ${Math.round(g("root"))} · SCALE ${Math.round(g("scale")) + 1} · CHORD ${Math.round(g("chord")) + 1} · INV ${Math.round(g("inversion"))}`,
  },
  leadamp: {
    title: "TONE STACK + CABINET",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "mid",
    yParam: "treble",
    curve: (g) => {
      const cab = LEAD_CABS[Math.max(0, Math.min(2, Math.round(g("cabinet"))))]!;
      return freqAxis((f) => shelf(f, 100, g("bass"), false) + peak(f, 650, g("mid"), 0.7) + shelf(f, 3000, g("treble"), true) + shelf(f, 4500, g("presence"), true)
        + shelf(f, 3500, 3 - g("mic") * 11, true) + peak(f, cab[2], cab[3], 2) + passFilter(f, cab[1], 1, 0) + passFilter(f, cab[0], 1, 1));
    },
    readout: (g) => `${["CLEAN", "CRUNCH", "LEAD"][Math.round(g("channel"))] ?? "CRUNCH"} · GAIN ${(g("gain") * 100).toFixed(0)}% · CAB ${["1x12", "2x12", "4x12"][Math.round(g("cabinet"))] ?? "4x12"} · MASTER ${(g("master") * 100).toFixed(0)}%`,
  },
  bassamp: {
    title: "BASS TONE + CABINET",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "lomid",
    yParam: "bass",
    curve: (g) => {
      const cab = BASS_CABS[Math.max(0, Math.min(2, Math.round(g("cabinet"))))]!;
      const amp = (f: number) => shelf(f, 60, g("bass"), false) + peak(f, 250, g("lomid"), 1) + peak(f, 1000, g("himid"), 1) + shelf(f, 3000, g("treble"), true)
        + peak(f, 500, -g("contour") * 12, 0.6) + peak(f, cab[2], cab[3], 1.8) + passFilter(f, cab[1], 1, 0) + passFilter(f, cab[0], 1, 1);
      const b = g("blend");
      return freqAxis((f) => 20 * Math.log10(Math.max(1e-4, (1 - b) + b * Math.pow(10, amp(f) / 20))));
    },
    readout: (g) => `COMP ${(g("comp") * 100).toFixed(0)}% · DRIVE ${(g("drive") * 100).toFixed(0)}% · CAB ${["8x10", "4x10", "1x15"][Math.round(g("cabinet"))] ?? "8x10"} · AMP ${(g("blend") * 100).toFixed(0)}%`,
  },
  overdrive: {
    title: "CLIPPING CURVE",
    xLabel: "input",
    yLabel: "output",
    xParam: "drive",
    yParam: "output",
    curve: (g) => sweep((t) => 0.5 + overdriveTransfer((t - 0.5) * 2, g("drive")) * 0.46),
    readout: (g) => `DRIVE ${(g("drive") * 100).toFixed(0)}% · TONE ${(g("tone") * 100).toFixed(0)}% · LEVEL ${g("output").toFixed(1)} dB`,
  },
  fuzz: {
    title: "FUZZ TRANSFER",
    xLabel: "input",
    yLabel: "output",
    xParam: "sustain",
    yParam: "bias",
    curve: (g) => sweep((t) => 0.5 + fuzzTransfer((t - 0.5) * 2, g("sustain"), g("bias")) * 0.46),
    readout: (g) => `SUSTAIN ${(g("sustain") * 100).toFixed(0)}% · TONE ${(g("tone") * 100).toFixed(0)}% · GATE ${(g("bias") * 100).toFixed(0)}%`,
  },
  wah: {
    title: "WAH SWEEP",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "pedal",
    yParam: "resonance",
    curve: (g) => freqAxis((f) => peak(f, wahFrequency(g("pedal")), 4 + g("resonance"), Math.max(0.6, g("resonance") / 4)) - 8),
    marks: (g) => [logX(wahFrequency(g("pedal")))],
    readout: (g) => `${["PEDAL", "AUTO", "ENVELOPE"][Math.round(g("mode"))] ?? "PEDAL"} · ${Math.round(wahFrequency(g("pedal")))} Hz · Q ${g("resonance").toFixed(1)}`,
  },
  boost: {
    title: "BOOST RESPONSE",
    xLabel: "20 Hz → 20 kHz",
    yLabel: "±24 dB",
    xParam: "treble",
    yParam: "boost",
    curve: (g) => freqAxis((f) => g("boost") - 6 + shelf(f, 150, -g("treble") * 8, false) + shelf(f, 2200, g("treble") * 12, true)),
    readout: (g) => `BOOST +${g("boost").toFixed(1)} dB · TREBLE ${(g("treble") * 100).toFixed(0)}% · LEVEL ${g("output").toFixed(1)} dB`,
  },
  transient: {
    title: "TRANSIENT ENVELOPE",
    xLabel: "attack → body",
    yLabel: "gain",
    xParam: "attack",
    yParam: "sustain",
    curve: (g) => sweep((t) => clamp01(0.35 + g("attack") * Math.exp(-t * 18) * 0.55 + g("sustain") * (1 - Math.exp(-t * 5)) * 0.4)),
    marks: () => [0.12],
    readout: (g) => `ATTACK ${(g("attack") * 100).toFixed(0)} · SUSTAIN ${(g("sustain") * 100).toFixed(0)} · SENS ${(g("sensitivity") * 100).toFixed(0)}%`,
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
  const eqDrag = useRef<string | null>(null);
  const isChannelEq = plugin.kind === "eq";

  const get = useMemo(() => {
    const map = new Map(plugin.params.map((p) => [p.id, p.value]));
    return (id: string) => map.get(id) ?? 0;
  }, [plugin.params]);

  const points = useMemo(() => (shape ? shape.curve(get) : []), [shape, get]);
  const marks = useMemo(() => (shape?.marks ? shape.marks(get) : []), [shape, get]);

  useEffect(() => {
    if (!shape) return;
    let timer: ReturnType<typeof setInterval>;
    const draw = () => {

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

      const colors = getComputedStyle(canvas);
      ctx.strokeStyle = colors.getPropertyValue("--display-grid").trim();
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
      if (spectrum && isChannelEq) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2) {
          const f = 20 * Math.pow(1000, x / Math.max(1, w));
          const bin = Math.min(spectrum.length - 1, Math.max(0, Math.round(f / (engine.sampleRate / 2) * spectrum.length)));
          ctx.lineTo(x, h * (1 - clamp01(((spectrum[bin] ?? -120) + 96) / 96)));
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = colors.getPropertyValue("--eq-spectrum-fill").trim();
        ctx.fill();
        ctx.strokeStyle = colors.getPropertyValue("--eq-spectrum-line").trim();
        ctx.stroke();
      }
      if (spectrum && !isChannelEq) {
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
          // Channel EQ shows each band in its own colour; other effects show white level bars behind the red wave.
          const sc = colors.getPropertyValue(isChannelEq ? band.color.slice(4, -1) : "--display-point").trim();
          grad.addColorStop(0, sc);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.globalAlpha = isChannelEq ? 0.55 : 0.4;
          ctx.fillRect(x, h - bar, 1.5, bar);
          ctx.globalAlpha = 1;
        }
      }

      if (isChannelEq) return;
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
      ctx.strokeStyle = colors.getPropertyValue("--display-wave").trim();
      ctx.lineWidth = 1.3;
      ctx.stroke();
    };
    draw();
    timer = setInterval(draw, 50);
    return () => clearInterval(timer);
  }, [plugin.id, shape, isChannelEq]);

  if (!shape) return null;

  const param = (id?: string) => (id ? plugin.params.find((p) => p.id === id) : undefined);
  const xP = param(shape.xParam);
  const yP = param(shape.yParam);
  const isStepFilter = plugin.kind === "stepfilter";

  const setEqBandGain = (bandId: (typeof DISPLAY_BANDS)[number]["id"], normalizedY: number) => {
    const p = param(bandId);
    if (!p) return;
    onParam(p.id, Math.max(p.min, Math.min(p.max, (normalizedY - 0.5) * 48)));
  };

  const apply = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = canvasRect(el);
    const pt = canvasPoint(clientX, clientY);
    const nx = clamp01((pt.x - r.left) / r.width);
    const ny = 1 - clamp01((pt.y - r.top) / r.height);
    if (isStepFilter) {
      const count = Math.round(param("steps")?.value ?? 16);
      onParam(`s${Math.min(count, Math.floor(nx * count) + 1)}`, ny);
      return;
    }
    if (isChannelEq) {
      const band = DISPLAY_BANDS.find(b => b.id === eqDrag.current) ?? DISPLAY_BANDS.find(b => nx >= b.from && nx <= b.to);
      if (band) {
        setEqBandGain(band.id, ny);
        if (band.id === "mid") { const freq = param("midFreq"); if (freq) onParam(freq.id, Math.max(freq.min, Math.min(freq.max, 20 * Math.pow(1000, nx)))); }
      }
      return;
    }
    if (xP) onParam(xP.id, xP.min + nx * (xP.max - xP.min));
    if (yP) onParam(yP.id, yP.min + ny * (yP.max - yP.min));
  };

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${(x * 100).toFixed(2)},${((1 - y) * 100).toFixed(2)}`).join(" ");
  const fill = `${path} L100,100 L0,100 Z`;

  return (
    <div data-effect-window={plugin.kind} data-window-variant={plugin.name.toLowerCase().includes("echo") ? "tape" : undefined} className={isChannelEq ? "eq-workstation effect-response-window space-y-2" : "effect-response-window space-y-1"}>
      {isChannelEq && <header className="eq-titlebar"><span>SYNCLAB <strong>EQ</strong></span><span>3 BAND · CHANNEL</span></header>}
      <div className="flex items-center gap-2">
        <span className="label-xs">{shape.title}</span>
        <span className="ml-auto font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {isStepFilter ? "STEP FILTER" : isChannelEq ? "BASS / MIDS / HIGHS" : xP?.name ?? ""}
          {!isChannelEq && yP ? ` · ${yP.name}` : ""}
        </span>
      </div>
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`${shape.title} display for ${plugin.name}`}
        aria-valuenow={Math.round((xP ? (xP.value - xP.min) / (xP.max - xP.min) : 0) * 100)}
        className={`signal-screen response-glass panel relative touch-none overflow-hidden ${isChannelEq ? "eq-chart" : ""}`}
        style={{ height, cursor: xP ? "crosshair" : "default" }}
        onPointerDown={(e) => {
          if (!xP && !yP && !isStepFilter) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          if (isChannelEq && !eqDrag.current) {
            const rect = canvasRect(e.currentTarget);
            const nx = (canvasPoint(e.clientX, e.clientY).x - rect.left) / rect.width;
            eqDrag.current = DISPLAY_BANDS.reduce((a, b) => Math.abs(nx - (a.id === "mid" ? logX(get("midFreq")) : (a.from + a.to) / 2)) < Math.abs(nx - (b.id === "mid" ? logX(get("midFreq")) : (b.from + b.to) / 2)) ? a : b).id;
          }
          setDragging(true);
          apply(e.clientX, e.clientY);
        }}
        onKeyDown={e => {
          const p = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? xP : e.key === 'ArrowUp' || e.key === 'ArrowDown' ? yP : undefined;
          if (!p) return;
          e.preventDefault();
          const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
          onParam(p.id, Math.max(p.min, Math.min(p.max, p.value + direction * (p.max - p.min) / 100)));
        }}
        onPointerMove={(e) => dragging && apply(e.clientX, e.clientY)}
        onPointerUp={() => { setDragging(false); eqDrag.current = null; }}
        onPointerCancel={() => { setDragging(false); eqDrag.current = null; }}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

        {isChannelEq && <EqGrid range={24} />}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
          {isChannelEq ? DISPLAY_BANDS.map(band => {
            const response = freqAxis(f => band.id === "mid" ? peak(f, get("midFreq"), get("mid"), 1) : shelf(f, band.id === "low" ? 120 : 6000, get(band.id), band.id === "high"));
            const d = response.map(([x, y], i) => `${i ? "L" : "M"}${x * 100},${(1 - y) * 100}`).join(" ");
            return <g key={band.id}><path d={`${d} L100,50 L0,50 Z`} fill={band.color} opacity={0.23} /><path d={d} fill="none" stroke={band.color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" /></g>;
          }) : <path d={fill} fill="var(--display-wave-fill)" />}
          <path d={path} fill="none" stroke={isChannelEq ? "var(--eq-response)" : "var(--display-wave)"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {!isChannelEq && marks.map((m, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-y-0 w-px bg-primary/40"
            style={{ left: `${clamp01(m) * 100}%` }}
          />
        ))}
        {isChannelEq && DISPLAY_BANDS.map((band) => {
          const p = param(band.id);
          if (!p) return null;
          const x = band.id === "mid" ? logX(get("midFreq")) : logX(band.id === "low" ? 120 : 6000);
          return <div key={band.id} className="signal-point-hit" style={{ left: `${x * 100}%`, top: `${(1 - dbToY(p.value)) * 100}%` }}>
            <Button variant="ghost" className="signal-point eq-band-point" data-band={band.id} style={{ "--band-color": band.color } as import("react").CSSProperties} aria-label={`${band.label} EQ point`} title={`${band.label}: ${p.value.toFixed(1)} dB`} onPointerDown={() => { eqDrag.current = band.id; }}
              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); onParam(p.id, Math.max(p.min, Math.min(p.max, p.value + (e.key === 'ArrowUp' ? 0.5 : -0.5)))); } }} />
          </div>;
        })}
        {!isChannelEq && !isStepFilter && xP && <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: `${clamp01((xP.value - xP.min) / (xP.max - xP.min)) * 100}%`, top: `${(1 - (yP ? clamp01((yP.value - yP.min) / (yP.max - yP.min)) : 0.5)) * 100}%`, background: 'var(--display-cyan)', borderColor: 'var(--display-point)' }} />}
        {!isChannelEq && <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {shape.xLabel}
        </span>}
        {!isChannelEq && <span className="pointer-events-none absolute right-1.5 top-1 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {shape.yLabel}
        </span>}
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
                <div className="flex justify-center" onDoubleClick={() => onParam(p.id, 0)}>
                  <Knob label={band.label} value={p.value} min={p.min} max={p.max} step={0.5} unit=" dB" size={40} onChange={(v) => onParam(p.id, v)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="response-readout font-mono text-[9px] tracking-wider text-muted-foreground uppercase">{shape.readout(get)}</p>
    </div>
  );
}
