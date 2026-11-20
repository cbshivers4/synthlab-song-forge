import { describe, expect, it, vi } from "vitest";
import { nextPlayStep } from "./recording-region";
import { OFFLINE_LIVE, scheduleStep } from "./schedule-step";
import type { Track, Transport } from "./types";

// 4 bars of 4/4 = 64 steps; loop marked over bar 1 (steps 0-16).
const tp = {
  bpm: 120,
  bars: 4,
  step: 0,
  playing: true,
  loop: true,
  loopStart: 0,
  loopEnd: 16,
  swing: 0,
  metronome: false,
} as unknown as Transport;
const base = {
  color: "grey",
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  frozen: false,
  hidden: false,
  input: "none",
  bus: "master",
} as const;
// A 1-second clip at step 4 (120 BPM: one step = 0.125 s, so it ends at step 12, inside the loop).
const audio: Track = {
  ...base,
  id: "a",
  name: "A",
  kind: "audio",
  steps: 16,
  clips: [
    {
      id: "c",
      name: "c",
      start: 4,
      offset: 0,
      duration: 1,
      length: 1,
      peaks: [],
      url: "blob:clip",
    },
  ],
};
const fakeEngine = () => ({
  tempo: 0,
  playNote: vi.fn(),
  playDrum: vi.fn(),
  playClip: vi.fn(),
  playSample: vi.fn(),
  playClick: vi.fn(),
  setPitchBend: vi.fn(),
  setModWheel: vi.fn(),
});
const playLengths = (t: Transport) => {
  const engine = fakeEngine();
  for (let n = 0; n < 16; n++)
    scheduleStep(engine as never, [audio], t, n, n * 0.125, {
      ...OFFLINE_LIVE,
      lastScheduled: n === 0 ? null : n - 1,
    });
  return engine.playClip.mock.calls.map((c) => (c[1] as { length: number }).length);
};

describe("loop button during playback", () => {
  it("the playhead wraps at the loop end only while loop is on", () => {
    expect(nextPlayStep(15, tp)).toBe(0);
    const off = { ...tp, loop: false };
    expect(nextPlayStep(15, off)).toBe(16);
    expect(nextPlayStep(63, off)).toBe(0);
  });
  it("turning loop back on mid-song returns the playhead to the loop start at the loop end", () => {
    expect(nextPlayStep(40, tp)).toBe(0);
  });
  it("a clip plays its full length with loop on, off, and on again", () => {
    expect(playLengths(tp)).toEqual([1]);
    expect(playLengths({ ...tp, loop: false })).toEqual([1]);
    expect(playLengths({ ...tp, loop: true })).toEqual([1]);
  });
});
