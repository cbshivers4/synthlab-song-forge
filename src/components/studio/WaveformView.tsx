import { memo, useId, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Pro-DAW style waveform: mirrored filled body with a gradient, a brighter RMS
 * core, crisp peak outlines and a centre line. Purely presentational — callers
 * keep their own overlays (trim, chops, playhead) on top.
 */
export const WaveformView = memo(function WaveformView({
  peaks,
  color = "var(--display-wave)",
  className,
  label,
  grid = true,
  gain = 1,
  outline = true,
  autoLift = true,
}: {
  /** Lift quiet audio to fill the lane; off draws the true level against full scale. */
  autoLift?: boolean;
  /** Draw the crisp peak outlines; off gives a solid filled shape only. */
  outline?: boolean;
  peaks: number[];
  /** Any CSS colour; the gradient and outlines are derived from it. */
  color?: string;
  className?: string;
  label?: string;
  /** Faint horizontal dB guides behind the wave. */
  grid?: boolean;
  /** Visual scaling of the peak heights. */
  gain?: number;
}) {
  const uid = useId().replace(/[:]/g, "");
  const data = peaks.length > 1 ? peaks : [0, 0];

  const { body, core, top, bottom } = useMemo(() => {
    const n = data.length;
    // A quiet take still has to be readable: lift the drawing so its loudest
    // point fills the lane. This is display only — nothing about the audio,
    // the clip gain or the export changes.
    const loudest = Math.max(0.0001, ...data);
    const view = gain * (autoLift && loudest < 0.85 ? Math.min(8, 0.85 / loudest) : 1);
    const x = (i: number) => ((i / (n - 1)) * 1000).toFixed(2);
    const h = (p: number, k = 1) => Math.max(0.9, Math.min(1, p * view) * 48 * k);
    const topPts = data.map((p, i) => `${x(i)},${(50 - h(p)).toFixed(2)}`);
    const botPts = data.map((p, i) => `${x(i)},${(50 + h(p)).toFixed(2)}`);
    const coreTop = data.map((p, i) => `${x(i)},${(50 - h(p, 0.55)).toFixed(2)}`);
    const coreBot = data.map((p, i) => `${x(i)},${(50 + h(p, 0.55)).toFixed(2)}`);
    return {
      body: `M ${topPts.join(" L ")} L ${botPts.slice().reverse().join(" L ")} Z`,
      core: `M ${coreTop.join(" L ")} L ${coreBot.slice().reverse().join(" L ")} Z`,
      top: `M ${topPts.join(" L ")}`,
      bottom: `M ${botPts.join(" L ")}`,
    };
  }, [data, gain, autoLift]);

  return (
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className={cn("waveform-view h-full w-full", className)}
      aria-label={label ?? "Audio waveform"}
      role="img"
    >
      <defs>
        <linearGradient id={`wv-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="48%" stopColor={color} stopOpacity="0.45" />
          <stop offset="52%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {grid &&
        [14, 28, 72, 86].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="1000"
            y2={y}
            stroke={color}
            strokeOpacity="0.08"
            strokeWidth="0.5"
          />
        ))}

      <path d={body} fill={`url(#wv-${uid})`} />
      <path d={core} fill={color} fillOpacity="0.55" />
      {outline && (
        <>
          <path
            d={top}
            fill="none"
            stroke={color}
            strokeOpacity="0.95"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <path
            d={bottom}
            fill="none"
            stroke={color}
            strokeOpacity="0.55"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </>
      )}
      <line
        x1="0"
        y1="50"
        x2="1000"
        y2="50"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
    </svg>
  );
});
