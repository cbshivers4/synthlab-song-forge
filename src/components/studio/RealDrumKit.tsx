import { useId, type ReactNode } from "react";
import type { AcousticPiece } from "@/lib/synclab/kit-hits";
import "./real-drum-kit.css";

/**
 * A real-looking acoustic drum set seen from above and behind the drummer's seat (studio-photo
 * angle): black shells with white heads, brass cymbals and chrome hardware on a light studio floor.
 * Hi-hat front left, snare in front, high and mid rack toms on the kick, floor tom front right,
 * kick with its pedal at the bottom, crash left, ride right and a second crash at the back, plus a
 * cowbell on the tom holder and a tambourine on the hat stand. Pure drawing: DrumKitView moves each
 * piece (data-kp) when the drummer hits it.
 */
export const VIEW = { w: 800, h: 600 } as const;

type Tap = (piece: AcousticPiece) => void;
type PieceInfo = { label: string; can: boolean; off: boolean };

export function RealDrumKit({
  finish,
  label,
  info,
  onTap,
}: {
  finish: "lacquer" | "sparkle" | "wood";
  label: string;
  info: (p: AcousticPiece) => PieceInfo;
  onTap: Tap;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const u = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${u(n)})`;
  const k = { info, onTap };

  /** Shell finish overlay (sparkle flakes or wood grain) clipped to a shape. */
  const finishFill = (d: string) => (
    <>
      {finish === "sparkle" && <path d={d} fill={url("sparkle")} />}
      {finish === "wood" && <path d={d} fill={url("grain")} />}
    </>
  );

  /** A cymbal seen from above: brass disc with lathe rings, light spokes, bell and felt/nut. */
  const cymbal = (piece: AcousticPiece, cx: number, cy: number, rx: number, tilt: number) => {
    const ry = rx * 0.74;
    return (
      <Hit piece={piece} k={k}>
        <g transform={`rotate(${tilt} ${cx} ${cy})`}>
          <g data-kp={piece} data-kind="cymbal" className="kr-anim">
            <ellipse cx={cx} cy={cy + 3} rx={rx} ry={ry} className="kr-cym-edge" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
            {[0.9, 0.78, 0.66, 0.54, 0.42, 0.3].map((f) => (
              <ellipse key={f} cx={cx} cy={cy} rx={rx * f} ry={ry * f} className="kr-lathe" />
            ))}
            {[-0.5, 0.35, 1.9, 2.8].map((a) => (
              <path
                key={a}
                d={`M${cx} ${cy} L${cx + Math.cos(a - 0.12) * rx * 0.97} ${cy + Math.sin(a - 0.12) * ry * 0.97} A${rx} ${ry} 0 0 1 ${cx + Math.cos(a + 0.12) * rx * 0.97} ${cy + Math.sin(a + 0.12) * ry * 0.97} Z`}
                className="kr-spoke"
              />
            ))}
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx * 0.2}
              ry={ry * 0.2}
              fill={url("bell")}
              className="kr-cym"
            />
            <ellipse data-glow cx={cx} cy={cy} rx={rx} ry={ry} className="kr-glow" />
            <circle cx={cx} cy={cy} r={3.2} className="kr-nut" />
            <line x1={cx} y1={cy} x2={cx} y2={cy - 9} className="kr-stand-core" />
          </g>
        </g>
      </Hit>
    );
  };

  /** A drum seen from above: glossy shell side below the rim, chrome lugs, hoops and a white head. */
  const drum = (
    piece: AcousticPiece,
    cx: number,
    top: number,
    rx: number,
    ry: number,
    depth: number,
    opts: { strainer?: boolean } = {},
  ) => {
    const d = `M${cx - rx} ${top} L${cx - rx} ${top + depth} A${rx} ${ry} 0 0 0 ${cx + rx} ${top + depth} L${cx + rx} ${top} Z`;
    const lugs = Math.max(5, Math.round(rx / 10));
    return (
      <Hit piece={piece} k={k}>
        <g data-kp={piece} data-kind="drum" className="kr-anim">
          <path d={d} fill={url("shell")} className="kr-shell" />
          {finishFill(d)}
          <path
            d={`M${cx - rx * 0.62} ${top + ry * 0.75} L${cx - rx * 0.62} ${top + depth + ry * 0.72}`}
            className="kr-gloss"
          />
          <path
            d={`M${cx - rx - 1} ${top + depth - 2} A${rx + 1} ${ry} 0 0 0 ${cx + rx + 1} ${top + depth - 2}`}
            className="kr-hoop-line"
          />
          {Array.from({ length: lugs }, (_, i) => {
            const f = (i + 0.5) / lugs;
            const x = cx - rx + f * 2 * rx;
            const bow = Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * ry;
            const h = Math.min(16, depth * 0.34);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={top + bow + 3}
                  x2={x}
                  y2={top + depth + bow - 3}
                  className="kr-rod"
                />
                <rect
                  x={x - 3}
                  y={top + bow + 4}
                  width={6}
                  height={h}
                  rx={2.6}
                  fill={url("chrome")}
                  className="kr-lug"
                />
              </g>
            );
          })}
          {opts.strainer && (
            <rect
              x={cx + rx * 0.55}
              y={top + ry * 0.7}
              width={9}
              height={Math.max(10, depth * 0.55)}
              rx={1.5}
              fill={url("chrome")}
              className="kr-lug"
            />
          )}
          <g data-head>
            <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={url("head")} className="kr-head" />
            <ellipse data-glow cx={cx} cy={top} rx={rx} ry={ry} className="kr-glow is-head" />
          </g>
          <ellipse cx={cx} cy={top} rx={rx + 1.5} ry={ry + 1.2} className="kr-hoop" />
          <ellipse cx={cx} cy={top - 0.8} rx={rx - 0.5} ry={ry - 0.6} className="kr-hoop-hi" />
        </g>
      </Hit>
    );
  };

  /** Kick lying on its side, seen from the drummer's seat: shell running back, white batter head facing you. */
  const kick = () => {
    const cx = 410,
      cy = 398,
      rx = 84,
      ry = 64,
      back = 292;
    const shellD = `M${cx - rx} ${cy} L${cx - rx + 6} ${back} A${rx - 6} ${ry * 0.55} 0 0 1 ${cx + rx - 6} ${back} L${cx + rx} ${cy} Z`;
    return (
      <Hit piece="kick" k={k}>
        <g data-kp="kick" data-kind="kick" className="kr-anim">
          <path d={shellD} fill={url("shellV")} className="kr-shell" />
          {finishFill(shellD)}
          {[-0.72, -0.4, 0, 0.4, 0.72].map((f) => (
            <g key={f}>
              <line
                x1={cx + f * rx * 0.95}
                y1={back + 18 - Math.abs(f) * 8}
                x2={cx + f * rx}
                y2={cy - ry * Math.sqrt(1 - f * f) + 4}
                className="kr-rod"
              />
              <rect
                x={cx + f * rx * 0.97 - 3}
                y={back + 30 - Math.abs(f) * 6}
                width={6}
                height={14}
                rx={2.6}
                fill={url("chrome")}
                className="kr-lug"
              />
            </g>
          ))}
          <ellipse cx={cx} cy={cy} rx={rx + 4} ry={ry + 3.5} className="kr-kick-hoop" />
          <g data-head>
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx - 3}
              ry={ry - 2.5}
              fill={url("head")}
              className="kr-head"
            />
            <text x={cx} y={cy - ry * 0.55} textAnchor="middle" className="kr-head-logo">
              SYNCLAB · {label.toUpperCase().slice(0, 18)}
            </text>
            <ellipse cx={cx + 3} cy={cy + ry * 0.62} rx={7} ry={5} className="kr-beater" />
            <ellipse
              data-glow
              cx={cx}
              cy={cy}
              rx={rx - 3}
              ry={ry - 2.5}
              className="kr-glow is-head"
            />
          </g>
        </g>
      </Hit>
    );
  };

  const hats = () => {
    const cx = 138,
      cy = 290,
      rx = 74,
      ry = rx * 0.62;
    return (
      <Hit piece="hat" k={k}>
        <g data-kp="hat" data-kind="hat">
          <g className="kr-anim">
            <ellipse cx={cx} cy={cy + 9} rx={rx} ry={ry} className="kr-cym-edge" />
            <ellipse cx={cx} cy={cy + 6} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
          </g>
          <g data-hat-top className="kr-anim">
            <ellipse cx={cx} cy={cy + 2} rx={rx} ry={ry} className="kr-cym-edge" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={url("bronze")} className="kr-cym" />
            {[0.88, 0.74, 0.6, 0.46, 0.32].map((f) => (
              <ellipse key={f} cx={cx} cy={cy} rx={rx * f} ry={ry * f} className="kr-lathe" />
            ))}
            {[-0.4, 2.4].map((a) => (
              <path
                key={a}
                d={`M${cx} ${cy} L${cx + Math.cos(a - 0.12) * rx * 0.97} ${cy + Math.sin(a - 0.12) * ry * 0.97} A${rx} ${ry} 0 0 1 ${cx + Math.cos(a + 0.12) * rx * 0.97} ${cy + Math.sin(a + 0.12) * ry * 0.97} Z`}
                className="kr-spoke"
              />
            ))}
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx * 0.22}
              ry={ry * 0.22}
              fill={url("bell")}
              className="kr-cym"
            />
            <ellipse data-glow cx={cx} cy={cy} rx={rx} ry={ry} className="kr-glow" />
            <rect
              x={cx - 4}
              y={cy - 12}
              width={8}
              height={12}
              rx={2}
              fill={url("chrome")}
              className="kr-lug"
            />
            <line x1={cx} y1={cy - 12} x2={cx} y2={cy - 22} className="kr-stand-core" />
          </g>
        </g>
      </Hit>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="kr-svg"
      data-finish={finish}
      role="group"
      aria-label={`${label} drum set — tap a drum or cymbal to hear it`}
    >
      <defs>
        <radialGradient id={u("floor")} cx="50%" cy="42%" r="75%">
          <stop offset="0" style={{ stopColor: "var(--kr-floor-hi)" }} />
          <stop offset="0.65" style={{ stopColor: "var(--kr-floor)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-floor-lo)" }} />
        </radialGradient>
        <radialGradient id={u("bronze")} cx="42%" cy="30%" r="80%">
          <stop offset="0" style={{ stopColor: "var(--kr-bronze-hi)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--kr-bronze)" }} />
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
          <stop offset="0.14" style={{ stopColor: "var(--kr-shell-hi)" }} />
          <stop offset="0.3" style={{ stopColor: "var(--kr-shell)" }} />
          <stop offset="0.68" style={{ stopColor: "var(--kr-shell-lo)" }} />
          <stop offset="0.86" style={{ stopColor: "var(--kr-shell-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-shell-lo)" }} />
        </linearGradient>
        <linearGradient id={u("shellV")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--kr-shell-lo)" }} />
          <stop offset="0.22" style={{ stopColor: "var(--kr-shell)" }} />
          <stop offset="0.42" style={{ stopColor: "var(--kr-shell-hi)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--kr-shell)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-shell-lo)" }} />
        </linearGradient>
        <radialGradient id={u("head")} cx="46%" cy="40%" r="62%">
          <stop offset="0" style={{ stopColor: "var(--kr-head-hi)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--kr-head)" }} />
          <stop offset="1" style={{ stopColor: "var(--kr-head-lo)" }} />
        </radialGradient>
        <filter id={u("soft")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <pattern id={u("sparkle")} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2" r="0.7" className="kr-flake" />
          <circle cx="5" cy="5.5" r="0.5" className="kr-flake" />
        </pattern>
        <pattern id={u("grain")} width="40" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 2 Q10 0.5 20 2 T40 2" className="kr-grain" />
          <path d="M0 5 Q12 3.8 22 5 T40 5" className="kr-grain" />
        </pattern>
      </defs>

      {/* light studio floor with soft shadows cast down-left of each piece */}
      <rect x="0" y="0" width={VIEW.w} height={VIEW.h} rx="10" fill={url("floor")} />
      <g filter={url("soft")} className="kr-shadow" aria-hidden="true">
        <ellipse cx={398} cy={470} rx={110} ry={46} />
        <ellipse cx={600} cy={500} rx={86} ry={40} />
        <ellipse cx={232} cy={430} rx={70} ry={30} />
        <ellipse cx={140} cy={480} rx={70} ry={26} />
        <ellipse cx={600} cy={330} rx={70} ry={22} />
        <ellipse cx={210} cy={300} rx={60} ry={20} />
      </g>

      {/* back crash + stands that run down behind the drums */}
      <Stand
        pts={[
          [420, 104],
          [424, 290],
        ]}
        thick
      />
      {cymbal("crash2", 420, 100, 62, 4)}
      <Stand
        pts={[
          [612, 160],
          [634, 236],
          [628, 330],
        ]}
        thick
      />
      <Stand
        pts={[
          [227, 160],
          [240, 236],
          [244, 320],
        ]}
        thick
      />

      {kick()}
      {/* kick pedal: beater shaft, footboard and heel plate */}
      <g aria-hidden="true">
        <line x1={413} y1={444} x2={412} y2={470} className="kr-stand-core is-thick" />
        <path d="M402 466 L422 466 L425 504 L399 504 Z" className="kr-pedal" />
        <rect x="397" y="500" width="30" height="9" rx="2" className="kr-pedal" />
      </g>

      {/* tom holder on the kick, with the cowbell on it */}
      <g aria-hidden="true">
        <Stand
          pts={[
            [410, 300],
            [410, 262],
          ]}
          thick
        />
        <Stand
          pts={[
            [410, 266],
            [368, 254],
          ]}
        />
        <Stand
          pts={[
            [410, 266],
            [452, 252],
          ]}
        />
      </g>
      {drum("tomHi", 340, 232, 41, 30, 50)}
      {drum("tomMid", 495, 232, 52, 37, 58)}
      <Hit piece="cowbell" k={k}>
        <g data-kp="cowbell" data-kind="shake" className="kr-anim">
          <path
            d="M400 246 L420 246 L425 276 L395 276 Z"
            fill={url("chrome")}
            className="kr-cowbell"
          />
          <ellipse cx="410" cy="276" rx="15" ry="5" className="kr-cowbell-mouth" />
          <ellipse data-glow cx="410" cy="262" rx="16" ry="16" className="kr-glow" />
        </g>
      </Hit>

      {cymbal("ride", 612, 160, 96, 5)}

      {/* floor tom on its legs */}
      <Stand
        pts={[
          [556, 430],
          [522, 530],
        ]}
      />
      <Stand
        pts={[
          [640, 480],
          [632, 565],
        ]}
      />
      <Stand
        pts={[
          [686, 424],
          [702, 478],
        ]}
      />
      {drum("tomLo", 620, 368, 70, 48, 104)}

      {/* snare on its basket stand */}
      <g aria-hidden="true">
        <Stand
          pts={[
            [262, 400],
            [264, 438],
          ]}
          thick
        />
        <Stand
          pts={[
            [264, 438],
            [250, 496],
          ]}
        />
        <Stand
          pts={[
            [264, 438],
            [328, 442],
          ]}
        />
        <Stand
          pts={[
            [264, 438],
            [230, 428],
          ]}
        />
      </g>
      {drum("snare", 240, 330, 60, 44, 34, { strainer: true })}

      {cymbal("crash1", 227, 160, 74, -6)}

      {/* hi-hat stand, tripod and pedal */}
      <g aria-hidden="true">
        <Stand
          pts={[
            [140, 296],
            [176, 552],
          ]}
          thick
        />
        <Stand
          pts={[
            [172, 448],
            [134, 460],
          ]}
        />
        <Stand
          pts={[
            [172, 448],
            [240, 434],
          ]}
        />
        <path d="M190 470 L214 466 L236 506 L214 512 Z" className="kr-pedal" />
      </g>
      <Hit piece="tamb" k={k}>
        <g data-kp="tamb" data-kind="shake" className="kr-anim">
          <ellipse cx="160" cy="398" rx="18" ry="13" className="kr-tamb" />
          <ellipse cx="160" cy="397" rx="13" ry="9" fill={url("head")} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <ellipse
                key={i}
                cx={160 + Math.cos(a) * 16.5}
                cy={398 + Math.sin(a) * 12}
                rx="2.8"
                ry="2.2"
                fill={url("chrome")}
                className="kr-lug"
              />
            );
          })}
          <ellipse data-glow cx="160" cy="398" rx="18" ry="13" className="kr-glow" />
        </g>
      </Hit>
      {hats()}
    </svg>
  );
}

/** Chrome tubing: a dark outer stroke with a bright core so it reads on the light floor. */
function Stand({ pts, thick }: { pts: [number, number][]; thick?: boolean }) {
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <g aria-hidden="true">
      <path d={d} className={`kr-stand${thick ? " is-thick" : ""}`} />
      <path d={d} className="kr-stand-core" />
    </g>
  );
}

/** One playable piece: tap or Enter plays it. A module-level component so re-renders never remount the artwork mid-animation. */
function Hit({
  piece,
  k,
  children,
}: {
  piece: AcousticPiece;
  k: { info: (p: AcousticPiece) => PieceInfo; onTap: Tap };
  children: ReactNode;
}) {
  const i = k.info(piece);
  return (
    <g
      data-kp-wrap={piece}
      className={`kr-piece${i.off ? " is-off" : ""}${i.can ? "" : " is-empty"}`}
      role="button"
      tabIndex={i.can ? 0 : -1}
      aria-label={`${i.label}${i.off ? " (muted for the drummer)" : ""}`}
      aria-disabled={!i.can}
      onPointerDown={(e) => {
        if (!i.can) return;
        e.preventDefault();
        k.onTap(piece);
      }}
      onKeyDown={(e) => {
        if (i.can && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          k.onTap(piece);
        }
      }}
    >
      <title>{i.label}</title>
      {children}
    </g>
  );
}
