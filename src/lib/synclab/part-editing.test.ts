import { describe, expect, it } from "vitest";
import { moveNoteRegion, notesInRegion, regionsOf, trimNoteRegion } from "./note-cuts";
import { trimDrumPart } from "./arrangement-edit";
import type { MidiNote, Track } from "./types";

const n = (id: string, step: number, length = 2): MidiNote => ({
  id,
  step,
  length,
  pitch: 60,
  velocity: 0.8,
});
// Three parts on a 64-step song: [0,16) A, [16,32) B (empty), [32,48) C
const notes = [n("a1", 0), n("a2", 8), n("c1", 32), n("c2", 40)];
const cuts = [16, 32, 48];

describe("moving one MIDI part", () => {
  it("moves only that part; the other part stays put", () => {
    const r = moveNoteRegion(notes, cuts, 64, [0, 16], 8);
    expect(r.notes.find((x) => x.id === "a1")!.step).toBe(8);
    expect(r.notes.find((x) => x.id === "a2")!.step).toBe(16);
    expect(r.notes.find((x) => x.id === "c1")!.step).toBe(32);
    expect(r.activeRegion).toBe(8);
  });
  it("never lands on top of the next part", () => {
    const r = moveNoteRegion(notes, cuts, 64, [0, 16], 40);
    expect(r.delta).toBe(16); // stops where part C starts
    expect(
      notesInRegion(r.notes, [16, 32])
        .map((x) => x.id)
        .sort(),
    ).toEqual(["a1", "a2"]);
  });
});

describe("trimming one MIDI part", () => {
  it("right trim cuts the crossing note and removes what is outside", () => {
    const r = trimNoteRegion(notes, cuts, 64, [32, 48], 32, 41);
    const c = r.notes.filter((x) => x.step >= 32);
    expect(c.map((x) => x.step)).toEqual([32, 40]);
    expect(c[1]!.length).toBeCloseTo(1);
    expect(regionsOf(r.cuts, 64).some(([a, b]) => a === 32 && b === 41)).toBe(true);
  });
  it("left trim removes the notes before the new start, other parts untouched", () => {
    const r = trimNoteRegion(notes, cuts, 64, [0, 16], 4, 16);
    expect(r.notes.map((x) => x.id)).not.toContain("a1");
    expect(r.notes.filter((x) => x.step >= 32)).toHaveLength(2);
  });
  it("extending stops at the neighbouring part", () => {
    const r = trimNoteRegion(notes, cuts, 64, [0, 16], 0, 60);
    expect(regionsOf(r.cuts, 64).some(([a, b]) => a === 0 && b === 32)).toBe(true);
  });
});

describe("trimming one drum part", () => {
  const track = {
    id: "t",
    kind: "drum",
    steps: 32,
    cuts: [16],
    pads: [
      {
        id: "k",
        steps: [
          1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
          0, 0,
        ],
      },
    ],
  } as unknown as Track;
  it("keeps hits inside the new edges where they were and clears the rest of that part only", () => {
    const r = trimDrumPart(track, 0, 16, 0, 8);
    const s = r.pads![0]!.steps;
    expect(s.slice(0, 8)).toEqual([1, 0, 0, 0, 1, 0, 0, 0]);
    expect(s.slice(8, 16).every((v) => v === 0)).toBe(true);
    expect(s[16]).toBe(1); // next part untouched
    expect(r.cuts).toContain(8);
  });
});
