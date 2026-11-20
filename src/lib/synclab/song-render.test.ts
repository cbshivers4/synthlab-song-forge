import { describe, expect, it, vi } from "vitest";
import { OFFLINE_LIVE, scheduleStep } from "./schedule-step";
import { songAudioUrls, tracksAtStep } from "./song-render";
import { defaultPatch } from "./presets";
import type { Track, Transport } from "./types";

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
const synth: Track = {
  ...base,
  id: "s",
  name: "Synth",
  kind: "instrument",
  steps: 16,
  patch: defaultPatch(),
  notes: [{ id: "n1", step: 4, length: 2, pitch: 48, velocity: 0.9 }],
};
const tp = {
  bpm: 120,
  bars: 4,
  step: 0,
  playing: true,
  loop: false,
  swing: 0,
  metronome: false,
} as unknown as Transport;

function fakeEngine() {
  return {
    tempo: 0,
    playNote: vi.fn(),
    playDrum: vi.fn(),
    playClip: vi.fn(),
    playSample: vi.fn(),
    playClick: vi.fn(),
    setPitchBend: vi.fn(),
    setModWheel: vi.fn(),
  };
}

describe("offline song render", () => {
  it("schedules a note at its step time, the same call live playback makes", () => {
    const engine = fakeEngine();
    for (let n = 0; n < 16; n++)
      scheduleStep(engine as never, [synth], tp, n, n * 0.125, OFFLINE_LIVE);
    expect(engine.playNote).toHaveBeenCalledTimes(1);
    const [id, , pitch, dur, vel, when] = engine.playNote.mock.calls[0]!;
    expect([id, pitch, vel, when]).toEqual(["s", 48, 0.9, 0.5]);
    expect(dur).toBeCloseTo(0.25);
  });
  it("a channel muted by a recorded mute press plays nothing from that step on", () => {
    const muted: Track = {
      ...synth,
      muteEvents: [
        { step: 0, on: false },
        { step: 2, on: true },
      ],
    };
    const engine = fakeEngine();
    for (let n = 0; n < 16; n++)
      scheduleStep(engine as never, tracksAtStep([muted], n), tp, n, n * 0.125, OFFLINE_LIVE);
    expect(engine.playNote).not.toHaveBeenCalled();
    expect(tracksAtStep([muted], 1)[0]!.muted).toBe(false);
  });
  it("collects every clip, sampler and pad sample the song needs decoded", () => {
    const audio: Track = {
      ...base,
      id: "a",
      name: "A",
      kind: "audio",
      steps: 16,
      clips: [{ id: "c", name: "c", duration: 1, peaks: [], url: "blob:clip" }],
    };
    expect(songAudioUrls([synth, audio])).toEqual(["blob:clip"]);
  });
});
