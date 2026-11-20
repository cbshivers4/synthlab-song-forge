import { describe, expect, it } from "vitest";
import { collectSongNotes, writeMidiFile } from "./midi-export";
import { parseMidiFile } from "./midi-file";
import { ownedMediaPlan } from "./cloud-media";
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
  name: "Lead",
  kind: "instrument",
  steps: 16,
  patch: defaultPatch(),
  notes: [{ id: "n1", step: 4, length: 2, pitch: 60, velocity: 1 }],
};
const tp = {
  bpm: 120,
  bars: 2,
  step: 0,
  playing: false,
  loop: false,
  swing: 0,
  metronome: false,
  beatsPerBar: 4,
} as unknown as Transport;

describe("MIDI export", () => {
  it("writes the notes that actually play, repeating the 1-bar pattern over 2 bars", () => {
    const notes = collectSongNotes([synth], tp, 0, 32);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.events.map((e) => e.start)).toEqual([0.5, 2.5]);
  });
  it("round-trips through the MIDI file reader at the same steps, pitch and length", async () => {
    const blob = writeMidiFile(collectSongNotes([synth], tp, 0, 32), 120, 4);
    const parsed = parseMidiFile(await blob.arrayBuffer());
    const lead = parsed.find((t) => t.name.toUpperCase() === "LEAD")!;
    expect(lead.notes.map((n) => [n.step, n.pitch, n.length])).toEqual([
      [4, 60, 2],
      [20, 60, 2],
    ]);
  });
  it("skips muted tracks", () => {
    expect(collectSongNotes([{ ...synth, muted: true }], tp, 0, 32)).toHaveLength(0);
  });
});

describe("project media is saved as the project's own copy", () => {
  const prefix = "u/new/";
  it("copies another project's stored sample into a duplicate", () => {
    expect(
      ownedMediaPlan("https://signed/link", "u/old/samples/a.wav", "u/new/samples/a.wav", prefix),
    ).toEqual({
      kind: "copy",
      from: "https://signed/link",
      cloudPath: "u/new/samples/a.wav",
      fallbackPath: "u/old/samples/a.wav",
    });
  });
  it("keeps this project's own copy without uploading again", () => {
    expect(
      ownedMediaPlan("https://signed/link", "u/new/samples/a.wav", "u/new/samples/b.wav", prefix),
    ).toEqual({ kind: "keep", cloudPath: "u/new/samples/a.wav" });
  });
  it("uploads new recordings, and never stores an expiring link as the path", () => {
    expect(ownedMediaPlan("blob:x", undefined, "u/new/audio/c.wav", prefix)).toEqual({
      kind: "copy",
      from: "blob:x",
      cloudPath: "u/new/audio/c.wav",
    });
    expect(
      ownedMediaPlan("https://web/old.wav", "https://expired", "u/new/audio/c.wav", prefix),
    ).toMatchObject({ kind: "copy", cloudPath: "u/new/audio/c.wav", fallbackPath: undefined });
  });
});
