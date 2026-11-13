import { useId, type ReactNode } from "react";
import type { AcousticPiece } from "@/lib/synclab/kit-hits";
import "./real-drum-kit.css";

/**
 * A real-looking acoustic drum set, seen from the front: kick with front head and port, snare on
 * its stand, hi-hat (two cymbals on a stand with pedal), high and mid rack toms, floor tom on legs,
 * two crashes and a ride on boom stands, cowbell on the kick mount and a tambourine on the hat
 * stand, on a rug. Pure drawing: DrumKitView moves each piece (data-kp) when the drummer hits it.
 */
export const VIEW = { w: 680, h: 360 } as const;
const FLOOR = 340;

type Tap = (piece: AcousticPiece) => void;
type PieceInfo = { label: string; can: boolean; off: boolean };

export function RealDrumKit({ finish, label, info, onTap }: {
  finish: "lacquer" | "sparkle" | "wood";
  label: string;
  info: (p: AcousticPiece) => PieceInfo;
  onTap: Tap;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const u = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${u(n)})`;

  const k = { info, onTap };

  const cymbal = (piece: AcousticPiece, cx: number, cy: number, rx: number, tilt: number, standX: number) => {
    const ry = rx * 0.2;
    return (
      <>
        <BoomStand x={cx} y={cy} footX={standX} chrome={url("chrome")} />
        <Hit piece={piece} k={k}>
          <g transform={`rotate(${tilt} ${cx} ${cy})`}>
            <g data-kp={piece} data-kind="cymbal" className="kr-anim">
              <ellipse cx={cx} cy={cy + 1.5} rx={rx} ry={ry} className="kr-cym-edge" />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
              {[0.82, 0.64, 0.46, 0.3].map((f) => <ellipse key={f} cx={cx} cy={cy - (1 - f) * 1.5} rx={rx * f} ry={ry * f} className="kr-lathe" />)}
              <ellipse cx={cx} cy={cy - 2.5} rx={rx * 0.17} ry={ry * 0.55} fill={url("bell")} className="kr-cym" />
              <path d={`M${cx - rx * 0.78} ${cy - ry * 0.25} Q${cx - rx * 0.2} ${cy - ry * 1.05} ${cx + rx * 0.5} ${cy - ry * 0.55}`} className="kr-shine" />
              <ellipse data-glow cx={cx} cy={cy} rx={rx} ry={ry} className="kr-glow" />
              <circle cx={cx} cy={cy - 3} r={2.2} fill={url("chrome")} />
            </g>
          </g>
        </Hit>
      </>
    );
  };

  /** A drum seen from slightly above: shell, lugs, hoops and the batter head on top. */
  const drum = (piece: AcousticPiece, cx: number, top: number, r: number, depth: number, opts: { chromeShell?: boolean; strainer?: boolean } = {}) => {
    const ry = r * 0.3;
    const shell = opts.chromeShell ? url("chrome") : url("shell");
    const lugs = Math.max(4, Math.round(r / 11));
    return (
      <Hit piece={piece} k={k}>
        <g data-kp={piece} data-kind="drum" className="kr-anim">
          <path d={`M${cx - r} ${top} L${cx - r} ${top + depth} A${r} ${ry} 0 0 0 ${cx + r} ${top + depth} L${cx + r} ${top} Z`} fill={shell} className="kr-shell" />
          {finish === "sparkle" && !opts.chromeShell && <path d={`M${cx - r} ${top} L${cx - r} ${top + depth} A${r} ${ry} 0 0 0 ${cx + r} ${top + depth} L${cx + r} ${top} Z`} fill={url("sparkle")} />}
          {finish === "wood" && !opts.chromeShell && <path d={`M${cx - r} ${top} L${cx - r} ${top + depth} A${r} ${ry} 0 0 0 ${cx + r} ${top + depth} L${cx + r} ${top} Z`} fill={url("grain")} />}
          {/* bottom hoop */}
          <path d={`M${cx - r - 1.5} ${top + depth - 3} A${r + 1.5} ${ry} 0 0 0 ${cx + r + 1.5} ${top + depth - 3}`} className="kr-hoop-line" stroke={url("chrome")} />
          {/* lugs + tension rods */}
          {Array.from({ length: lugs }, (_, k) => {
            const f = (k + 0.5) / lugs;
            const x = cx - r + f * 2 * r;
            const bow = Math.sqrt(Math.max(0, 1 - ((x - cx) / r) ** 2)) * ry;
            const lugY = top + depth * 0.5 + bow * 0.55;
            return (
              <g key={k}>
                <line x1={x} y1={top + bow + 2} x2={x} y2={top + depth + bow - 3} className="kr-rod" />
                <rect x={x - 2.6} y={lugY - Math.min(9, depth * 0.22)} width={5.2} height={Math.min(18, depth * 0.44)} rx={2.4} fill={url("chrome")} className="kr-lug" />
              </g>
            );
          })}
          {opts.strainer && <rect x={cx + r * 0.35} y={top + depth * 0.35} width={10} height={depth * 0.4} rx={1.5} fill={url("chrome")} />}
          {/* batter head + top hoop */}
          <g data-head>
            <ellipse cx={cx} cy={top} rx={r} ry={ry} fill={url("head")} className="kr-head" />
            <ellipse cx={cx} cy={top} rx={r * 0.38} ry={ry * 0.38} className="kr-head-dot" />
            <ellipse data-glow cx={cx} cy={top} rx={r} ry={ry} className="kr-glow" />
          </g>
          <ellipse cx={cx} cy={top} rx={r + 1.5} ry={ry + 0.8} className="kr-hoop" stroke={url("chrome")} />
        </g>
      </Hit>
    );
  };

  const kick = () => {
    const cx = 340, cy = 250, r = 82;
    return (
      <Hit piece="kick" k={k}>
        {/* spurs */}
        <line x1={cx - r * 0.78} y1={cy + r * 0.45} x2={cx - r - 12} y2={FLOOR} className="kr-stand" />
        <line x1={cx + r * 0.78} y1={cy + r * 0.45} x2={cx + r + 12} y2={FLOOR} className="kr-stand" />
        <g data-kp="kick" data-kind="kick" className="kr-anim">
          <circle cx={cx} cy={cy} r={r} fill={url("shell")} />
          {finish === "sparkle" && <circle cx={cx} cy={cy} r={r} fill={url("sparkle")} />}
          {finish === "wood" && <circle cx={cx} cy={cy} r={r} fill={url("grain")} />}
          {/* wood hoop with an inlay, tension rods and claws */}
          <circle cx={cx} cy={cy} r={r - 4} className="kr-kick-hoop" />
          {Array.from({ length: 10 }, (_, k) => {
            const a = (k / 10) * Math.PI * 2 + Math.PI / 10;
            const x = cx + Math.cos(a) * (r - 3), y = cy + Math.sin(a) * (r - 3);
            return <rect key={k} x={x - 3} y={y - 3} width={6} height={6} rx={1.5} fill={url("chrome")} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
          })}
          <g data-head>
            <circle cx={cx} cy={cy} r={r - 10} fill={url("reso")} className="kr-reso" />
            <circle cx={cx} cy={cy} r={r - 10} className="kr-reso-ring" />
            <text x={cx} y={cy - 4} textAnchor="middle" className="kr-logo">SYNCLAB</text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="kr-logo-sub">{label.toUpperCase().slice(0, 22)}</text>
            <circle cx={cx + r * 0.42} cy={cy + r * 0.38} r={r * 0.15} className="kr-port" />
            <circle data-glow cx={cx} cy={cy} r={r - 10} className="kr-glow" />
          </g>
        </g>
      </Hit>
    );
  };

  const hats = () => {
    const cx = 72, y = 172, rx = 56, ry = rx * 0.19;
    return (
      <>
        {/* stand, tripod and pedal */}
        <line x1={cx} y1={y - 12} x2={cx} y2={FLOOR - 16} className="kr-stand is-thick" />
        <line x1={cx} y1={FLOOR - 30} x2={cx - 30} y2={FLOOR} className="kr-stand" />
        <line x1={cx} y1={FLOOR - 30} x2={cx + 30} y2={FLOOR} className="kr-stand" />
        <path d={`M${cx - 9} ${FLOOR - 2} L${cx + 9} ${FLOOR - 2} L${cx + 6} ${FLOOR - 16} L${cx - 6} ${FLOOR - 16} Z`} className="kr-pedal" />
        <Hit piece="hat" k={k}>
          <g data-kp="hat" data-kind="hat">
            <g className="kr-anim">
              <ellipse cx={cx} cy={y + 1.5} rx={rx} ry={ry} className="kr-cym-edge" />
              <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
            </g>
            <g data-hat-top className="kr-anim">
              <ellipse cx={cx} cy={y - 5} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
              {[0.78, 0.55, 0.34].map((f) => <ellipse key={f} cx={cx} cy={y - 5} rx={rx * f} ry={ry * f} className="kr-lathe" />)}
              <ellipse cx={cx} cy={y - 7} rx={rx * 0.2} ry={ry * 0.6} fill={url("bell")} className="kr-cym" />
              <ellipse data-glow cx={cx} cy={y - 5} rx={rx} ry={ry} className="kr-glow" />
              <rect x={cx - 2.5} y={y - 14} width={5} height={8} rx={1} fill={url("chrome")} />
            </g>
          </g>
        </Hit>
      </>
    );
  };

  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="kr-svg" data-finish={finish} role="group" aria-label={`${label} drum set — tap a drum or cymbal to hear it`}>
      <defs>
        <radialGradient id={u("bronze")} cx="45%" cy="35%" r="75%">
          <stop offset="0" style={{ stopColor: "var(--kr-bronze-hi)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--kr-bronze)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-bronze-lo)" }} />
        </radialGradient>
        <radialGradient id={u("bell")} cx="40%" cy="30%" r="80%">
          <stop offset="0" style={{ stopColor: "var(--kr-bronze-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-bronze)" }} />
        </radialGradient>
        <linearGradient id={u("chrome")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--kr-chrome-hi)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--kr-chrome)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-chrome-lo)" }} />
        </linearGradient>
        <linearGradient id={u("shell")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--kr-shell-lo)" }} />
          <stop offset="0.3" style={{ stopColor: "var(--kr-shell-hi)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--kr-shell)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-shell-lo)" }} />
        </linearGradient>
        <radialGradient id={u("head")} cx="40%" cy="35%" r="80%">
          <stop offset="0" style={{ stopColor: "var(--kr-head-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-head)" }} />
        </radialGradient>
        <radialGradient id={u("reso")} cx="40%" cy="35%" r="85%">
          <stop offset="0" style={{ stopColor: "var(--kr-reso-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-reso)" }} />
        </radialGradient>
        <radialGradient id={u("rug")} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: "var(--kr-rug-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-rug)" }} />
        </radialGradient>
        <pattern id={u("sparkle")} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2" r="0.7" className="kr-flake" />
          <circle cx="5" cy="5.5" r="0.5" className="kr-flake" />
        </pattern>
        <pattern id={u("grain")} width="40" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 2 Q10 0.5 20 2 T40 2" className="kr-grain" />
          <path d="M0 5 Q12 3.8 22 5 T40 5" className="kr-grain" />
        </pattern>
      </defs>

      {/* room: wall, a rug under the kit */}
      <rect x="0" y="0" width={VIEW.w} height={VIEW.h} className="kr-wall" />
      <ellipse cx="340" cy={FLOOR - 4} rx="330" ry="30" fill={url("rug")} />
      <ellipse cx="340" cy={FLOOR - 4} rx="318" ry="26" className="kr-rug-border" />

      {cymbal("crash2", 470, 62, 76, 9, 440)}
      {cymbal("ride", 604, 126, 72, 13, 640)}

      {/* floor tom on three legs */}
      <line x1={490} y1={236} x2={474} y2={FLOOR} className="kr-stand" />
      <line x1={574} y1={236} x2={592} y2={FLOOR} className="kr-stand" />
      {drum("tomLo", 532, 198, 58, 96)}

      {kick()}

      {/* tom holder on the kick, with the cowbell on it */}
      <line x1={340} y1={172} x2={340} y2={136} className="kr-stand is-thick" />
      <line x1={340} y1={140} x2={298} y2={150} className="kr-stand" />
      <line x1={340} y1={140} x2={386} y2={146} className="kr-stand" />
      {drum("tomHi", 284, 118, 40, 44)}
      {drum("tomMid", 398, 112, 46, 50)}
      <Hit piece="cowbell" k={k}>
        <g data-kp="cowbell" data-kind="shake" className="kr-anim">
          <path d="M332 128 L348 128 L354 150 L326 150 Z" fill={url("chrome")} className="kr-cowbell" />
          <ellipse cx="340" cy="150" rx="14" ry="3" className="kr-cowbell-mouth" />
          <ellipse data-glow cx="340" cy="140" rx="14" ry="11" className="kr-glow" />
        </g>
      </Hit>

      {/* snare on its basket stand */}
      <line x1={175} y1={252} x2={175} y2={FLOOR - 28} className="kr-stand is-thick" />
      <line x1={175} y1={FLOOR - 28} x2={146} y2={FLOOR} className="kr-stand" />
      <line x1={175} y1={FLOOR - 28} x2={204} y2={FLOOR} className="kr-stand" />
      {drum("snare", 175, 214, 52, 28, { chromeShell: finish !== "wood", strainer: true })}

      {hats()}
      <Hit piece="tamb" k={k}>
        <g data-kp="tamb" data-kind="shake" className="kr-anim">
          <circle cx="72" cy="252" r="15" className="kr-tamb" />
          <circle cx="72" cy="252" r="11" fill={url("head")} />
          {Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return <circle key={k} cx={72 + Math.cos(a) * 14} cy={252 + Math.sin(a) * 14} r="2.6" fill={url("chrome")} />; })}
          <circle data-glow cx="72" cy="252" r="15" className="kr-glow" />
        </g>
      </Hit>

      {cymbal("crash1", 168, 76, 82, -11, 120)}
    </svg>
  );
}

/** A cymbal stand: a tripod on the floor and an upright to the cymbal (with a short boom). */
function BoomStand({ x, y, footX, chrome }: { x: number; y: number; footX: number; chrome: string }) {
  const kneeY = FLOOR - 34;
  return (
    <g aria-hidden="true">
      <line x1={footX} y1={kneeY} x2={footX} y2={y + 46} className="kr-stand is-thick" />
      <line x1={footX} y1={y + 46} x2={x} y2={y + 4} className="kr-stand" />
      <line x1={footX} y1={kneeY} x2={footX - 28} y2={FLOOR} className="kr-stand" />
      <line x1={footX} y1={kneeY} x2={footX + 28} y2={FLOOR} className="kr-stand" />
      <line x1={footX} y1={kneeY} x2={footX + 4} y2={FLOOR - 6} className="kr-stand" />
    </g>
  );
}

/** One playable piece: tap or Enter plays it. A module-level component so re-renders never remount the artwork mid-animation. */
function Hit({ piece, k, children }: { piece: AcousticPiece; k: { info: (p: AcousticPiece) => PieceInfo; onTap: Tap }; children: ReactNode }) {
  const i = k.info(piece);
  return (
    <g data-kp-wrap={piece} className={`kr-piece${i.off ? " is-off" : ""}${i.can ? "" : " is-empty"}`} role="button" tabIndex={i.can ? 0 : -1}
      aria-label={`${i.label}${i.off ? " (muted for the drummer)" : ""}`} aria-disabled={!i.can}
      onPointerDown={(e) => { if (!i.can) return; e.preventDefault(); k.onTap(piece); }}
      onKeyDown={(e) => { if (i.can && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); k.onTap(piece); } }}>
      <title>{i.label}</title>
      {children}
    </g>
  );
}
