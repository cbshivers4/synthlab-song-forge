import { describe, expect, it, vi } from "vitest";
import { OFFLINE_LIVE, scheduleStep } from "./schedule-step";
import { cutTrackMaterial, deleteSelectedPart, removeTakeAndMaterial } from "./workflow";
import { defaultPatch } from "./presets";
import type { Track, Transport } from "./types";

// 120 BPM: one step = 0.125 s. 8 bars = 128 steps.
const tp = {
  bpm: 120,
  bars: 8,
  step: 0,
  playing: true,
  loop: true,
  loopStart: 0,
  loopEnd: 128,
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
const note = (id: string, step: number, recordedEnd?: number) => ({
  id,
  step,
  length: 1,
  pitch: 60,
  velocity: 1,
  ...(recordedEnd != null ? { recordedEnd } : {}),
});
const synth = (values: Partial<Track>): Track =>
  ({
    ...base,
    id: "s",
    name: "ACID BASS",
    kind: "instrument",
    steps: 32,
    patch: defaultPatch(),
    ...values,
  }) as Track;
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

describe("deleting a recorded synth block", () => {
  // an 8-bar take: 128 steps × 0.125 s = 16 s, starting at step 0
  const take = {
    id: "take",
    name: "ACID BASS TAKE 1",
    start: 0,
    offset: 0,
    duration: 16,
    length: 16,
    peaks: [],
    url: "blob:take",
  };
  it("removes the notes underneath the block, so no MIDI is left behind", () => {
    const t = synth({
      printedAudio: true,
      activeClipId: "take",
      clips: [take],
      notes: [note("a", 4, 128), note("b", 100, 128)],
    });
    const patch = removeTakeAndMaterial(t, "take", 120, 8);
    expect(patch.clips).toEqual([]);
    expect(patch.notes).toEqual([]);
    expect(patch.printedAudio).toBe(false);
  });
  it("keeps notes outside the deleted block", () => {
    const short = { ...take, length: 2, duration: 2 }; // steps 0–16
    const t = synth({
      printedAudio: true,
      activeClipId: "take",
      clips: [short],
      notes: [note("in", 4, 16), note("out", 40, 64)],
    });
    expect(removeTakeAndMaterial(t, "take", 120, 8).notes?.map((n) => n.id)).toEqual(["out"]);
  });
  it("an audio track only loses the clip", () => {
    const t = {
      ...base,
      id: "v",
      name: "VOX",
      kind: "audio",
      steps: 16,
      clips: [take],
      activeClipId: "take",
    } as Track;
    expect(removeTakeAndMaterial(t, "take", 120, 8)).toEqual({
      clips: [],
      activeClipId: undefined,
    });
  });
});

describe("recorded synth notes", () => {
  it("play once at their own position, not again every pattern length", () => {
    const engine = fakeEngine();
    const t = synth({ steps: 32, notes: [note("a", 4, 128)] });
    for (let n = 0; n < 128; n++)
      scheduleStep(engine as never, [t], tp, n, n * 0.125, {
        ...OFFLINE_LIVE,
        lastScheduled: n ? n - 1 : null,
      });
    expect(engine.playNote).toHaveBeenCalledTimes(1);
  });
  it("drawn pattern notes still repeat every pattern length", () => {
    const engine = fakeEngine();
    const t = synth({ steps: 32, notes: [note("p", 4)] });
    for (let n = 0; n < 128; n++)
      scheduleStep(engine as never, [t], tp, n, n * 0.125, {
        ...OFFLINE_LIVE,
        lastScheduled: n ? n - 1 : null,
      });
    expect(engine.playNote).toHaveBeenCalledTimes(4);
  });
});

describe("cutting on a synth channel", () => {
  it("cutting the MIDI block keeps the channel and its sound, emptying only the notes", () => {
    const t = synth({ notes: [note("a", 4, 128), note("b", 100, 128)] });
    const { clipboard, patch } = cutTrackMaterial(t, 120, 8);
    expect(patch.notes).toEqual([]);
    expect(patch.patch).toBeUndefined();
    expect("id" in patch).toBe(false);
    expect(clipboard.notes?.map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("cutting a selected part only removes that part", () => {
    const t = synth({
      cuts: [64],
      activeRegion: 0,
      notes: [note("in", 4, 128), note("out", 100, 128)],
    });
    const { clipboard, patch } = cutTrackMaterial(t, 120, 8);
    expect(clipboard.notes?.map((n) => n.id)).toEqual(["in"]);
    expect(patch.notes?.map((n) => n.id)).toEqual(["out"]);
  });
});

describe("recorded note length matches what you heard", () => {
  it("a tapped key (0.35 s) records about 3 steps at 120 BPM, not a gated single step", async () => {
    const { heardNoteSteps } = await import("./recording-region");
    expect(heardNoteSteps(0.35, 0.125)).toBe(2.75);
  });
  it("a MIDI key held longer than it sounded records the held length", async () => {
    const { heardNoteSteps } = await import("./recording-region");
    expect(heardNoteSteps(0.6, 0.125, 12)).toBe(12);
  });
  it("a quick MIDI tap still records the 0.6 s you heard", async () => {
    const { heardNoteSteps } = await import("./recording-region");
    expect(heardNoteSteps(0.6, 0.125, 0.25)).toBe(4.75);
  });
});

describe("cutting or deleting a whole block leaves nothing behind", () => {
  const tpLoop: [number, number] = [0, 16];
  it("a recorded-notes block that runs past the loop is removed whole, not just the looped bars", () => {
    const t = synth({ activeRegion: 4, notes: [note("a", 4, 32), note("b", 20, 32)] });
    expect(deleteSelectedPart(t, 120, 8, tpLoop)?.notes).toEqual([]);
    const { patch, clipboard } = cutTrackMaterial(t, 120, 8, tpLoop);
    expect(patch.notes).toEqual([]);
    expect(clipboard.notes?.map((n) => n.step)).toEqual([4, 20]);
  });
  it("a note that rings past the end of a take is removed with the take", () => {
    const take = {
      id: "take",
      name: "T",
      start: 0,
      offset: 0,
      duration: 2,
      length: 2,
      peaks: [],
      url: "blob:t",
    }; // steps 0–16
    const t = synth({
      printedAudio: true,
      activeClipId: "take",
      clips: [take],
      notes: [{ ...note("ring", 14, 32), length: 4 }],
    });
    expect(removeTakeAndMaterial(t, "take", 120, 8).notes).toEqual([]);
  });
  it("a drum take that starts a hair after the beat still removes the first hit", () => {
    const take = {
      id: "take",
      name: "T",
      start: 0.03,
      offset: 0,
      duration: 1.99,
      length: 1.99,
      peaks: [],
      url: "blob:t",
    };
    const steps = Array.from({ length: 32 }, (_, i) => (i === 0 || i === 8 || i === 20 ? 1 : 0));
    const t = {
      ...base,
      id: "d",
      name: "DRUMS",
      kind: "drum",
      steps: 32,
      printedAudio: true,
      activeClipId: "take",
      clips: [take],
      pads: [{ id: "k", name: "KICK", steps }],
    } as unknown as Track;
    const left = removeTakeAndMaterial(t, "take", 120, 2).pads?.[0]?.steps ?? [];
    expect(left.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([20]);
  });
});
