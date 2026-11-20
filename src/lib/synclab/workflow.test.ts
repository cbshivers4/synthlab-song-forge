import { describe, expect, it } from "vitest";
import { deleteSelectedPart, selectedClip, selectedPartBounds } from "./workflow";
import type { Track } from "./types";

const track = (values: Partial<Track>) => ({ id: "track", kind: "audio", ...values }) as Track;
describe("selected-part workflow", () => {
  it("does nothing when only a channel is selected", () => {
    expect(
      deleteSelectedPart(
        track({ notes: [{ id: "n", step: 0, length: 1, pitch: 60, velocity: 1 }] }),
        120,
        4,
      ),
    ).toBeNull();
  });
  it("deletes only the selected audio clip and preserves sibling clips", () => {
    const patch = deleteSelectedPart(
      track({
        activeClipId: "a",
        clips: [
          { id: "a", name: "A", duration: 2, peaks: [] },
          { id: "b", name: "B", duration: 2, peaks: [] },
        ],
      }),
      120,
      4,
    );
    expect(patch?.clips?.map((c) => c.id)).toEqual(["b"]);
    expect(patch).not.toHaveProperty("id");
  });
  it("deletes the whole song-long note block even when the loop covers only some bars", () => {
    const patch = deleteSelectedPart(
      track({
        kind: "instrument",
        steps: 16,
        activeRegion: 0,
        notes: [{ id: "n", step: 0, length: 1, pitch: 60, velocity: 1 }],
      }),
      120,
      4,
      [16, 32],
    );
    expect(patch?.notes).toEqual([]);
  });
  it("a second Delete on what is left of a block still removes it (nothing hides under the loop)", () => {
    const left = track({
      kind: "instrument",
      steps: 64,
      activeRegion: 0,
      notes: [{ id: "n", step: 40, length: 1, pitch: 60, velocity: 1 }],
    });
    expect(deleteSelectedPart(left, 120, 4, [0, 32])?.notes).toEqual([]);
  });
  it("deletes the whole drum block it was asked to, loop or not", () => {
    const t = track({
      kind: "drum",
      activeRegion: 0,
      steps: 16,
      pads: [{ id: "kick", steps: [1, 0, 0, 0] }] as Track["pads"],
    });
    const patch = deleteSelectedPart(t, 120, 4, [16, 32]);
    expect(patch?.pads?.[0]?.steps.some((v) => v > 0)).toBe(false);
  });
  it("never treats an unselected first audio clip as the selected part", () => {
    const t = track({ clips: [{ id: "clip", name: "Take", duration: 2, peaks: [] }] });
    expect(selectedClip(t)).toBeUndefined();
    expect(selectedPartBounds(t, 120, 4)).toBeNull();
  });
  it("fits the loop to the explicit audio clip at its timeline position", () => {
    const t = track({
      activeClipId: "clip",
      clips: [{ id: "clip", name: "Take", start: 16, duration: 2, peaks: [] }],
    });
    expect(selectedPartBounds(t, 120, 4)).toEqual([16, 32]);
  });
  it("keeps selected drum parts inside loop-bounded edits", () => {
    expect(
      selectedPartBounds(
        track({ kind: "drum", activeRegion: 24, cuts: [24], patternRegion: [16, 32] }),
        120,
        4,
      ),
    ).toEqual([24, 32]);
  });
  it("deletes the tapped note block, not a hidden recorded take on the same channel", () => {
    const notes = [
      { id: "a", step: 0, length: 1, pitch: 60, velocity: 1 },
      { id: "b", step: 20, length: 1, pitch: 62, velocity: 1 },
    ];
    const t = track({
      kind: "instrument",
      steps: 64,
      notes,
      cuts: [16],
      activeRegion: 16,
      activeClipId: "take",
      printedAudio: false,
      clips: [{ id: "take", name: "TAKE 1", duration: 2, peaks: [] }],
    });
    expect(selectedClip(t)).toBeUndefined();
    const patch = deleteSelectedPart(t, 120, 4);
    expect(patch?.clips).toBeUndefined();
    expect(patch?.notes?.map((n) => n.id)).toEqual(["a"]);
  });
  it("deletes a whole cut block even when it sits outside the loop markers", () => {
    const notes = [
      { id: "a", step: 0, length: 1, pitch: 60, velocity: 1 },
      { id: "b", step: 40, length: 1, pitch: 62, velocity: 1 },
    ];
    const t = track({ kind: "instrument", steps: 64, notes, cuts: [32], activeRegion: 32 });
    const patch = deleteSelectedPart(t, 120, 4, [0, 16]);
    expect(patch?.notes?.map((n) => n.id)).toEqual(["a"]);
  });
});
