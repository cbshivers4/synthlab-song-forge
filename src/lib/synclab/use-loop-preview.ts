import { useCallback, useEffect, useRef, useState } from "react";
import { getEngine } from "./audio-engine";
import { renderGeneratedPattern, type GeneratedPattern } from "./generated-pattern";
import { foldLoopTail } from "./loop-buffer";

/**
 * Plays a generated pattern on its own, looped — the song on the timeline is not started,
 * and nothing is added to the project. Used by the phone Bass Generator preview.
 */
export function useLoopPreview() {
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const token = useRef(0);
  const [playing, setPlaying] = useState(false);

  const release = () => {
    const src = sourceRef.current;
    sourceRef.current = null;
    if (!src) return;
    try { src.stop(); } catch { /* already stopped */ }
    try { src.disconnect(); } catch { /* already disconnected */ }
  };

  const stop = useCallback(() => {
    token.current++;
    release();
    setPlaying(false);
  }, []);

  /** Start (or restart with new notes/sound). Call from the tap itself so phone audio unlocks. */
  const play = useCallback(async (pattern: GeneratedPattern, bpm: number) => {
    const engine = getEngine();
    const ctx = engine.init();
    const mine = ++token.current;
    setPlaying(true);
    try {
      const rendered = await renderGeneratedPattern(pattern, bpm);
      if (mine !== token.current) return;
      const loopSec = pattern.steps * (60 / Math.max(1, bpm) / 4);
      const frames = Math.round(loopSec * rendered.sampleRate);
      const channels = Array.from({ length: rendered.numberOfChannels }, (_, c) => rendered.getChannelData(c));
      const folded = foldLoopTail(channels, frames);
      const buffer = ctx.createBuffer(folded.length, frames, rendered.sampleRate);
      folded.forEach((data, c) => buffer.copyToChannel(data as Float32Array<ArrayBuffer>, c));
      release();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(engine.master ?? ctx.destination);
      src.start();
      sourceRef.current = src;
    } catch {
      if (mine === token.current) setPlaying(false);
      throw new Error("Preview unavailable");
    }
  }, []);

  useEffect(() => () => { token.current++; release(); }, []);

  return { playing, play, stop };
}
