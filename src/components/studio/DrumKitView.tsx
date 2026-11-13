import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getDrummer } from "@/lib/synclab/drummer-player";
import { padForRole, PIECE_OF, type DrumGenre, type DrummerSettings } from "@/lib/synclab/drummer";
import { KIT_VIEWBOX, kitHue, kitLayoutFor, pieceForRole, type KitPiece } from "@/lib/synclab/drum-kit-layout";
import type { Track } from "@/lib/synclab/types";
import { ACOUSTIC_TAP, acousticPieceFor, HitQueue, swingFor, type AcousticPiece } from "@/lib/synclab/kit-hits";
import type { DrumRole } from "@/lib/synclab/drummer";
import { RealDrumKit } from "./RealDrumKit";

const ACOUSTIC_LABEL: Record<AcousticPiece, string> = {
  kick: "Kick drum", snare: "Snare", hat: "Hi-hat", crash1: "Crash (left)", crash2: "Crash (right)", ride: "Ride",
  tomHi: "High tom", tomMid: "Mid tom", tomLo: "Floor tom (low)", cowbell: "Cowbell", tamb: "Tambourine",
};

/** Moves one piece of the real drum set the way a hit moves it (Web Animations — no re-render). */
function strike(root: SVGSVGElement | null, piece: AcousticPiece, vel: number, open?: boolean) {
  const el = root?.querySelector<SVGGElement>(`[data-kp="${piece}"]`);
  if (!el || typeof el.animate !== "function") return;
  const a = swingFor(vel);
  const glow = el.querySelectorAll<SVGElement>("[data-glow]");
  const flash = (peak: number, ms: number) => glow.forEach((g) => g.animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: "ease-out" }));
  const kind = el.getAttribute("data-kind");
  if (kind === "cymbal") {
    el.animate([
      { transform: "rotate(0deg) scaleY(1)" },
      { transform: `rotate(${-8 * a}deg) scaleY(${1 - 0.35 * a})`, offset: 0.08 },
      { transform: `rotate(${5 * a}deg) scaleY(${1 + 0.2 * a})`, offset: 0.3 },
      { transform: `rotate(${-3 * a}deg) scaleY(${1 - 0.1 * a})`, offset: 0.55 },
      { transform: `rotate(${1.2 * a}deg)`, offset: 0.78 },
      { transform: "rotate(0deg) scaleY(1)" },
    ], { duration: piece === "ride" ? 650 : 900 + 300 * a, easing: "ease-out" });
    flash(0.55 * a, 420);
  } else if (kind === "hat") {
    const top = el.querySelector<SVGGElement>("[data-hat-top]");
    if (open) top?.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-6 - 3 * a}px) rotate(${-4 * a}deg)`, offset: 0.12 },
      { transform: `translateY(${-6 - 3 * a}px) rotate(${2 * a}deg)`, offset: 0.6 }, { transform: "translateY(0)" }], { duration: 420, easing: "ease-out" });
    else top?.animate([{ transform: "translateY(0) rotate(0)" }, { transform: `translateY(1px) rotate(${-3 * a}deg)`, offset: 0.2 }, { transform: "translateY(0) rotate(0)" }], { duration: 170, easing: "ease-out" });
    flash(0.5 * a, open ? 380 : 160);
  } else if (kind === "kick") {
    el.querySelector<SVGGElement>("[data-head]")?.animate([{ transform: "scale(1)" }, { transform: `scale(${1 + 0.035 * a})`, offset: 0.25 }, { transform: "scale(1)" }],
      { duration: 160, easing: "ease-out" });
    el.animate([{ transform: "translateY(0)" }, { transform: `translateY(${1.6 * a}px)`, offset: 0.3 }, { transform: "translateY(0)" }], { duration: 150 });
    flash(0.35 * a, 200);
  } else if (kind === "drum") {
    el.querySelector<SVGGElement>("[data-head]")?.animate([{ transform: "scaleY(1)" }, { transform: `scaleY(${1 - 0.18 * a})`, offset: 0.25 }, { transform: "scaleY(1)" }],
      { duration: 150, easing: "ease-out" });
    el.animate([{ transform: "translateY(0)" }, { transform: `translateY(${1.8 * a}px)`, offset: 0.3 }, { transform: "translateY(0)" }], { duration: 140 });
    flash(0.6 * a, 200);
  } else {
    el.animate([{ transform: "rotate(0)" }, { transform: `rotate(${-10 * a}deg)`, offset: 0.25 }, { transform: `rotate(${6 * a}deg)`, offset: 0.6 }, { transform: "rotate(0)" }], { duration: 260 });
    flash(0.5 * a, 220);
  }
}

/**
 * The drummer's drum set: a different setup per genre group and a different finish per style.
 * Pieces flash as the drummer actually hits them (player.onHit, timed to when you hear them),
 * and tapping a piece plays that drum through the drummer's channel (not recorded).
 */
export function DrumKitView({ track, genre, settings }: { track: Track; genre: DrumGenre; settings: DrummerSettings }) {
  const layout = kitLayoutFor(genre.group);
  const svg = useRef<SVGSVGElement>(null);
  const realRef = useRef<HTMLDivElement>(null);
  const pads = track.pads ?? [];
  // band, rock and jazz styles always show the real drum set; the other styles can switch to it
  const acoustic = layout.style === "band" || layout.style === "rock" || layout.style === "jazz";
  const [setView, setSetView] = useState(false);
  const real = acoustic || setView;
  const realRefMirror = useRef(real);
  realRefMirror.current = real;

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

  // Hits arrive when they're scheduled (~0.3 s early) with the time you'll hear them; queue them and
  // move the piece when the audio clock gets there, checked every animation frame.
  useEffect(() => {
    const player = getDrummer();
    const queue = new HitQueue();
    let crashes = 0;
    const show = (role: DrumRole, vel: number) => {
      if (realRefMirror.current) {
        const m = acousticPieceFor(role, role === "crash" ? crashes++ : 0);
        strike(realRef.current?.querySelector("svg") ?? null, m.piece, vel, m.open);
      } else {
        const piece = pieceForRole(layout, role);
        if (piece) flash(piece.id, vel);
      }
    };
    const off = player.onHit((role, vel, when) => { if (player.trackId === track.id) queue.push({ at: when, role, vel }); });
    let raf = 0;
    const tick = () => {
      const now = getEngine().ctx?.currentTime ?? 0;
      for (const h of queue.drain(now)) show(h.role, h.vel);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { off(); cancelAnimationFrame(raf); queue.clear(); };
  }, [layout, track.id]);

  const playRoles = (roles: DrumRole[]) => {
    const engine = getEngine();
    engine.init();
    for (const role of roles) {
      const target = padForRole(pads, role);
      if (!target) continue;
      const pad = target.pitch ? { ...target.pad, pitch: target.pad.pitch + target.pitch } : target.pad;
      engine.playDrum(track.id, pad, 0.9);
      return true;
    }
    return false;
  };
  const tapReal = (piece: AcousticPiece) => {
    if (playRoles(ACOUSTIC_TAP[piece])) strike(realRef.current?.querySelector("svg") ?? null, piece, 0.9, false);
  };
  const realInfo = (piece: AcousticPiece) => {
    const roles = ACOUSTIC_TAP[piece];
    return { label: ACOUSTIC_LABEL[piece], can: roles.some((r) => padForRole(pads, r)), off: roles.every((r) => settings.pieces[PIECE_OF[r]] === false) };
  };

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

  const switcher = !acoustic && (
    <button type="button" className="kit-view-switch rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground"
      aria-pressed={setView} onClick={() => setSetView((v) => !v)} title="Show this style on a real drum set, or on its own setup">
      {setView ? `Show ${layout.name.toLowerCase()}` : "Show drum set"}
    </button>
  );
  if (real) {
    const finish = layout.style === "rock" ? "sparkle" : layout.style === "jazz" ? "wood" : "lacquer";
    return (
      <div ref={realRef} className="kit-view" data-kit={layout.style} data-kit-real="1" style={style}>
        {switcher}
        <RealDrumKit finish={finish} label={genre.label} info={realInfo} onTap={tapReal} />
        <span className="kit-caption">Drum set · watch it play · tap a drum or cymbal to hear it</span>
      </div>
    );
  }
  return (
    <div className="kit-view" data-kit={layout.style} style={style}>
      {switcher}
      <svg ref={svg} viewBox={`0 0 ${KIT_VIEWBOX.w} ${KIT_VIEWBOX.h}`} className="kit-svg" role="group" aria-label={`${genre.label} ${layout.name} — tap a drum to hear it`}>
        <rect className="kit-floor" x="0" y={KIT_VIEWBOX.h - 10} width={KIT_VIEWBOX.w} height="10" rx="3" />
        {layout.style === "pads" && <PadStation label={genre.label} />}
        {layout.style === "electronic" && <EModule label={genre.label} />}
        {layout.style === "rock" && <AmpWall />}
        {layout.style === "jazz" && <JazzStage />}
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

/** Rock kit backdrop: a wall of speaker cabinets behind the drums (decoration, not playable). */
function AmpWall() {
  return (
    <g aria-hidden="true" className="kit-ampwall">
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect className="kit-cab" x={8 + i * 78} y="56" width="72" height="70" rx="3" />
          <rect className="kit-cab-grille" x={13 + i * 78} y="61" width="62" height="60" rx="2" />
          <text className="kit-cab-logo" x={44 + i * 78} y="70" textAnchor="middle">SYNCLAB</text>
        </g>
      ))}
    </g>
  );
}

/** Jazz club stage: a warm spotlight and a curtain behind the bop kit. */
function JazzStage() {
  return (
    <g aria-hidden="true" className="kit-jazzstage">
      {Array.from({ length: 16 }, (_, i) => <rect key={i} className="kit-curtain" x={i * 20} y="0" width="12" height={KIT_VIEWBOX.h - 10} rx="6" />)}
      <ellipse className="kit-spot" cx="160" cy="118" rx="150" ry="22" />
      <text className="kit-cab-logo" x="160" y="10" textAnchor="middle">SYNCLAB JAZZ CLUB</text>
    </g>
  );
}

function EModule({ label }: { label: string }) {
  return (<>
    <line className="kit-stand" x1="160" y1="30" x2="160" y2="56" />
    <rect className="kit-rubber" x="124" y="4" width="72" height="26" rx="3" />
    <rect className="kit-screen" x="130" y="8" width="60" height="18" rx="2" />
    <text className="kit-screen-text" x="160" y="21" textAnchor="middle">{label.toUpperCase().slice(0, 12)}</text>
  </>);
}
