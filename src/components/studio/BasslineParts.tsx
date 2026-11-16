import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { Knob } from "./Knob";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { NOTE_NAMES } from "@/lib/synclab/bass-gen";
import { BLG_SOURCES, VARIATOR_SHAPES, fitTies, type BlgCell, type BlgLane, type BlgLaneId } from "@/lib/synclab/bassline-player";

/** Small LCD value with ◀ ▶ buttons (hardware-style click stepper). */
export function BlgStepper({ label, value, min, max, step = 1, format, onChange }: { label: string; value: number; min: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void }) {
  const go = (d: number) => onChange(Math.max(min, Math.min(max, value + d * step)));
  return (
    <div className="blg-lcd" role="group" aria-label={label}>
      <span className="blg-label">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" className="blg-arrow" aria-label={`${label} down`} disabled={value <= min} onClick={() => go(-1)}>◀</button>
        <span className="blg-value" aria-live="polite">{format ? format(value) : value}</span>
        <button type="button" className="blg-arrow" aria-label={`${label} up`} disabled={value >= max} onClick={() => go(1)}>▶</button>
      </span>
    </div>
  );
}

/** One generator lane: bank, source number, velocity, note length and its variator. */
export function BlgLanePanel({ lane, title, value, onChange, onDice }: { lane: BlgLaneId; title: string; value: BlgLane; onChange: (v: BlgLane) => void; onDice: () => void }) {
  const up = (p: Partial<BlgLane>) => onChange({ ...value, ...p });
  return (
    <div className={`blg-lane blg-lane-${lane}`} aria-label={`${title} generator`}>
      <div className="flex items-center gap-2">
        <span className="blg-lane-title">{title}</span>
        <span className="blg-bank" role="radiogroup" aria-label={`${title} bank`}>
          {(["A", "B"] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={value.bank === b} onClick={() => up({ bank: b })} className={value.bank === b ? "is-on" : ""}>{b}</button>
          ))}
        </span>
        <button type="button" className="blg-dice ml-auto" aria-label={`Randomize ${title}`} title={`Randomize ${title} only`} onClick={onDice}><Dices className="size-4" /></button>
      </div>
      <label className="block">
        <span className="flex items-baseline justify-between"><span className="blg-label">PATTERN</span><span className="blg-value">{value.index + 1}</span></span>
        <input type="range" min={0} max={BLG_SOURCES - 1} value={value.index} onChange={(e) => up({ index: Number(e.target.value) })} aria-label={`${title} pattern`} className="blg-slider" />
        <span className="flex justify-between text-[10px] text-muted-foreground"><span>sparse</span><span>busy</span></span>
      </label>
      <div className="blg-knobs">
        <Knob label="VELOCITY" value={value.velocity} onChange={(v) => up({ velocity: v })} format={(v) => (v <= 0.005 ? "OFF" : `${Math.round(v * 100)}`)} size={46} defaultValue={lane === "on" ? 0.9 : 0.75} />
        <Knob label="LENGTH" value={value.length} min={0.1} max={1} onChange={(v) => up({ length: v })} format={(v) => (v >= 0.98 ? "LEGATO" : `${Math.round(v * 100)}%`)} size={46} defaultValue={0.55} />
        <Knob label="AMOUNT" value={value.amount} min={-1} max={1} onChange={(v) => up({ amount: Math.round(v * 100) / 100 })} format={(v) => (Math.abs(v) < 0.01 ? "0" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`)} size={46} defaultValue={0} ariaLabel={`${title} variator amount`} />
      </div>
      <label className="flex items-center gap-2">
        <span className="blg-label">VARIATOR</span>
        <select aria-label={`${title} variator`} value={value.variator} onChange={(e) => up({ variator: e.target.value })} className="blg-select flex-1">
          {VARIATOR_SHAPES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <VariatorPreview shape={value.variator} amount={value.amount} />
    </div>
  );
}

function VariatorPreview({ shape, amount }: { shape: string; amount: number }) {
  const n = 64;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    // mirror of variatorValue for the little picture (pure maths, same rules)
    if (shape === "off") return 0.5;
    const inv = shape.endsWith("-inv"), id = inv ? shape.slice(0, -4) : shape;
    const base = (["square", "pulse", "ramp"] as const).find((s) => id.startsWith(s))!;
    const mult = Number(id.slice(base.length)) || 1, cycle = n / mult;
    const w = Math.min(i, n - 1) % cycle, ph = (inv ? cycle - 1e-6 - w : w) / cycle;
    const v = base === "square" ? (ph >= 0.5 ? 1 : 0) : base === "pulse" ? (ph >= 0.75 ? 1 : 0) : Math.floor(ph * 4) / 3;
    return 0.5 - (v * (amount === 0 ? 0.0 : Math.sign(amount)) * 0.42);
  });
  return (
    <svg viewBox={`0 0 ${n} 20`} className="blg-variator" aria-hidden preserveAspectRatio="none">
      <line x1="0" x2={n} y1="10" y2="10" className="blg-variator-mid" />
      <polyline points={pts.map((y, i) => `${i},${y * 20}`).join(" ")} className="blg-variator-line" />
    </svg>
  );
}

/** The diamond: drag to pick an on-beat (left edge) and off-beat (right edge) source together. */
export function BlgDiamond({ on, off, onAmount, offAmount, onChange }: { on: number; off: number; onAmount: number; offAmount: number; onChange: (on: number, off: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const max = BLG_SOURCES - 1;
  const at = (u: number, v: number) => ({ x: 100 - 88 * u + 88 * v, y: 192 - 88 * u - 88 * v });
  const pick = (e: React.PointerEvent) => {
    const svg = ref.current; if (!svg) return;
    const r = canvasRect(svg), p = canvasPoint(e.clientX, e.clientY);
    const x = ((p.x - r.left) / r.width) * 200, y = ((p.y - r.top) / r.height) * 200;
    const dx = x - 100, dy = 192 - y;
    const u = Math.max(0, Math.min(1, (dy - dx) / 176)), v = Math.max(0, Math.min(1, (dy + dx) / 176));
    onChange(Math.round(u * max), Math.round(v * max));
  };
  const cur = at(on / max, off / max);
  const onTo = at(Math.max(0, Math.min(1, on / max + onAmount)), off / max);
  const offTo = at(on / max, Math.max(0, Math.min(1, off / max + offAmount)));
  const grid = [0.25, 0.5, 0.75];
  return (
    <svg ref={ref} viewBox="0 0 200 200" className="blg-diamond" role="slider" aria-label="On-beat and off-beat pattern" aria-valuetext={`On-beat ${on + 1}, off-beat ${off + 1}`} tabIndex={0}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = true; pick(e); }}
      onPointerMove={(e) => { if (drag.current) pick(e); }}
      onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
      onKeyDown={(e) => {
        const d = e.shiftKey ? 1 : 4;
        if (e.key === "ArrowLeft") onChange(Math.min(max, on + d), off);
        else if (e.key === "ArrowRight") onChange(on, Math.min(max, off + d));
        else if (e.key === "ArrowDown") onChange(Math.max(0, on - d), Math.max(0, off - d));
        else if (e.key === "ArrowUp") onChange(Math.min(max, on + d), Math.min(max, off + d));
        else return;
        e.preventDefault();
      }}>
      <polygon points="100,192 12,104 100,16 188,104" className="blg-diamond-face" />
      {grid.map((g) => { const a = at(g, 0), b = at(g, 1); return <line key={`u${g}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="blg-diamond-grid" />; })}
      {grid.map((g) => { const a = at(0, g), b = at(1, g); return <line key={`v${g}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="blg-diamond-grid" />; })}
      <line x1="100" y1="192" x2="12" y2="104" className="blg-diamond-edge-on" />
      <line x1="100" y1="192" x2="188" y2="104" className="blg-diamond-edge-off" />
      {onAmount !== 0 && <line x1={cur.x} y1={cur.y} x2={onTo.x} y2={onTo.y} className="blg-diamond-var-on" />}
      {offAmount !== 0 && <line x1={cur.x} y1={cur.y} x2={offTo.x} y2={offTo.y} className="blg-diamond-var-off" />}
      <circle cx={cur.x} cy={cur.y} r="7" className="blg-diamond-dot" />
      <text x="30" y="170" className="blg-diamond-num is-on">{on + 1}</text>
      <text x="170" y="170" textAnchor="end" className="blg-diamond-num is-off">{off + 1}</text>
      <text x="100" y="12" textAnchor="middle" className="blg-diamond-hint" dy="-1">BUSY</text>
      <text x="100" y="199" textAnchor="middle" className="blg-diamond-hint">SPARSE</text>
    </svg>
  );
}

const LOW = -12, HIGH = 24, ROWS = HIGH - LOW + 1, CELL_W = 12, ROW_H = 6;

/** Note display: pitch grid (root row marked), then velocity and tie lanes. Edits come back as a full line. */
export function BlgNoteDisplay({ line, root, onEdit, onAudition, playPos }: { line: (BlgCell | null)[]; root: number; onEdit: (l: (BlgCell | null)[]) => void; onAudition: (iv: number) => void; playPos: () => number | null }) {
  const L = line.length;
  const W = L * CELL_W, H = ROWS * ROW_H;
  const grid = useRef<SVGSVGElement>(null);
  const vel = useRef<SVGSVGElement>(null);
  const head = useRef<SVGRectElement>(null);
  const draw = useRef<{ mode: "add" | "erase"; last: number } | null>(null);
  const work = useRef(line);
  work.current = line;
  const [hover, setHover] = useState<{ s: number; iv: number } | null>(null);

  const posRef = useRef(playPos);
  posRef.current = playPos;
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = head.current; if (!el) return;
      const p = posRef.current();
      if (p == null) { el.setAttribute("opacity", "0"); return; }
      el.setAttribute("opacity", "1"); el.setAttribute("x", String(p * CELL_W));
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  const cellAt = (svg: SVGSVGElement, e: React.PointerEvent, h: number) => {
    const r = canvasRect(svg), p = canvasPoint(e.clientX, e.clientY);
    const s = Math.max(0, Math.min(L - 1, Math.floor(((p.x - r.left) / r.width) * L)));
    const y = ((p.y - r.top) / r.height) * h;
    return { s, y };
  };
  const ivFromY = (y: number) => Math.max(LOW, Math.min(HIGH, HIGH - Math.floor(y / ROW_H)));
  const commit = (next: (BlgCell | null)[]) => { work.current = fitTies(next); onEdit(work.current); };
  const place = (s: number, iv: number, mode: "add" | "erase") => {
    const next = work.current.slice();
    const cur = next[s];
    if (mode === "erase") { if (!cur) return; next[s] = null; }
    else {
      if (cur && cur.iv === iv) return;
      next[s] = { iv, vel: cur?.vel ?? 0.9, len: 1, lane: s % 2 === 0 ? "on" : "off", tie: cur?.tie ?? false };
      onAudition(iv);
    }
    commit(next);
  };
  const setVel = (s: number, y: number) => {
    const c = work.current[s]; if (!c) return;
    const v = Math.max(0.1, Math.min(1, 1 - y / 40));
    const next = work.current.slice(); next[s] = { ...c, vel: Math.round(v * 100) / 100 };
    commit(next);
  };

  return (
    <div className="blg-display">
      <div className="blg-display-scroll">
        <div className="blg-display-inner" style={{ minWidth: `${Math.max(32, L * 1.6)}rem` }}>
          <svg ref={grid} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="blg-grid" aria-label="Bassline notes"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              const { s, y } = cellAt(e.currentTarget, e, H);
              const iv = ivFromY(y);
              const mode = work.current[s]?.iv === iv ? "erase" : "add";
              draw.current = { mode, last: s };
              place(s, iv, mode);
            }}
            onPointerMove={(e) => {
              const { s, y } = cellAt(e.currentTarget, e, H);
              setHover({ s, iv: ivFromY(y) });
              if (!draw.current || draw.current.last === s) return;
              draw.current.last = s;
              place(s, ivFromY(y), draw.current.mode);
            }}
            onPointerUp={() => { draw.current = null; }} onPointerCancel={() => { draw.current = null; }} onPointerLeave={() => setHover(null)}>
            {Array.from({ length: ROWS }, (_, r) => {
              const iv = HIGH - r;
              return <rect key={r} x={0} y={r * ROW_H} width={W} height={ROW_H} className={`blg-row${iv === 0 ? " is-root" : iv % 12 === 0 ? " is-oct" : ""}`} />;
            })}
            {Array.from({ length: L + 1 }, (_, i) => <line key={i} x1={i * CELL_W} x2={i * CELL_W} y1={0} y2={H} className={i % 16 === 0 ? "blg-bar" : i % 4 === 0 ? "blg-beat" : "blg-sub"} />)}
            <rect ref={head} x={0} y={0} width={CELL_W} height={H} className="blg-head" opacity={0} />
            {hover && <rect x={hover.s * CELL_W} y={(HIGH - hover.iv) * ROW_H} width={CELL_W} height={ROW_H} className="blg-hover" />}
            {line.map((c, s) => c && (
              <rect key={s} x={s * CELL_W + 1} y={(HIGH - Math.max(LOW, Math.min(HIGH, c.iv))) * ROW_H} width={Math.max(3, c.len * CELL_W - 2)} height={ROW_H}
                rx={1.5} className={`blg-note is-${c.lane}`} style={{ opacity: 0.45 + c.vel * 0.55 }} />
            ))}
          </svg>
          <svg ref={vel} viewBox={`0 0 ${W} 40`} preserveAspectRatio="none" className="blg-vel" aria-label="Note velocities"
            onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const { s, y } = cellAt(e.currentTarget, e, 40); draw.current = { mode: "add", last: -1 }; setVel(s, y); }}
            onPointerMove={(e) => { if (!draw.current) return; const { s, y } = cellAt(e.currentTarget, e, 40); setVel(s, y); }}
            onPointerUp={() => { draw.current = null; }} onPointerCancel={() => { draw.current = null; }}>
            {line.map((c, s) => c && <rect key={s} x={s * CELL_W + 2} y={40 - c.vel * 40} width={CELL_W - 4} height={c.vel * 40} className={`blg-note is-${c.lane}`} />)}
          </svg>
          <div className="blg-ties" style={{ gridTemplateColumns: `repeat(${L}, minmax(0, 1fr))` }}>
            {line.map((c, s) => (
              <button key={s} type="button" disabled={!c} aria-pressed={!!c?.tie} aria-label={`Tie step ${s + 1} into the next note`}
                onClick={() => { if (!c) return; const next = work.current.slice(); next[s] = { ...c, tie: !c.tie, len: c.tie ? 1 : c.len }; commit(next); }}
                className={`blg-tie${c?.tie ? " is-on" : ""}`}>{c ? "→" : ""}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="blg-display-legend">
        <span>VEL ▲ drag</span><span>TIE → slides into next note</span>
        <span className="ml-auto">{hover ? `Step ${hover.s + 1} · ${NOTE_NAMES[(((root + hover.iv) % 12) + 12) % 12]}${hover.iv >= 12 ? " (up)" : hover.iv < 0 ? " (down)" : ""}` : "Root row is highlighted"}</span>
      </div>
    </div>
  );
}
