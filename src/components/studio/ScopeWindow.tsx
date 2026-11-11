import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Activity, BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEngine } from "@/lib/synclab/audio-engine";
import { useStudio } from "@/lib/synclab/store";
import { phoneLayoutNow } from "@/hooks/use-mobile";
import { canvasPoint, canvasRect, sidewaysCanvas } from "@/lib/synclab/canvas-point";
import { readModularScope } from "@/lib/synclab/modular-scopes";
import { peakOf } from "@/lib/synclab/level-colors";
import { waveformDisplayGain } from "@/lib/synclab/signal-display";
import {
  SPECTRUM_DB_MARKS, SPECTRUM_FREQ_MARKS, SPECTRUM_MINOR_MARKS, binForFreq, bypassedEffect, closeScopeWindow,
  dbToFrac, followedSource, formatFreq, fracToFreq, freqToFrac, scopeSourceGroups, triggerIndex,
  updateScopeWindow, useScopeWindow,
} from "@/lib/synclab/scope-window";

const WAVE_SPAN = 2048;
const layout = () => (sidewaysCanvas() ? { w: window.innerHeight, h: window.innerWidth } : { w: window.innerWidth, h: window.innerHeight });

/**
 * Expanded analyzer window (Studio One "Spectrum EQ window" style) for any scope in the studio.
 * Reads the same real taps as the small scopes through a branch-only high-resolution analyser.
 */
export function ScopeWindow() {
  const win = useScopeWindow();
  const { tracks, selectedId } = useStudio();
  // Read at render: the window only renders after a tap, so there is no server/client mismatch.
  const isMobile = win.open && phoneLayoutNow();
  const [analyzer, setAnalyzer] = useState(true);
  const [peakHold, setPeakHold] = useState(true);
  const [box, setBox] = useState(() => ({ x: 96, y: 80, w: 780, h: 440 }));
  const drag = useRef<{ mode: "move" | "size"; px: number; py: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const opts = useRef({ analyzer, peakHold });
  opts.current = { analyzer, peakHold };

  // Follow Selection keeps the window on the selected channel.
  useEffect(() => {
    if (!win.open || !win.follow) return;
    const next = followedSource(selectedId, tracks);
    if (next.id !== win.source.id || next.label !== win.source.label) updateScopeWindow({ source: next });
  }, [win.open, win.follow, win.source.id, win.source.label, selectedId, tracks]);

  // Esc closes; the detail branch is released whenever the window closes.
  useEffect(() => {
    if (!win.open) { getEngine().releaseDetailScope(); return; }
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeScopeWindow(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [win.open]);

  const bypassed = bypassedEffect(win.source.id, tracks);

  useEffect(() => {
    if (!win.open) return;
    let hold: Float32Array | null = null;
    const draw = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); hold = null; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const css = getComputedStyle(cv);
      const grid = css.getPropertyValue("--scope-grid").trim();
      const minor = css.getPropertyValue("--scope-grid-minor").trim();
      const trace = css.getPropertyValue("--scope-trace").trim();
      const fill = css.getPropertyValue("--scope-fill").trim();
      const holdColor = css.getPropertyValue("--scope-hold").trim();
      const engine = getEngine();
      const modular = win.source.kind === "modular";
      let status = "";

      if (win.view === "spectrum") {
        ctx.lineWidth = 1;
        ctx.strokeStyle = minor;
        for (const f of SPECTRUM_MINOR_MARKS) { const x = Math.round(freqToFrac(f) * w) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        ctx.strokeStyle = grid;
        for (const f of SPECTRUM_FREQ_MARKS) { const x = Math.round(freqToFrac(f) * w) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (const db of SPECTRUM_DB_MARKS) { const y = Math.round(dbToFrac(db) * h) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        const data = !opts.current.analyzer || bypassed ? null : engine.getDetailScope(win.source.id, "spectrum");
        if (!opts.current.analyzer) status = "Analyzer off";
        else if (bypassed) status = "Effect bypassed — no output to show";
        else if (!data) status = "Waiting for audio — press Play or play a note";
        if (data) {
          const sr = engine.sampleRate;
          const cols = Math.ceil(w);
          if (!hold || hold.length !== cols + 1) hold = new Float32Array(cols + 1).fill(-200);
          let peakDb = -200, peakHz = 0;
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= cols; x++) {
            // take the loudest bin in this pixel's frequency slice so narrow peaks never vanish
            const lo = binForFreq(fracToFreq(x / w), sr, data.length);
            const hi = Math.max(lo, binForFreq(fracToFreq((x + 1) / w), sr, data.length) - 1);
            let db = -200;
            for (let b = lo; b <= hi; b++) { const v = data[b] ?? -200; if (v > db) db = v; }
            if (db > peakDb) { peakDb = db; peakHz = fracToFreq(x / w); }
            hold[x] = Math.max(db, (hold[x] ?? -200) - 0.5);
            ctx.lineTo(x, dbToFrac(db) * h);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = trace;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          if (opts.current.peakHold) {
            ctx.beginPath();
            for (let x = 0; x <= cols; x++) { const y = dbToFrac(hold[x] ?? -200) * h; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.strokeStyle = holdColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          if (readoutRef.current) readoutRef.current.textContent = peakDb > -96 ? `Peak ${formatFreq(peakHz)} · ${peakDb.toFixed(1)} dB` : "Peak —";
          if (peakDb <= -96 && !status) status = "Silent";
        } else if (readoutRef.current) readoutRef.current.textContent = "Peak —";
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = grid;
        for (let i = 1; i < 10; i++) { const x = Math.round((w * i) / 10) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let i = 1; i < 8; i++) { const y = Math.round((h * i) / 8) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        const data = bypassed ? null : modular ? readModularScope(win.source.id) : engine.getDetailScope(win.source.id, "wave");
        if (bypassed) status = "Effect bypassed — no output to show";
        else if (!data) status = "Waiting for audio — press Play or play a note";
        ctx.strokeStyle = trace;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        if (data) {
          const span = Math.min(WAVE_SPAN, Math.floor(data.length / 2));
          const start = triggerIndex(data, span);
          const peak = peakOf(data);
          const zoom = waveformDisplayGain(peak);
          for (let i = 0; i < span; i++) {
            const x = (i / (span - 1)) * w;
            const y = h / 2 - Math.max(-1, Math.min(1, (data[start + i] ?? 0) * zoom)) * (h / 2 - 4);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          const db = 20 * Math.log10(Math.max(peak, 0.000001));
          if (readoutRef.current) readoutRef.current.textContent = `Peak ${db > -96 ? db.toFixed(1) : "−∞"} dBFS${zoom > 1.01 ? ` · display zoom ×${zoom.toFixed(1)}` : ""}`;
          if (peak <= 0.00002 && !status) status = "Silent";
        } else {
          ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
          if (readoutRef.current) readoutRef.current.textContent = "Peak —";
        }
        ctx.stroke();
      }
      if (statusRef.current) { statusRef.current.textContent = status; statusRef.current.hidden = !status; }
    };
    draw();
    const timer = window.setInterval(draw, 50);
    return () => window.clearInterval(timer);
  }, [win.open, win.view, win.source.id, win.source.kind, bypassed]);

  if (!win.open || typeof document === "undefined") return null;

  const startDrag = (mode: "move" | "size") => (e: ReactPointerEvent<HTMLElement>) => {
    if (isMobile || e.button !== 0) return;
    if (mode === "move" && (e.target as Element).closest("button,[role=combobox],[role=checkbox]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = canvasPoint(e.clientX, e.clientY);
    drag.current = { mode, px: pt.x, py: pt.y, ox: mode === "move" ? box.x : box.w, oy: mode === "move" ? box.y : box.h };
  };
  const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const pt = canvasPoint(e.clientX, e.clientY);
    const v = layout();
    const dx = pt.x - d.px, dy = pt.y - d.py;
    setBox((b) => d.mode === "move"
      ? { ...b, x: Math.max(-b.w + 160, Math.min(v.w - 120, d.ox + dx)), y: Math.max(0, Math.min(v.h - 48, d.oy + dy)) }
      : { ...b, w: Math.max(460, Math.min(v.w - b.x, d.ox + dx)), h: Math.max(300, Math.min(v.h - b.y, d.oy + dy)) });
  };
  const endDrag = () => { drag.current = null; };

  const hover = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = cursorRef.current;
    if (!el || win.view !== "spectrum") return;
    const r = canvasRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    const fx = Math.max(0, Math.min(1, (pt.x - r.left) / Math.max(1, r.width)));
    const fy = Math.max(0, Math.min(1, (pt.y - r.top) / Math.max(1, r.height)));
    el.hidden = false;
    el.style.left = `${fx * 100}%`;
    el.style.top = `${fy * 100}%`;
    el.textContent = `${formatFreq(fracToFreq(fx))} · ${(-96 * fy).toFixed(0)} dB`;
  };

  const groups = scopeSourceGroups(tracks);
  const known = groups.some((g) => g.sources.some((s) => s.id === win.source.id));
  const pick = (id: string) => {
    const s = groups.flatMap((g) => g.sources).find((x) => x.id === id);
    if (s) updateScopeWindow({ source: s, follow: false });
  };
  const title = win.view === "spectrum" ? "Spectrum Analyzer" : "Oscilloscope";

  return createPortal(
    <section
      role="dialog"
      aria-label={`${title} — ${win.source.label}`}
      data-phone={isMobile ? "true" : undefined}
      className="scope-window fixed z-50 flex flex-col overflow-hidden"
      style={isMobile ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <header className="scope-window-titlebar grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2" onPointerDown={startDrag("move")}>
        <Button variant="ghost" size="icon" className="scope-window-close size-7 shrink-0" aria-label="Close expanded scope" onClick={closeScopeWindow}><X className="size-4" /></Button>
        <h2 className="truncate text-center text-xs font-medium">{title} · {win.source.label}</h2>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Display type">
          <Button variant="ghost" size="sm" aria-pressed={win.view === "spectrum"} disabled={win.source.kind === "modular"} title={win.source.kind === "modular" ? "This module tap only carries a waveform" : "Frequency spectrum"} className="scope-window-tab h-7 gap-1 px-2 text-[11px]" onClick={() => updateScopeWindow({ view: "spectrum" })}><BarChart3 className="size-3.5" />Spectrum</Button>
          <Button variant="ghost" size="sm" aria-pressed={win.view === "wave"} className="scope-window-tab h-7 gap-1 px-2 text-[11px]" onClick={() => updateScopeWindow({ view: "wave" })}><Activity className="size-3.5" />Scope</Button>
        </div>
      </header>

      <div className="scope-window-body grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-3 p-3">
        <div className="scope-window-plot relative min-h-0 min-w-0" style={{ paddingLeft: 52, paddingTop: 20 }}>
          {win.view === "spectrum" && <>
            {SPECTRUM_FREQ_MARKS.map((f) => (
              <span key={f} className="scope-window-label absolute top-0 -translate-x-1/2" style={{ left: `calc(52px + (100% - 52px) * ${freqToFrac(f)})` }}>{formatFreq(f)}</span>
            ))}
            {SPECTRUM_DB_MARKS.map((db) => (
              <span key={db} className="scope-window-label absolute left-0 w-11 -translate-y-1/2 text-right" style={{ top: `calc(20px + (100% - 20px) * ${dbToFrac(db)})` }}>{db} dB</span>
            ))}
          </>}
          {win.view === "wave" && <>
            <span className="scope-window-label absolute left-0 w-11 text-right" style={{ top: 20 }}>+1</span>
            <span className="scope-window-label absolute left-0 w-11 -translate-y-1/2 text-right" style={{ top: "calc(20px + (100% - 20px) / 2)" }}>0</span>
            <span className="scope-window-label absolute bottom-0 left-0 w-11 text-right">−1</span>
            <span className="scope-window-label absolute top-0" style={{ left: 52 }}>{Math.round((WAVE_SPAN / getEngine().sampleRate) * 1000)} ms window</span>
          </>}
          <div className="relative h-full w-full" onPointerMove={hover} onPointerLeave={() => { if (cursorRef.current) cursorRef.current.hidden = true; }}>
            <canvas ref={canvasRef} className="scope-window-canvas block h-full w-full" role="img" aria-label={`${title} of ${win.source.label}`} />
            <div ref={statusRef} hidden className="scope-window-status pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-2 py-1 text-center text-xs" />
            <div ref={cursorRef} hidden className="scope-window-cursor pointer-events-none absolute -translate-y-full whitespace-nowrap px-1 font-mono text-[10px]" />
          </div>
        </div>
        <div className="scope-window-options flex w-32 flex-col justify-end gap-3 pb-6 text-xs">
          {win.view === "spectrum" && <>
            <label className="flex items-center gap-2"><Checkbox checked={analyzer} onCheckedChange={(v) => setAnalyzer(v === true)} aria-label="Analyzer" />Analyzer</label>
            <label className="flex items-center gap-2"><Checkbox checked={peakHold} onCheckedChange={(v) => setPeakHold(v === true)} aria-label="Peak hold" />Peak hold</label>
          </>}
          <span ref={readoutRef} className="scope-window-readout font-mono text-[10px] leading-tight">Peak —</span>
        </div>
      </div>

      <footer className="scope-window-bar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
        {win.source.kind === "modular" ? (
          <span className="truncate text-sm">{win.source.label}</span>
        ) : (
          <Select value={win.source.id} onValueChange={pick}>
            <SelectTrigger className="scope-window-source h-8 min-w-0 max-w-xs text-sm" aria-label="Signal to show"><SelectValue placeholder={win.source.label}>{win.source.label}</SelectValue></SelectTrigger>
            <SelectContent className="z-[70] max-h-80">
              {!known && <SelectItem value={win.source.id}>{win.source.label}</SelectItem>}
              {groups.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <Checkbox checked={win.follow} onCheckedChange={(v) => updateScopeWindow({ follow: v === true, ...(v === true ? { source: followedSource(selectedId, tracks) } : {}) })} aria-label="Follow Selection" />
          Follow Selection
        </label>
      </footer>
      {!isMobile && <div className="scope-window-resize absolute bottom-0 right-0 size-4 cursor-nwse-resize" onPointerDown={startDrag("size")} aria-hidden="true" />}
    </section>,
    document.body,
  );
}
