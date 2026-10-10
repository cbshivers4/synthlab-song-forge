import { useEffect, useState } from "react";
import { renderGeneratedPattern, type GeneratedPattern } from "@/lib/synclab/generated-pattern";
import { GeneratedWaveform } from "./GeneratedWaveform";

export function PatternWaveform({ pattern, bpm, label }: { pattern: GeneratedPattern; bpm: number; label: string }) {
  const { notes, hits, instrument, steps } = pattern;
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setBuffer(null);
    setError(false);
    void renderGeneratedPattern({ notes, hits, instrument, steps }, bpm).then((value) => { if (current) setBuffer(value); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [notes, hits, instrument, steps, bpm]);
  if (buffer) return <GeneratedWaveform buffer={buffer} label={label} />;
  return <div role="status" className="flex h-28 w-full items-center justify-center border border-border text-xs text-muted-foreground">{error ? "Waveform unavailable in this browser" : "Rendering waveform…"}</div>;
}