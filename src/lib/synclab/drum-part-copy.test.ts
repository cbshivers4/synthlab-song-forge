import { describe, expect, it } from "vitest";
import {
  drumCopySpan,
  pasteTrackContent,
  rightEdgeEdit,
  stretchDrumPart,
} from "./arrangement-edit";
import type { Track } from "./types";

const pad = {
  id: "k",
  name: "Kick",
  kind: "kick" as const,
  volume: 1,
  pan: 0,
  pitch: 0,
  decay: 0.5,
  muted: false,
  solo: false,
  steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
};
const drums: Track = {
  id: "d",
  name: "Drums",
  kind: "drum",
  color: "grey",
  volume: 0.7,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  frozen: false,
  hidden: false,
  input: "none",
  bus: "master",
  steps: 16,
  clips: [],
  pads: [pad],
};

describe("drum block copy", () => {
  it("copies a 4-bar block of a 1-bar looping pattern at its full 4-bar length", () => {
    const source = { ...drums, patternRegion: [0, 64] as [number, number] };
    const next = pasteTrackContent(drums, source, 64, 0.125);
    const pasted = next.pads![0]!.steps.slice(64, 128);
    expect(pasted.filter((v) => v > 0).length).toBe(16);
    expect(pasted[60]).toBe(1);
  });
  it("copies only the selected part between cut marks", () => {
    const t = { ...drums, cuts: [16, 48], activeRegion: 16 };
    expect(drumCopySpan(t, [0, 64])).toEqual([16, 48]);
    expect(drumCopySpan({ ...drums }, [0, 64])).toEqual([0, 64]);
  });
});

describe("drum block stretch", () => {
  it("stretching a 1-bar part to 2 bars spreads its hits across the 2 bars", () => {
    const next = stretchDrumPart({ ...drums, patternRegion: [0, 16] }, 0, 16, 32);
    expect(
      next
        .pads![0]!.steps.slice(0, 32)
        .map((v, i) => (v > 0 ? i : -1))
        .filter((i) => i >= 0),
    ).toEqual([0, 8, 16, 24]);
    expect(next.patternRegion).toEqual([0, 32]);
  });
  it("a drum audio clip dragged to double length stretches its audio by 2x", () => {
    const clip = { id: "c", name: "Beat", duration: 2, length: 2, peaks: [1], start: 0 };
    const edit = rightEdgeEdit(clip, 2, 2, false, true);
    expect(edit.stretch).toBe(2);
    expect(edit.seconds).toBe(4);
  });
});
