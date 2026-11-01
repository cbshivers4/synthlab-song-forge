import { useMemo } from "react";
import { WaveformView } from "./WaveformView";
import { peaksOf } from "@/lib/synclab/stems";

/** Peak level, clipped-sample count and a short real-sample window from the loudest note. */
export function analyseBuffer(buffer: AudioBuffer, windowSeconds = 0.12) {
  let peak = 0;
  let peakAt = 0;
  let clipped = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]!);
      if (a >= 0.999) clipped++;
      if (a > peak) { peak = a; peakAt = i; }
    }
  }
  // Close-up: a short stretch just after the loudest attack, where a bass note is sustaining.
  const d = buffer.getChannelData(0);
  const len = Math.max(32, Math.round(buffer.sampleRate * windowSeconds));
  const start = Math.max(0, Math.min(d.length - len, peakAt + Math.round(buffer.sampleRate * 0.03)));
  const points = 400;
  const shape: number[] = [];
  for (let k = 0; k < points; k++) shape.push(d[start + Math.floor((k / points) * len)] ?? 0);
  const dbfs = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  return { peak, dbfs, clipped, shape };
}

/** Fixed-height waveform drawn only from decoded/rendered PCM. */
export function GeneratedWaveform({ buffer, data, peaks, label = "Generated audio waveform", trueLevel = false, closeUp = false, color }: {
  buffer?: AudioBuffer;
  data?: Float32Array;
  peaks?: number[];
  label?: string;
  /** Draw against full scale instead of lifting quiet audio to fill the screen. */
  trueLevel?: boolean;
  /** Also show a close-up of the real wave shape, its peak level and whether anything clipped. */
  closeUp?: boolean;
  color?: string;
}) {
  const values = useMemo(() => {
    if (peaks) return peaks;
    if (data) return peaksOf(data, 512);
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => peaksOf(buffer.getChannelData(i), 512));
    return channels[0]?.map((_, i) => Math.max(...channels.map((c) => c[i] ?? 0))) ?? [];
  }, [buffer, data, peaks]);
  const info = useMemo(() => (closeUp && buffer ? analyseBuffer(buffer) : null), [buffer, closeUp]);
  const shapePath = info ? info.shape.map((v, i) => `${i ? "L" : "M"} ${((i / (info.shape.length - 1)) * 300).toFixed(1)} ${(50 - v * 46).toFixed(2)}`).join(" ") : "";
  return <figure className="m-0 min-w-0 w-full space-y-1" aria-label={label}>
    <figcaption className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs text-muted-foreground">
      <span>{label}</span>
      {info && <span className={info.clipped ? "text-destructive" : "text-primary"}>
        Peak {Number.isFinite(info.dbfs) ? `${info.dbfs.toFixed(1)} dB` : "silent"} · {info.clipped ? `${info.clipped} clipped samples` : "no clipping"}
      </span>}
    </figcaption>
    <div className="flex h-28 w-full gap-2">
      <div className="signal-screen h-full min-w-0 flex-1 overflow-hidden rounded-md border border-border">
        <WaveformView peaks={values} label={label} autoLift={!trueLevel} {...(color ? { color } : {})} />
      </div>
      {info && (
        <div className="signal-screen relative h-full w-56 shrink-0 overflow-hidden rounded-md border border-border" aria-label="Close-up of the real wave shape">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Wave shape close-up">
            {[4, 50, 96].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke={color ?? "var(--display-wave)"} strokeOpacity={y === 50 ? 0.25 : 0.12} strokeWidth="0.6" strokeDasharray={y === 50 ? undefined : "3 3"} />)}
            <path d={shapePath} fill="none" stroke={color ?? "var(--display-wave)"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <span className="absolute left-1.5 top-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Wave shape · 120 ms</span>
        </div>
      )}
    </div>
  </figure>;
}
