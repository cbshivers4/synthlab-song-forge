import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { cssVarOf } from "@/lib/display-cache";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Knob } from "../Knob";
import { getEngine } from "@/lib/synclab/audio-engine";
import { useStudio } from "@/lib/synclab/store";
import { BUILT_IN_PLUGINS, instantiate } from "@/lib/synclab/plugins";
import type { PluginInstance, Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { ROW } from "./shared";

/** A track's Channel EQ bands; the first move creates the real Channel EQ insert. Shared by desk and phone views. */
export function useTrackEq(t: Track) {
  const { updateTrack, setPluginParam, installedPlugins } = useStudio();
  const pendingEq = useRef<PluginInstance | null>(null);
  const eq = (t.plugins ?? []).find((p) => p.kind === "eq") ?? pendingEq.current;
  useEffect(() => { pendingEq.current = null; }, [t.plugins]);
  const setBand = (id: string, value: number) => {
    const current = eq ?? pendingEq.current;
    if (current) {
      setPluginParam(t.id, current.id, id, value);
      return;
    }
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (!def) return;
    const instance = instantiate(def);
    instance.params = instance.params.map((param) => param.id === id ? { ...param, value } : param);
    pendingEq.current = instance;
    updateTrack(t.id, { plugins: [...(t.plugins ?? []), instance] });
  };
  const band = (id: string) => eq?.params.find((param) => param.id === id)?.value ?? 0;
  return { eq, setBand, band };
}

/** Always-visible 3-band channel EQ. Creates a real Channel EQ insert on first use. */
export function ChannelEq({ t }: { t: Track }) {
  const { eq, setBand } = useTrackEq(t);
  const bands = [["high", "High"], ["mid", "Mid"], ["low", "Low"]] as const;
  return (
    <div
      className={cn(ROW.eq, "mx-channel-eq flex flex-col gap-1 border-b border-border/60 px-1.5 py-1")}
      style={{ "--primary": t.color } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-eq-knobs grid w-full grid-cols-3 gap-1">
        {bands.map(([id, label]) => <Knob key={id} label={label} value={eq?.params.find((param) => param.id === id)?.value ?? 0} min={-18} max={18} step={0.5} unit=" dB" size={32} onChange={(value) => setBand(id, value)} />)}
      </div>
      <div className="mx-eq-curve h-10 w-full shrink-0">
        <EqCurve
          scopeId={`ch:${t.id}`}
          bands={["low", "mid", "high"].map((id) => eq?.params.find((p) => p.id === id)?.value ?? 0) as [number, number, number]}
          color={t.color}
          bypass={!!eq?.bypass}
          onBand={(i, value) => { const id = ["low", "mid", "high"][i]; if (id) setBand(id, value); }}
        />
      </div>
    </div>
  );
}

/**
 * Interactive EQ curve display: shows the combined low/mid/high response,
 * drag a band handle up/down to set its gain, double-click a handle to reset.
 */
export function EqCurve({
  scopeId,
  bands,
  color,
  bypass,
  onBand,
}: {
  scopeId: string;
  bands: [number, number, number]; // [low, mid, high] gains in dB
  color: string;
  bypass: boolean;
  onBand: (index: number, gain: number) => void;
}) {
  const W = 100;
  const H = 46;
  const PAD = 3;
  const [lo, mid, hi] = bands;
  // Band handles sit at fixed x positions: LO 18%, MID 50%, HI 82%.
  const bandX = [18, 50, 82];
  const bandLabel = ["LO", "MID", "HI"];
  const bandGain = [lo, mid, hi];
  // Log-frequency response model (smooth shelves + bell), x in 0..100.
  const resp = (x: number) => {
    const t01 = x / 100; // 0 = 20 Hz, 1 = 20 kHz (log)
    const lowW = 1 / (1 + Math.exp((t01 - 0.28) * 10));
    const highW = 1 / (1 + Math.exp(-(t01 - 0.72) * 10));
    const midW = Math.exp(-Math.pow((t01 - 0.5) * 4.2, 2));
    return lo * lowW + mid * midW + hi * highW;
  };
  const yOf = (db: number) => PAD + (1 - (db + 18) / 36) * (H - PAD * 2);
  const xOf = (db: number) => yOf(db); // same vertical mapping for handles
  let path = "";
  for (let x = 0; x <= W; x += 2) {
    path += `${x === 0 ? "M" : "L"}${x.toFixed(1)},${yOf(resp(x)).toFixed(2)} `;
  }
  const areaPath = `${path}L${W},${yOf(0)} L0,${yOf(0)} Z`;
  const dragRef = useRef<{ band: number; startY: number; startGain: number } | null>(null);
  const [activeBand, setActiveBand] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const waveRef = useRef<SVGPathElement>(null);
  // 20 fps like every other display, with the colour read from a cache: a 60 fps loop that read
  // styles every frame on every channel stalled the page and made playback stumble.
  useEffect(() => {
    const draw = () => {
      const node = waveRef.current;
      if (node) {
        const wave = getEngine().getScopeWave(scopeId);
        if (!wave?.length) {
          node.setAttribute("d", `M0,${H / 2} L${W},${H / 2}`);
        } else {
          const stride = Math.max(1, Math.floor(wave.length / W));
          let wavePath = "";
          for (let i = 0; i < wave.length; i += stride) {
            const x = (i / Math.max(1, wave.length - 1)) * W;
            const sample = Math.max(-1, Math.min(1, wave[i] ?? 0));
            const y = H / 2 - sample * (H / 2 - PAD);
            wavePath += `${wavePath ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
          }
          node.setAttribute("d", wavePath);
          node.setAttribute("stroke", cssVarOf(node, "--display-wave"));
        }
      }
    };
    draw();
    const timer = window.setInterval(draw, 50);
    return () => window.clearInterval(timer);
  }, [scopeId]);
  const onPointerDown = (band: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers */
    }
    dragRef.current = { band, startY: canvasPoint(e.clientX, e.clientY).y, startGain: (bandGain[band] ?? 0) };
    setActiveBand(band);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const pxPerDb = (canvasRect(svgRef.current).height - PAD * 2 * 2) / 36;
    const fine = e.shiftKey ? 0.2 : 1;
    const next = Math.max(-18, Math.min(18, d.startGain - ((canvasPoint(e.clientX, e.clientY).y - d.startY) / Math.max(2, pxPerDb)) * fine));
    onBand(d.band, Math.round(next * 2) / 2);
  };
  const endDrag = () => {
    dragRef.current = null;
    setActiveBand(null);
  };
  return (
    <div className="flex h-full flex-col gap-0.5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn("w-full flex-1 rounded-sm border border-border/60 signal-screen", bypass && "opacity-40")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* grid: 0 dB line + ±12 dB hints */}
        <line x1="0" y1={yOf(0)} x2={W} y2={yOf(0)} stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <line x1="0" y1={yOf(12)} x2={W} y2={yOf(12)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        <line x1="0" y1={yOf(-12)} x2={W} y2={yOf(-12)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        {[25, 50, 75].map((x) => (
          <line key={x} x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
        ))}
        <path
          ref={waveRef}
          d={`M0,${H / 2} L${W},${H / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
          style={{ color }}
        />
        <path d={areaPath} fill={color} opacity={0.16} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {bandX.map((bx, i) => (
          <circle
            key={i}
            cx={bx}
            cy={xOf((bandGain[i] ?? 0))}
            r={activeBand === i ? 3.4 : 2.6}
            fill="var(--display-point)"
            stroke="var(--display-black)"
            strokeWidth="0.6"
            style={{ cursor: "ns-resize", touchAction: "none" }}
            onPointerDown={onPointerDown(i)}
            onDoubleClick={() => onBand(i, 0)}
          />
        ))}
      </svg>
      <div className="flex items-center justify-between font-mono text-[7px]">
        {bandGain.map((g, i) => (
          <span key={i} className={cn(activeBand === i ? "text-foreground" : "text-muted-foreground")}>
            {bandLabel[i]} <span style={{ color: g !== 0 ? color : undefined }}>{g > 0 ? `+${g.toFixed(0)}` : g.toFixed(0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
