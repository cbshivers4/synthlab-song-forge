import { useId } from "react";

/** Classic VU meter face (black bezel, lit white dial, red +0…+3 band, black pivot dome).
 *  The scale is linear in voltage like a real VU, so 0 VU sits at ~71% of the swing. */
export const VU_PIVOT = { x: 150, y: 178 } as const;
const SWING = 50; // degrees either side of vertical
const MAX_AMP = 10 ** (3 / 20);

/** Needle angle for a VU reading in dB (0 VU = reference level). */
export function vuAngle(vuDb: number) {
  const amp = vuDb <= -60 ? 0 : 10 ** (vuDb / 20);
  const frac = Math.max(0, Math.min(1.04, amp / MAX_AMP));
  return -SWING + frac * SWING * 2;
}
export const vuTransform = (vuDb: number) => `rotate(${vuAngle(vuDb)} ${VU_PIVOT.x} ${VU_PIVOT.y})`;

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [VU_PIVOT.x + r * Math.sin(a), VU_PIVOT.y - r * Math.cos(a)] as const;
};
const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
};
const DB_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const MINOR = [-15, -8, -6, -4, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
const PCT = [0, 20, 40, 60, 80, 100];

export function VuFace({
  vuDb,
  label = "VU",
  sub,
  needleProps,
  className,
  ariaLabel,
}: {
  vuDb: number;
  label?: string;
  sub?: string;
  className?: string;
  ariaLabel?: string;
  needleProps?: Record<string, string | boolean>;
}) {
  const id = useId().replace(/:/g, "");
  const zero = vuAngle(0),
    end = vuAngle(3);
  return (
    <svg
      viewBox="0 0 300 180"
      className={`vuf ${className ?? ""}`}
      role="img"
      aria-label={ariaLabel ?? "VU meter"}
    >
      <defs>
        <linearGradient id={`vuf-bezel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="vuf-bezel-hi" />
          <stop offset="0.12" className="vuf-bezel-mid" />
          <stop offset="1" className="vuf-bezel-lo" />
        </linearGradient>
        <radialGradient id={`vuf-glow-${id}`} cx="50%" cy="92%" r="70%">
          <stop offset="0" className="vuf-glow-in" />
          <stop offset="0.45" className="vuf-glow-mid" />
          <stop offset="1" className="vuf-glow-out" />
        </radialGradient>
        <linearGradient id={`vuf-shade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="vuf-shade-top" />
          <stop offset="0.25" className="vuf-shade-clear" />
        </linearGradient>
        <radialGradient id={`vuf-dome-${id}`} cx="45%" cy="35%" r="70%">
          <stop offset="0" className="vuf-dome-hi" />
          <stop offset="1" className="vuf-dome-lo" />
        </radialGradient>
        <clipPath id={`vuf-clip-${id}`}>
          <rect x="12" y="12" width="276" height="156" />
        </clipPath>
      </defs>
      <rect width="300" height="180" fill={`url(#vuf-bezel-${id})`} className="vuf-bezel" />
      <g clipPath={`url(#vuf-clip-${id})`}>
        <rect x="12" y="12" width="276" height="156" fill={`url(#vuf-glow-${id})`} />
        {/* red overload band */}
        <path d={arc(zero, end, 126)} className="vuf-red-band" />
        <path d={arc(-SWING, zero, 130)} className="vuf-arc" />
        <path d={arc(-SWING, zero, 118)} className="vuf-arc thin" />
        {DB_MARKS.map((d) => {
          const a = vuAngle(d);
          const [x1, y1] = pt(a, 130);
          const [x2, y2] = pt(a, d === 0 || d === -20 ? 116 : 140);
          const [tx, ty] = pt(a, 152);
          const hot = d > 0;
          return (
            <g key={d}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={hot ? "vuf-tick hot" : "vuf-tick"} />
              <text
                x={tx}
                y={ty}
                transform={`rotate(${a} ${tx} ${ty})`}
                className={hot ? "vuf-num hot" : "vuf-num"}
              >
                {Math.abs(d)}
              </text>
            </g>
          );
        })}
        {MINOR.map((d) => {
          const a = vuAngle(d);
          const [x1, y1] = pt(a, 130);
          const [x2, y2] = pt(a, 136);
          return (
            <line
              key={d}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={d > 0 ? "vuf-tick hot minor" : "vuf-tick minor"}
            />
          );
        })}
        {PCT.map((p) => {
          const a = -SWING + (p / 100 / MAX_AMP) * SWING * 2;
          const [x1, y1] = pt(a, 118);
          const [x2, y2] = pt(a, 110);
          const [tx, ty] = pt(a, 100);
          return (
            <g key={p}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="vuf-tick minor" />
              {p > 0 && (
                <text x={tx} y={ty} transform={`rotate(${a} ${tx} ${ty})`} className="vuf-pct">
                  {p}
                  {p === 100 ? " %" : ""}
                </text>
              )}
            </g>
          );
        })}
        {(() => {
          const [x, y] = pt(-SWING - 4, 146);
          const [rx, ry] = pt(SWING + 6, 146);
          return (
            <>
              <text x={x} y={y} className="vuf-sign">
                −
              </text>
              <text x={rx} y={ry} className="vuf-sign hot">
                +
              </text>
            </>
          );
        })()}
        <text x="150" y="128" className="vuf-label">
          {label}
        </text>
        {sub && (
          <text x="150" y="146" className="vuf-sub">
            {sub}
          </text>
        )}
        <g transform={vuTransform(vuDb)} className="vuf-needle-group" {...needleProps}>
          <line
            x1={VU_PIVOT.x + 2}
            y1={VU_PIVOT.y + 2}
            x2={VU_PIVOT.x + 2}
            y2={VU_PIVOT.y - 132}
            className="vuf-needle-shadow"
          />
          <line
            x1={VU_PIVOT.x}
            y1={VU_PIVOT.y}
            x2={VU_PIVOT.x}
            y2={VU_PIVOT.y - 134}
            className="vuf-needle"
          />
        </g>
        <circle
          cx={VU_PIVOT.x}
          cy={VU_PIVOT.y + 6}
          r="26"
          fill={`url(#vuf-dome-${id})`}
          className="vuf-dome"
        />
        <rect
          x="12"
          y="12"
          width="276"
          height="156"
          fill={`url(#vuf-shade-${id})`}
          pointerEvents="none"
        />
      </g>
      <rect x="12" y="12" width="276" height="156" className="vuf-inner-edge" />
    </svg>
  );
}
