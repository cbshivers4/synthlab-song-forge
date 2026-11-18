import { describe, expect, it } from 'vitest';
import { duplicatePianoNotes, movePianoNotes, pastePianoNotes } from './piano-edit';
const notes = [{ id: 'a', step: 4, pitch: 60, length: 2, velocity: 0.8 }, { id: 'b', step: 8, pitch: 64, length: 2, velocity: 0.7 }];
it('pastes selected notes at the cursor with their relative timing and new IDs', () => {
  const pasted = pastePianoNotes(notes, 16, [0, 32]);
  expect(pasted.map(n => n.step)).toEqual([16, 20]);
  expect(pasted[0]?.id).not.toBe('a');
  expect(pasted.map(n => n.pitch)).toEqual([60, 64]);
});
it('clips pasted note ends to the loop and rejects notes beyond it', () => {
  const pasted = pastePianoNotes(notes, 31, [0, 32]);
  expect(pasted).toHaveLength(1);
  expect(pasted[0]?.length).toBe(1);
});
it('moves a selected group together without crossing the loop or moving unselected notes', () => {
  const moved = movePianoNotes(notes, ['a','b'], -20, 12, [0, 16]);
  expect(moved.map(n => n.step)).toEqual([0, 4]);
  expect(moved.map(n => n.pitch)).toEqual([72,76]);
  expect(movePianoNotes(notes, ['a'], 2, 1, [0,16])[1]).toBe(notes[1]);
});
describe("moving a group of notes", () => {
  const n = (id: string, step: number, length = 2) => ({ id, pitch: 60, step, length, velocity: 0.8 });
  it("moves every picked note by the same amount", () => {
    const moved = movePianoNotes([n("a", 4), n("b", 8), n("c", 30)], ["a", "b"], 4, 2, [0, 64]);
    expect(moved.map((x) => [x.step, x.pitch])).toEqual([[8, 62], [12, 62], [30, 60]]);
  });
  it("never pulls a group that sits outside the loop into it", () => {
    const moved = movePianoNotes([n("a", 40), n("b", 44)], ["a", "b"], 0, 1, [0, 16]);
    expect(moved.map((x) => x.step)).toEqual([40, 44]);
  });
});

describe("Duplicate after (piano roll note menu)", () => {
  it("places copies of the picked notes right after them, keeping pitches and gaps", () => {
    const notes = [
      { id: "a", step: 4, length: 2, pitch: 60, velocity: 0.8 },
      { id: "b", step: 6, length: 2, pitch: 64, velocity: 0.8 },
      { id: "c", step: 20, length: 1, pitch: 40, velocity: 0.8 },
    ];
    const copies = duplicatePianoNotes(notes, ["a", "b"], [0, 64]);
    expect(copies.map(n => [n.step, n.pitch])).toEqual([[8, 60], [10, 64]]);
    expect(copies.every(n => n.id !== "a" && n.id !== "b")).toBe(true);
  });
  it("does nothing when no notes are picked", () => {
    expect(duplicatePianoNotes([{ id: "a", step: 0, length: 1, pitch: 60, velocity: 1 }], [], [0, 16])).toEqual([]);
  });
});
