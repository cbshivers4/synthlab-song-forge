import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ExpandScopeButton } from "./ExpandScopeButton";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { EqGrid } from "./EqGrid";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { Power, RotateCcw } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { PluginInstance } from "@/lib/synclab/types";

export const EQ_BAND_TYPES = ["Low Shelf", "Low Cut", "Bell", "Notch", "High Shelf", "High Cut"] as const;
const BAND_COLORS = [
  "var(--display-orange)",
  "var(--display-yellow)",
  "var(--display-cyan)",
  "var(--display-violet)",
  "var(--display-green)",
  "var(--display-pink)",
  "var(--display-blue)",
  "var(--display-rose)",
];

const F_MIN = 20;
const F_MAX = 20000;
const DB_RANGE = 30;
const BANDS = [1, 2, 3, 4, 5, 6, 7, 8];

const xOf = (f: number, w: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
const fOf = (x: number, w: number) => F_MIN * Math.pow(F_MAX / F_MIN, Math.min(1, Math.max(0, x / w)));
const yOf = (db: number, h: number) => h / 2 - (db / DB_RANGE) * (h / 2);
const dbOf = (y: number, h: number) => ((h / 2 - y) / (h / 2)) * DB_RANGE;

type Band = { n: number; on: boolean; type: number; freq: number; gain: number; q: number };

const readBands = (p: PluginInstance): Band[] =>
  BANDS.map((n) => {
    const v = (id: string, d: number) => p.params.find((x) => x.id === `b${n}${id}`)?.value ?? d;
    return {
      n,
      on: v("on", 0) >= 0.5,
      type: Math.round(v("type", 2)),
      freq: v("freq", 1000),
      gain: v("gain", 0),
      q: v("q", 1),
    };
  });

/** Analogue-matched magnitude response of one band at a frequency, in dB. */
function bandResponse(b: Band, f: number): number {
  const A = Math.pow(10, b.gain / 40);
  const w = f / b.freq;
  switch (b.type) {
    case 1: {
      // low cut, 12 dB/oct
      const r = Math.pow(w, 2) / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / b.q, 2));
      return 20 * Math.log10(Math.max(1e-6, r));
    }
    case 5: {
      const r = 1 / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / b.q, 2));
      return 20 * Math.log10(Math.max(1e-6, r));
    }
    case 3: {
      const r = Math.abs(1 - w * w) / Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / b.q, 2));
      return 20 * Math.log10(Math.max(1e-6, r));
    }
    case 0:
    case 4: {
      // shelves: smooth transition around the corner frequency
      const t = 1 / (1 + Math.pow(w, b.type === 0 ? 2 * b.q * 2 : -2 * b.q * 2));
      return b.gain * t;
    }
    default: {
      // bell
      const bw = Math.pow(w - 1 / w, 2) * b.q * b.q;
      return (b.gain * 1) / (1 + bw);
    }
  }
}

const curveAt = (bands: Band[], f: number) =>
  bands.reduce((sum, b) => (b.on ? sum + bandResponse(b, f) : sum), 0);

export function ProEq({ trackId, plugin }: { trackId: string; plugin: PluginInstance }) {
  const { setPluginParam } = useStudio();
  const bands = readBands(plugin);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [active, setActive] = useState<number>(bands.find((b) => b.on)?.n ?? 3);
  const bandsRef = useRef(bands);
  bandsRef.current = bands;

  const set = (n: number, key: string, v: number) => setPluginParam(trackId, plugin.id, `b${n}${key}`, v);
  const output = plugin.params.find((x) => x.id === "output")?.value ?? 0;

  // live spectrum + curve drawing
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const draw = () => {
      const canvas = canvasRef.current;
      const box = boxRef.current;
      if (canvas && box) {
        const w = box.clientWidth;
        const h = box.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        const g = canvas.getContext("2d");
        if (g) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, w, h);
          const colors = getComputedStyle(canvas);

          // spectrum
          const spec = getEngine().getEqSpectrum(plugin.id);
          if (spec) {
            const rate = getEngine().sampleRate;
            g.beginPath();
            g.moveTo(0, h);
            for (let i = 1; i < spec.length; i++) {
              const f = (i * rate) / 2 / spec.length;
              if (f < F_MIN || f > F_MAX) continue;
              const db = spec[i] ?? -140;
              const y = h - ((db + 100) / 100) * h;
              g.lineTo(xOf(f, w), Math.max(-10, y));
            }
            g.lineTo(w, h);
            g.closePath();
            g.fillStyle = colors.getPropertyValue("--eq-spectrum-fill").trim();
            g.fill();
            g.strokeStyle = colors.getPropertyValue("--eq-spectrum-line").trim();
            g.lineWidth = 1;
            g.stroke();
          }

          // per-band curves
          const bs = bandsRef.current;
          bs.forEach((b, i) => {
            if (!b.on) return;
            g.beginPath();
            for (let x = 0; x <= w; x += 2) {
              const db = bandResponse(b, fOf(x, w));
              const y = yOf(db, h);
              if (x === 0) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
            const token = BAND_COLORS[i]?.slice(4, -1);
            g.strokeStyle = token ? colors.getPropertyValue(token).trim() : colors.getPropertyValue('--display-cyan').trim();
            g.lineWidth = 1.4;
            g.stroke();
            g.lineTo(w, h / 2);
            g.lineTo(0, h / 2);
            g.closePath();
            g.fillStyle = g.strokeStyle;
            g.globalAlpha = 0.22;
            g.fill();
            g.globalAlpha = 1;
          });

          // total curve
          g.beginPath();
          for (let x = 0; x <= w; x += 1) {
            const y = yOf(curveAt(bs, fOf(x, w)), h);
            if (x === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.strokeStyle = colors.getPropertyValue("--eq-response").trim();
          g.lineWidth = 2;
          g.stroke();

        }
      }

    };
    draw();
    timer = setInterval(draw, 50);
    return () => clearInterval(timer);
  }, [plugin.id]);

  const move = (e: ReactPointerEvent) => {
    if (drag === null) return;
    const boxEl = boxRef.current;
    if (!boxEl) return;
    const box = canvasRect(boxEl);
    const pt = canvasPoint(e.clientX, e.clientY);
    const b = bands.find((x) => x.n === drag);
    if (!b) return;
    set(drag, "freq", Math.round(fOf(pt.x - box.left, box.width)));
    if (b.type !== 1 && b.type !== 5 && b.type !== 3) {
      const db = dbOf(pt.y - box.top, box.height);
      set(drag, "gain", Math.max(-30, Math.min(30, Math.round(db * 10) / 10)));
    }
  };

  const addAt = (clientX: number, clientY: number) => {
    const boxEl = boxRef.current;
    if (!boxEl) return;
    const box = canvasRect(boxEl);
    const pt = canvasPoint(clientX, clientY);
    const free = bands.find((b) => !b.on);
    if (!free) return;
    set(free.n, "on", 1);
    set(free.n, "type", 2);
    set(free.n, "freq", Math.round(fOf(pt.x - box.left, box.width)));
    set(free.n, "gain", Math.max(-30, Math.min(30, Math.round(dbOf(pt.y - box.top, box.height) * 10) / 10)));
    setActive(free.n);
  };

  const sel = bands.find((b) => b.n === active) ?? bands[2];
  if (!sel) return null;

  return (
    <div className="eq-workstation effect-response-window space-y-3" data-effect-window="paraeq" aria-label="SYNCLAB Pro EQ">
      <header className="eq-titlebar"><span>SYNCLAB <strong>PRO EQ</strong></span><span className="flex items-center gap-2">8 BAND · PARAMETRIC<ExpandScopeButton scopeId={plugin.id} view="spectrum" /></span></header>
      <div
        ref={boxRef}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={(e) => addAt(e.clientX, e.clientY)}
        className="signal-screen eq-chart eq-chart-pro relative w-full touch-none overflow-hidden rounded-md border border-border"
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />

        <EqGrid range={DB_RANGE} />

        {/* band handles */}
        {bands.map((b, i) =>
          !b.on ? null : (
            <Button variant="ghost"
              key={b.n}
              type="button"
              aria-label={`Band ${b.n} ${EQ_BAND_TYPES[b.type]}`}
              onPointerDown={(e) => {
                e.preventDefault();
                setActive(b.n);
                boxRef.current?.setPointerCapture(e.pointerId);
                setDrag(b.n);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                set(b.n, "on", 0);
              }}
              onWheel={(e) => {
                const next = b.q * (e.deltaY > 0 ? 0.9 : 1.11);
                set(b.n, "q", Math.max(0.1, Math.min(18, Math.round(next * 100) / 100)));
              }}
              data-selected={active === b.n}
              className="signal-point eq-band-point absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab border-2 active:cursor-grabbing"
              style={{
                left: `${(Math.log(b.freq / F_MIN) / Math.log(F_MAX / F_MIN)) * 100}%`,
                top: `${50 - ((b.type === 1 || b.type === 5 || b.type === 3 ? 0 : b.gain) / DB_RANGE) * 50}%`,
                "--band-color": BAND_COLORS[i],
              } as import("react").CSSProperties}
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[8px]" style={{ color: BAND_COLORS[i] }}>
                {b.n}
              </span>
            </Button>
          ),
        )}
      </div>

      {/* band strip */}
      <div className="flex flex-wrap gap-1">
        {bands.map((b, i) => (
          <Button variant="ghost"
            key={b.n}
            type="button"
            onClick={() => {
              setActive(b.n);
              if (!b.on) set(b.n, "on", 1);
            }}
            className={`flex h-7 items-center gap-1 rounded-sm border px-2 font-mono text-[9px] uppercase tracking-wider ${
              active === b.n ? "border-primary text-foreground" : "border-border text-muted-foreground"
            } ${b.on ? "" : "opacity-45"}`}
            style={{ boxShadow: b.on ? `inset 3px 0 0 ${BAND_COLORS[i]}` : undefined }}
          >
            {b.n} · {EQ_BAND_TYPES[b.type]}
          </Button>
        ))}
      </div>

      {/* selected band controls */}
      <div className="eq-control-dock">
        <div className="eq-knob-row">
          <Knob label="Frequency" value={sel.freq} min={20} max={20000} step={1} unit=" Hz" size={64} onChange={v => set(sel.n, "freq", v)} midiTarget={{ id: trackId, param: `plugin:${plugin.id}:b${sel.n}freq` }} />
          <Knob label="Gain" value={sel.gain} min={-30} max={30} step={0.1} unit=" dB" size={64} onChange={v => set(sel.n, "gain", v)} midiTarget={{ id: trackId, param: `plugin:${plugin.id}:b${sel.n}gain` }} />
          <Knob label="Q" value={sel.q} min={0.1} max={18} step={0.05} size={64} onChange={v => set(sel.n, "q", v)} midiTarget={{ id: trackId, param: `plugin:${plugin.id}:b${sel.n}q` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="space-y-1">
          <span className="label-xs">Type</span>
          <select
            value={sel.type}
            onChange={(e) => set(sel.n, "type", Number(e.target.value))}
            className="h-7 w-full rounded-sm border border-border bg-surface px-1 font-mono text-[10px]"
          >
            {EQ_BAND_TYPES.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">Freq (Hz)</span>
          <input
            type="number"
            min={20}
            max={20000}
            value={Math.round(sel.freq)}
            onChange={(e) => set(sel.n, "freq", Math.max(20, Math.min(20000, Number(e.target.value) || 20)))}
            className="h-7 w-full rounded-sm border border-border bg-surface px-1 font-mono text-[10px]"
          />
        </label>
        <label className="space-y-1">
          <span className="label-xs">Gain (dB)</span>
          <input
            type="number"
            min={-30}
            max={30}
            step={0.1}
            value={Number(sel.gain.toFixed(1))}
            onChange={(e) => set(sel.n, "gain", Math.max(-30, Math.min(30, Number(e.target.value) || 0)))}
            className="h-7 w-full rounded-sm border border-border bg-surface px-1 font-mono text-[10px]"
          />
        </label>
        <label className="space-y-1">
          <span className="label-xs">Q</span>
          <input
            type="number"
            min={0.1}
            max={18}
            step={0.05}
            value={Number(sel.q.toFixed(2))}
            onChange={(e) => set(sel.n, "q", Math.max(0.1, Math.min(18, Number(e.target.value) || 1)))}
            className="h-7 w-full rounded-sm border border-border bg-surface px-1 font-mono text-[10px]"
          />
        </label>
        <div className="flex items-end gap-1">
          <Button variant="ghost"
            type="button"
            onClick={() => set(sel.n, "on", sel.on ? 0 : 1)}
            className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-sm border border-border font-mono text-[9px] uppercase ${
              sel.on ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Power className="size-3" /> {sel.on ? "On" : "Off"}
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => {
              set(sel.n, "gain", 0);
              set(sel.n, "q", 1);
            }}
            title="Reset band"
            className="grid size-7 place-items-center rounded-sm border border-border text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>

      </div>
      <div className="eq-output flex items-center gap-2">
        <span className="label-xs">Output</span>
        <input
          type="range"
          min={-24}
          max={24}
          step={0.1}
          value={output}
          onChange={(e) => setPluginParam(trackId, plugin.id, "output", Number(e.target.value))}
          className="h-1 flex-1 accent-primary"
        />
        <span className="w-14 text-right font-mono text-[10px] text-primary">{output.toFixed(1)} dB</span>
      </div>


    </div>
  );
}
