import { useCallback, useEffect, useRef, useState } from "react";
import { getEngine } from "./audio-engine";
import { renderGeneratedPattern, type GeneratedPattern } from "./generated-pattern";
import { foldLoopTail } from "./loop-buffer";
import { activeSongClock } from "./song-clock";
import { loopPreviewOffset } from "./loop-preview-phase";

/** Short fade between an old and a new pattern so a swap never clicks. */
const SWAP_FADE = 0.015;

/**
 * Plays a generated pattern on its own, looped — the song on the timeline is not started,
 * and nothing is added to the project. Used by the phone Bass Generator preview.
 * A new pattern (Generate again, another sound) takes over in time: on the song's grid when
 * the song is playing, otherwise at the same point of the loop, so the groove never jumps.
 */
export function useLoopPreview() {
  const sourceRef = useRef<{
    src: AudioBufferSourceNode;
    gain: GainNode;
    startedAt: number;
    loopSec: number;
  } | null>(null);
  const token = useRef(0);
  const [playing, setPlaying] = useState(false);

  const release = (at?: number) => {
    const cur = sourceRef.current;
    sourceRef.current = null;
    if (!cur) return;
    const ctx = getEngine().ctx;
    const when = Math.max(at ?? 0, ctx?.currentTime ?? 0);
    try {
      cur.gain.gain.setValueAtTime(1, when);
      cur.gain.gain.linearRampToValueAtTime(0, when + SWAP_FADE);
      cur.src.stop(when + SWAP_FADE + 0.01);
    } catch {
      /* already stopped */
    }
    cur.src.onended = () => {
      try {
        cur.src.disconnect();
        cur.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    };
  };

  const stop = useCallback(() => {
    token.current++;
    release();
    setPlaying(false);
  }, []);

  /** Start (or switch to new notes/sound). Call from the tap itself so phone audio unlocks. */
  const play = useCallback(async (pattern: GeneratedPattern, bpm: number) => {
    const engine = getEngine();
    const ctx = engine.init();
    const mine = ++token.current;
    setPlaying(true);
    try {
      const rendered = await renderGeneratedPattern(pattern, bpm);
      if (mine !== token.current) return;
      const stepSec = 60 / Math.max(1, bpm) / 4;
      const loopSec = pattern.steps * stepSec;
      const frames = Math.round(loopSec * rendered.sampleRate);
      const channels = Array.from({ length: rendered.numberOfChannels }, (_, c) =>
        rendered.getChannelData(c),
      );
      const folded = foldLoopTail(channels, frames);
      const buffer = ctx.createBuffer(folded.length, frames, rendered.sampleRate);
      folded.forEach((data, c) => buffer.copyToChannel(data as Float32Array<ArrayBuffer>, c));
      const when = ctx.currentTime + 0.03;
      const prev = sourceRef.current;
      const offset = loopPreviewOffset({
        when,
        loopSec,
        loopSteps: pattern.steps,
        song: activeSongClock(ctx.currentTime),
        previous: prev ? { startedAt: prev.startedAt, loopSec: prev.loopSec } : null,
      });
      release(when);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(prev ? 0 : 1, when);
      if (prev) gain.gain.linearRampToValueAtTime(1, when + SWAP_FADE);
      src.connect(gain);
      gain.connect(engine.master ?? ctx.destination);
      src.start(when, offset);
      sourceRef.current = { src, gain, startedAt: when - offset, loopSec };
    } catch {
      if (mine === token.current) setPlaying(false);
      throw new Error("Preview unavailable");
    }
  }, []);

  useEffect(
    () => () => {
      token.current++;
      release();
    },
    [],
  );

  /** Where the looping preview is right now, 0–1 through the loop (null when silent). For step lights. */
  const phase = useCallback((): number | null => {
    const cur = sourceRef.current;
    const now = getEngine().ctx?.currentTime;
    if (!cur || now == null || !(cur.loopSec > 0) || now < cur.startedAt) return null;
    return ((now - cur.startedAt) % cur.loopSec) / cur.loopSec;
  }, []);

  return { playing, play, stop, phase };
}
