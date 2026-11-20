import { describe, expect, it } from "vitest";
import { mergePaintSelection, paintTrackRange } from "./track-paint";

const IDS = ["kick", "hat", "bass", "lead", "vox"];

describe("dragging the mouse down the channel names", () => {
  it("highlights every channel between where the drag started and where it ended", () => {
    expect(paintTrackRange(IDS, "hat", "lead")).toEqual(["hat", "bass", "lead"]);
  });
  it("works dragging upwards too", () => {
    expect(paintTrackRange(IDS, "lead", "kick")).toEqual(["kick", "hat", "bass", "lead"]);
  });
  it("a drag that never leaves its own row highlights just that channel", () => {
    expect(paintTrackRange(IDS, "bass", "bass")).toEqual(["bass"]);
  });
  it("a row that is no longer on screen picks nothing", () => {
    expect(paintTrackRange(IDS, "bass", "gone")).toEqual([]);
    expect(paintTrackRange(IDS, "gone", "bass")).toEqual([]);
  });
  it("a plain drag replaces the highlight, Ctrl/⌘/Shift keeps what was already picked", () => {
    expect(mergePaintSelection(["vox"], ["kick", "hat"], false)).toEqual(["kick", "hat"]);
    expect(mergePaintSelection(["vox"], ["kick", "hat"], true)).toEqual(["vox", "kick", "hat"]);
    expect(mergePaintSelection(["kick"], ["kick", "hat"], true)).toEqual(["kick", "hat"]);
  });
});
