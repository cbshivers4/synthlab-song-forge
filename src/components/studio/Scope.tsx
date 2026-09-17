import { useEffect, useRef, useState } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";

type Mode = "wave" | "spectrum";

/** Live output scope for one effect insert — reads the analyser the engine taps after that plugin. */
export function Scope({
  scopeId,
  height = 74,
  compact = false,
  color,
}: {
  scopeId: string;
  height?: number;
  compact?: boolean;
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>("wave");
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const colorRef = useRef<string | undefined>(color);
  colorRef.current = color;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = ref.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const engine = getEngine();
      const accent = colorRef.current ?? "hsl(187 85% 55%)";
      if (modeRef.current === "wave") {
        const data = engine.getScopeWave(scopeId);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (data) {
          for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * w;
            const y = h / 2 - Math.max(-1, Math.min(1, data[i] ?? 0)) * (h / 2 - 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        } else {
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
        }
        ctx.stroke();
      } else {
        const data = engine.getScopeSpectrum(scopeId);
        if (data) {
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "hsl(187 85% 55% / 0.85)");
          grad.addColorStop(1, "hsl(187 85% 55% / 0.15)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, h);
          const bins = data.length;
          const sr = engine.sampleRate;
          for (let x = 0; x <= w; x++) {
            const f = 20 * Math.pow(1000, x / w); // 20 Hz .. 20 kHz log
            const bin = Math.min(bins - 1, Math.round((f / (sr / 2)) * bins));
            const db = data[bin] ?? -120;
            const y = h - ((Math.max(-100, Math.min(0, db)) + 100) / 100) * h;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scopeId]);

  return (
    <div className="panel relative overflow-hidden bg-surface-2/50" style={{ height }}>
      <canvas ref={ref} className="h-full w-full" />
      <div className="absolute right-1 top-1 flex gap-1">
        {(["wave", "spectrum"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[8px] tracking-wider uppercase ${
              mode === m ? "bg-primary/25 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "wave" ? "SCOPE" : "SPECTRUM"}
          </button>
        ))}
      </div>
    </div>
  );
}
