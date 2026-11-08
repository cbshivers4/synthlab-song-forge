import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getDrummer } from "@/lib/synclab/drummer-player";
import { padForRole, PIECE_OF, type DrumGenre, type DrummerSettings } from "@/lib/synclab/drummer";
import { KIT_VIEWBOX, kitHue, kitLayoutFor, pieceForRole, type KitPiece } from "@/lib/synclab/drum-kit-layout";
import type { Track } from "@/lib/synclab/types";

/**
 * The drummer's drum set: a different setup per genre group and a different finish per style.
 * Pieces flash as the drummer actually hits them (player.onHit, timed to when you hear them),
 * and tapping a piece plays that drum through the drummer's channel (not recorded).
 */
export function DrumKitView({ track, genre, settings }: { track: Track; genre: DrumGenre; settings: DrummerSettings }) {
  const layout = kitLayoutFor(genre.group);
  const svg = useRef<SVGSVGElement>(null);
  const pads = track.pads ?? [];

  const flash = (id: string, vel: number) => {
    const el = svg.current?.querySelector<SVGGElement>(`[data-piece="${id}"]`);
    if (!el || typeof el.animate !== "function") return;
    const shape = el.getAttribute("data-shape");
    const cym = shape === "cymbal" || shape === "hat" || shape === "cympad";
    const glow = 1.35 + vel * 0.9;
    el.animate(
      cym
        ? [{ transform: "rotate(-5deg)", filter: `brightness(${glow})` }, { transform: "rotate(3deg)", offset: 0.35 }, { transform: "rotate(0deg)", filter: "brightness(1)" }]
        : [{ transform: `scale(${1 + vel * 0.06})`, filter: `brightness(${glow})` }, { transform: "scale(1)", filter: "brightness(1)" }],
      { duration: cym ? 320 : 180, easing: "ease-out" },
    );
  };

  useEffect(() => {
    const player = getDrummer();
    return player.onHit((role, vel) => {
      if (player.trackId !== track.id) return;
      const piece = pieceForRole(layout, role);
      if (piece) flash(piece.id, vel);
    });
  }, [layout, track.id]);

  const tap = (piece: KitPiece) => {
    const engine = getEngine();
    engine.init();
    for (const role of piece.roles) {
      const target = padForRole(pads, role);
      if (!target) continue;
      const pad = target.pitch ? { ...target.pad, pitch: target.pad.pitch + target.pitch } : target.pad;
      engine.playDrum(track.id, pad, 0.9);
      break;
    }
    flash(piece.id, 0.9);
  };

  const style = { "--kit-hue": String(kitHue(genre.id)) } as CSSProperties;
  const playable = useMemo(() => new Set(layout.pieces.filter((x) => x.roles.some((r) => padForRole(pads, r))).map((x) => x.id)), [layout, pads]);

  return (
    <div className="kit-view" data-kit={layout.style} style={style}>
      <svg ref={svg} viewBox={`0 0 ${KIT_VIEWBOX.w} ${KIT_VIEWBOX.h}`} className="kit-svg" role="group" aria-label={`${genre.label} ${layout.name} — tap a drum to hear it`}>
        <rect className="kit-floor" x="0" y={KIT_VIEWBOX.h - 10} width={KIT_VIEWBOX.w} height="10" rx="3" />
        {layout.style === "pads" && <PadStation label={genre.label} />}
        {layout.style === "electronic" && <EModule label={genre.label} />}
        {layout.pieces.map((piece) => {
          const off = piece.roles.every((r) => settings.pieces[PIECE_OF[r]] === false);
          const can = playable.has(piece.id);
          return (
            <g key={piece.id} data-piece={piece.id} data-shape={piece.shape}
              className={`kit-piece${off ? " is-off" : ""}${can ? "" : " is-empty"}`}
              role="button" tabIndex={can ? 0 : -1} aria-label={`${piece.label}${off ? " (muted for the drummer)" : ""}`} aria-disabled={!can}
              onPointerDown={(e) => { if (!can) return; e.preventDefault(); tap(piece); }}
              onKeyDown={(e) => { if (can && e.key === "Enter") { e.preventDefault(); tap(piece); } }}>
              <title>{piece.label}</title>
              <Piece piece={piece} />
            </g>
          );
        })}
      </svg>
      <span className="kit-caption">{layout.name} · tap a drum to hear it</span>
    </div>
  );
}

function Piece({ piece }: { piece: KitPiece }): ReactNode {
  const { x, y, w, h, shape } = piece;
  const r = w / 2;
  switch (shape) {
    case "cymbal":
      return (<>
        <line className="kit-stand" x1={x} y1={y} x2={x} y2={KIT_VIEWBOX.h - 8} />
        <ellipse className="kit-metal" cx={x} cy={y} rx={r} ry={h / 2} />
        <ellipse className="kit-metal-ring" cx={x} cy={y} rx={r * 0.62} ry={h * 0.3} />
        <ellipse className="kit-bell" cx={x} cy={y - 1} rx={r * 0.16} ry={h * 0.22} />
      </>);
    case "hat":
      return (<>
        <line className="kit-stand" x1={x} y1={y} x2={x} y2={KIT_VIEWBOX.h - 8} />
        <ellipse className="kit-metal" cx={x} cy={y + 3} rx={r} ry={h / 2} />
        <ellipse className="kit-metal" cx={x} cy={y - 2} rx={r} ry={h / 2} />
        <ellipse className="kit-bell" cx={x} cy={y - 3} rx={r * 0.18} ry={h * 0.25} />
      </>);
    case "drum": {
      const top = h * 0.36;
      return (<>
        <rect className="kit-shell" x={x - r} y={y} width={w} height={h} />
        <ellipse className="kit-shell" cx={x} cy={y + h} rx={r} ry={top} />
        {[0.2, 0.5, 0.8].map((f) => <line key={f} className="kit-lug" x1={x - r + w * f} y1={y + 2} x2={x - r + w * f} y2={y + h + top * 0.6} />)}
        <ellipse className="kit-head" cx={x} cy={y} rx={r} ry={top} />
        <ellipse className="kit-hoop" cx={x} cy={y} rx={r} ry={top} />
      </>);
    }
    case "kick":
      return (<>
        <line className="kit-stand" x1={x - r * 0.7} y1={y + r * 0.5} x2={x - r - 6} y2={KIT_VIEWBOX.h - 8} />
        <line className="kit-stand" x1={x + r * 0.7} y1={y + r * 0.5} x2={x + r + 6} y2={KIT_VIEWBOX.h - 8} />
        <circle className="kit-shell" cx={x} cy={y} r={r} />
        <circle className="kit-head-front" cx={x} cy={y} r={r - 5} />
        <circle className="kit-hoop" cx={x} cy={y} r={r - 1} />
        <text className="kit-logo" x={x} y={y + 3} textAnchor="middle" fontSize={Math.max(7, r * 0.26)}>SYNCLAB</text>
      </>);
    case "tower":
      return (<>
        <rect className="kit-rubber" x={x - r} y={y - h / 2} width={w} height={h} rx="5" />
        <circle className="kit-mesh" cx={x} cy={y - 2} r={r * 0.72} />
        <circle className="kit-led-ring" cx={x} cy={y - 2} r={r * 0.72} />
      </>);
    case "hexpad": {
      const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${x + r * Math.cos(a)},${y + r * 0.62 * Math.sin(a)}`; }).join(" ");
      return (<>
        <line className="kit-stand" x1={x} y1={y + r * 0.5} x2={x} y2={KIT_VIEWBOX.h - 8} />
        <polygon className="kit-rubber" points={pts} />
        <polygon className="kit-mesh kit-hex-inner" points={pts} transform={`translate(${x} ${y}) scale(0.78) translate(${-x} ${-y})`} />
        <polygon className="kit-led-ring" points={pts} />
      </>);
    }
    case "cympad":
      return (<>
        <line className="kit-stand" x1={x} y1={y} x2={x} y2={KIT_VIEWBOX.h - 8} />
        <ellipse className="kit-rubber" cx={x} cy={y} rx={r} ry={h / 2} />
        <ellipse className="kit-led-ring" cx={x} cy={y} rx={r} ry={h / 2} />
      </>);
    case "sqpad":
      return (<>
        <rect className="kit-rubber" x={x - r} y={y - h * 0.32} width={w} height={h * 0.64} rx="4" />
        <rect className="kit-led-ring" x={x - r} y={y - h * 0.32} width={w} height={h * 0.64} rx="4" />
        <text className="kit-pad-label" x={x} y={y + 3} textAnchor="middle">{piece.label.replace(/^Perc pad /, "P")}</text>
      </>);
    case "beatpad":
      return (<>
        <rect className="kit-beatpad" x={x - r} y={y - h / 2} width={w} height={h} rx="4" />
        <text className="kit-pad-label" x={x} y={y + 3} textAnchor="middle">{piece.label.toUpperCase()}</text>
      </>);
    case "conga":
      return (<>
        <path className="kit-shell" d={`M${x - r} ${y} Q${x - r - 5} ${y + h * 0.45} ${x - r * 0.7} ${y + h} L${x + r * 0.7} ${y + h} Q${x + r + 5} ${y + h * 0.45} ${x + r} ${y} Z`} />
        <line className="kit-lug" x1={x - r * 0.4} y1={y + 2} x2={x - r * 0.3} y2={y + h - 2} />
        <line className="kit-lug" x1={x + r * 0.4} y1={y + 2} x2={x + r * 0.3} y2={y + h - 2} />
        <ellipse className="kit-head kit-skin" cx={x} cy={y} rx={r} ry={r * 0.3} />
        <ellipse className="kit-hoop" cx={x} cy={y} rx={r} ry={r * 0.3} />
      </>);
    case "bongos": {
      const d = w * 0.24;
      return (<>
        <rect className="kit-metal" x={x - 4} y={y + 2} width="8" height={h * 0.5} />
        {[x - d - 3, x + d + 3].map((cx, i) => (
          <g key={cx}>
            <rect className="kit-shell" x={cx - d} y={y} width={d * 2} height={h} />
            <ellipse className="kit-head kit-skin" cx={cx} cy={y} rx={d * (i ? 1.1 : 1)} ry={d * 0.32} />
            <ellipse className="kit-hoop" cx={cx} cy={y} rx={d * (i ? 1.1 : 1)} ry={d * 0.32} />
          </g>
        ))}
      </>);
    }
    case "cowbell":
      return <path className="kit-metal" d={`M${x - r * 0.55} ${y - h / 2} L${x + r * 0.55} ${y - h / 2} L${x + r} ${y + h / 2} L${x - r} ${y + h / 2} Z`} />;
    case "tamb":
      return (<>
        <circle className="kit-shell" cx={x} cy={y} r={r} />
        <circle className="kit-head kit-skin" cx={x} cy={y} r={r - 3} />
        {Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return <circle key={i} className="kit-jingle" cx={x + (r - 1) * Math.cos(a)} cy={y + (r - 1) * Math.sin(a)} r="2.6" />; })}
      </>);
    case "shaker":
      return <rect className="kit-shell" x={x - r} y={y - h / 2} width={w} height={h} rx={h / 2} />;
    case "clave":
      return (<>
        <rect className="kit-wood" x={x - r} y={y - h / 2} width={w} height={h * 0.4} rx={h * 0.2} transform={`rotate(-8 ${x} ${y})`} />
        <rect className="kit-wood" x={x - r} y={y + h * 0.1} width={w} height={h * 0.4} rx={h * 0.2} transform={`rotate(6 ${x} ${y})`} />
      </>);
  }
}

function PadStation({ label }: { label: string }) {
  return (<>
    <rect className="kit-station" x="10" y="4" width="300" height="124" rx="8" />
    <rect className="kit-screen" x="22" y="14" width="96" height="40" rx="3" />
    <text className="kit-screen-text" x="70" y="31" textAnchor="middle">{label.toUpperCase().slice(0, 14)}</text>
    <text className="kit-screen-sub" x="70" y="45" textAnchor="middle">BEAT PADS</text>
    {[0, 1, 2].map((i) => <circle key={i} className="kit-station-knob" cx={38 + i * 32} cy="76" r="9" />)}
    {[0, 1, 2, 3].map((i) => <rect key={i} className="kit-station-btn" x={24 + i * 24} y="98" width="18" height="10" rx="2" />)}
  </>);
}

function EModule({ label }: { label: string }) {
  return (<>
    <line className="kit-stand" x1="160" y1="30" x2="160" y2="56" />
    <rect className="kit-rubber" x="124" y="4" width="72" height="26" rx="3" />
    <rect className="kit-screen" x="130" y="8" width="60" height="18" rx="2" />
    <text className="kit-screen-text" x="160" y="21" textAnchor="middle">{label.toUpperCase().slice(0, 12)}</text>
  </>);
}
