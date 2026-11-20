import { describe, expect, it } from "vitest";
import {
  addCut,
  cutNotesAt,
  deleteRegion,
  regionAt,
  regionsOf,
  snapCut,
  unrollNotes,
} from "./note-cuts";
import type { MidiNote } from "./types";

const note = (id: string, step: number, length = 4): MidiNote => ({
  id,
  step,
  length,
  pitch: 60,
  velocity: 0.9,
});

describe("note channel cutting", () => {
  it("unrolls a 16-step loop across a 64-step song so a cut in bar 3 finds the note", () => {
    const out = unrollNotes([note("a", 2)], 16, 64);
    expect(out.map((n) => n.step)).toEqual([2, 18, 34, 50]);
    const { notes, cut } = cutNotesAt(out, 35.5, 1);
    expect(cut).toBe(1);
    const parts = notes.filter((n) => n.step >= 34 && n.step < 40);
    expect(parts.map((n) => [n.step, n.length])).toEqual([
      [34, 1.5],
      [35.5, 2.5],
    ]);
  });

  it("cuts off the grid at the exact position when free", () => {
    expect(snapCut(10.37, 1, true)).toBe(10.37);
    expect(snapCut(10.37, 1, false)).toBe(10);
    expect(snapCut(10.37, 0, false)).toBe(10.37);
  });

  it("splits the song into regions and deletes only the chosen one", () => {
    const cuts = addCut(addCut(undefined, 16, 64), 32, 64);
    expect(regionsOf(cuts, 64)).toEqual([
      [0, 16],
      [16, 32],
      [32, 64],
    ]);
    expect(regionAt(cuts, 64, 20)).toEqual([16, 32]);
    const notes = unrollNotes([note("a", 2)], 16, 64);
    expect(deleteRegion(notes, [16, 32]).map((n) => n.step)).toEqual([2, 34, 50]);
  });
});
