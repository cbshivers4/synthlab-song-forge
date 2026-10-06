import { useEffect, useRef, useState } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";

type ScopeMode = "osc" | "spectrum";
type ScopeChan = "stereo" | "left" | "right";

const FPS_MS = 50; // 20 fps, matches the other meters
const HOLD_MS = 1500;
const CLIP = 0.999;

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const toDb = (v: number) => (v <= 0.00001 ? -100 : 20 * Math.log10(v));
/** maps -60..+3 dBFS onto 0..1 */
const dbPos = (db: number) => Math.max(0, Math.min(1, (db + 60) / 63));
/** every tick drawn under the meter */
const SCALE_TICKS = [-60, -48, -36, -24, -18, -12, -6, -3, 0, 3];
/** only these get printed numbers — the rest stay as plain ticks so they never collide */
const SCALE_LABELS = [-60, -48, -36, -24, -12, -6, 0];

/**
 * Stereo master meter (peak, RMS, peak hold, clip latch) plus oscilloscope / spectrum,
 * both reading the real post-master analysers. Drawing is canvas-only on a 20 fps timer.
 */
export function MasterMeter() {
  const meterRef = useRef<HTMLCanvasElement | null>(null);
  const scopeRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<ScopeMode>("osc");
  const [chan, setChan] = useState<ScopeChan>("stereo");
  const [clip, setClip] = useState<[boolean, boolean]>([false, false]);
  const opts = useRef({ mode, chan });
  opts.current = { mode, chan };
  const clipRef = useRef<[boolean, boolean]>([false, false]);

  useEffect(() => {
    const hold = [{ v: 0, t: 0 }, { v: 0, t: 0 }];
    const green = cssVar("--chart-5", "oklch(0.78 0.18 145)");
    const yellow = cssVar("--chart-3", "oklch(0.84 0.16 85)");
    const orange = cssVar("--meter-clip-orange", "oklch(0.75 0.19 55)");
    const danger = cssVar("--destructive", "oklch(0.63 0.24 25)");
    const muted = cssVar("--border", "oklch(0.3 0 0)");
    const accent2 = cssVar("--chart-2", "oklch(0.75 0.15 330)");

    const size = (cv: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
      if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
      const c = cv.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      return { c, w, h };
    };

    const tick = () => {
      if (document.hidden) return;
      const eng = getEngine();
      const wav = [eng.getMasterChannel(0, "wave"), eng.getMasterChannel(1, "wave")];
      const now = performance.now();

      // ---- meter
      const mc = meterRef.current;
      if (mc) {
        const { c, w, h } = size(mc);
        const barH = (h - 4) / 2;
        let clipChanged = false;
        for (let ch = 0; ch < 2; ch++) {
          const d = wav[ch];
          let peak = 0, sum = 0;
          if (d) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]!); if (a > peak) peak = a; sum += d[i]! * d[i]!; }
          const rms = d ? Math.sqrt(sum / d.length) : 0;
          const hd = hold[ch]!;
          if (peak >= hd.v || now - hd.t > HOLD_MS) { hd.v = peak; hd.t = now; }
          if (peak >= CLIP && !clipRef.current[ch]) { clipRef.current[ch] = true; clipChanged = true; }
          const y = ch * (barH + 4);
          c.fillStyle = muted; c.globalAlpha = 0.35; c.fillRect(0, y, w, barH); c.globalAlpha = 1;
          const pw = dbPos(toDb(peak)) * w;
          const g = c.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, green);
          g.addColorStop(dbPos(-12), green);
          g.addColorStop(dbPos(-6), yellow);
          g.addColorStop(dbPos(-3), orange);
          g.addColorStop(dbPos(0.5), danger);
          c.fillStyle = g; c.globalAlpha = 0.9; c.fillRect(0, y, pw, barH); c.globalAlpha = 1;
          c.fillStyle = g; c.globalAlpha = 0.6; c.fillRect(0, y + barH * 0.25, dbPos(toDb(rms)) * w, barH * 0.5); c.globalAlpha = 1;
          const hx = dbPos(toDb(hd.v)) * w;
          c.fillStyle = hd.v >= CLIP ? danger : yellow; c.fillRect(Math.max(0, hx - 2), y, 2, barH);
        }
        // 0 dB and -12 marks
        c.fillStyle = muted;
        for (const db of [-48, -36, -24, -18, -12, -6, -3, 0]) c.fillRect(dbPos(db) * w, 0, 1, h);
        if (clipChanged) setClip([...clipRef.current] as [boolean, boolean]);
      }

      // ---- scope
      const sc = scopeRef.current;
      if (sc) {
        const { c, w, h } = size(sc);
        const { mode: m, chan: ch } = opts.current;
        const chans = ch === "stereo" ? [0, 1] : ch === "left" ? [0] : [1];
        c.lineWidth = 1.2;
        for (const i of chans) {
          c.strokeStyle = i === 0 ? primary : accent2;
          c.globalAlpha = chans.length > 1 ? 0.8 : 1;
          c.beginPath();
          if (m === "osc") {
            const d = wav[i];
            if (!d) { c.moveTo(0, h / 2); c.lineTo(w, h / 2); }
            else {
              const n = Math.min(d.length, 1024);
              for (let k = 0; k < n; k++) {
                const x = (k / (n - 1)) * w;
                const yv = h / 2 - Math.max(-1, Math.min(1, d[k]!)) * (h / 2 - 1);
                if (k === 0) c.moveTo(x, yv); else c.lineTo(x, yv);
              }
            }
          } else {
            const d = eng.getMasterChannel(i as 0 | 1, "spectrum");
            if (d) {
              const nyq = eng.sampleRate / 2;
              const lmin = Math.log10(20), lmax = Math.log10(20000);
              let first = true;
              for (let px = 0; px <= w; px += 2) {
                const f = 10 ** (lmin + (px / w) * (lmax - lmin));
                const bin = Math.min(d.length - 1, Math.round((f / nyq) * d.length));
                const db = d[bin]!;
                const yv = h - Math.max(0, Math.min(1, (db + 100) / 90)) * h;
                if (first) { c.moveTo(px, yv); first = false; } else c.lineTo(px, yv);
              }
            }
          }
          c.stroke();
        }
        c.globalAlpha = 1;
      }
    };
    const id = window.setInterval(tick, FPS_MS);
    return () => window.clearInterval(id);
  }, []);

  const resetClip = () => { clipRef.current = [false, false]; setClip([false, false]); };
  const anyClip = clip[0] || clip[1];

  return (
    <div className="flex items-stretch gap-2 rounded-[3px] border border-border bg-background px-2 py-1 shadow-[inset_0_1px_3px_oklch(0_0_0/0.6)]">
      <div className="flex w-48 flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between">
          <span className="label-xs">MASTER L/R</span>
          <button
            type="button"
            onClick={resetClip}
            title="Clip indicator — click to reset"
            aria-label={anyClip ? "Master clipped — reset clip indicator" : "No clipping"}
            className={`rounded-[2px] px-1 font-mono text-[9px] font-bold tracking-wider ${anyClip ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}`}
          >
            CLIP
          </button>
        </div>
        <canvas ref={meterRef} className="h-5 w-full" aria-label="Master stereo level meter" role="img" />
        <div className="relative h-3 font-mono text-[8px] leading-none text-muted-foreground" aria-hidden>
          {SCALE_TICKS.map((db) => {
            const p = dbPos(db);
            const shift = p < 0.05 ? "" : p > 0.95 ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <span key={db}>
                <span className="absolute top-0 h-1 w-px -translate-x-1/2 bg-muted-foreground/70" style={{ left: `${p * 100}%` }} />
                {SCALE_LABELS.includes(db) && (
                  <span
                    className={`absolute top-1 ${shift} ${db >= 0 ? "text-destructive" : db >= -6 ? "text-foreground/80" : ""}`}
                    style={{ left: `${p * 100}%` }}
                  >
                    {db > 0 ? `+${db}` : db}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex w-60 flex-col gap-0.5">
        <div className="flex items-center gap-1 font-mono text-[9px] tracking-wider">
          {(["osc", "spectrum"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={mode === m ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
              {m === "osc" ? "SCOPE" : "SPECTRUM"}
            </button>
          ))}
          <span className="ml-auto flex gap-1">
            {(["stereo", "left", "right"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setChan(c)} aria-pressed={chan === c}
                className={chan === c ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                {c === "stereo" ? "ST" : c === "left" ? "L" : "R"}
              </button>
            ))}
          </span>
        </div>
        <canvas ref={scopeRef} className="h-8 w-full" aria-label="Master oscilloscope and spectrum" role="img" />
      </div>
    </div>
  );
}
