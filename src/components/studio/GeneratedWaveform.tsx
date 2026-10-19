import { useMemo } from "react";
import { WaveformView } from "./WaveformView";
import { peaksOf } from "@/lib/synclab/stems";

/** Fixed-height waveform drawn only from decoded/rendered PCM. */
export function GeneratedWaveform({ buffer, data, peaks, label = "Generated audio waveform" }: {
  buffer?: AudioBuffer;
  data?: Float32Array;
  peaks?: number[];
  label?: string;
}) {
  const values = useMemo(() => {
    if (peaks) return peaks;
    if (data) return peaksOf(data, 512);
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => peaksOf(buffer.getChannelData(i), 512));
    return channels[0]?.map((_, i) => Math.max(...channels.map((c) => c[i] ?? 0))) ?? [];
  }, [buffer, data, peaks]);
  return <figure className="m-0 min-w-0 w-full space-y-1" aria-label={label}>
    <figcaption className="font-mono text-xs text-muted-foreground">{label}</figcaption>
    <div className="signal-screen h-28 w-full overflow-hidden rounded-md border border-border">
      <WaveformView peaks={values} label={label} />
    </div>
  </figure>;
}