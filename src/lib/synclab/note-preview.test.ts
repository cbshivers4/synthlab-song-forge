import { describe, expect, it } from "vitest";
import { previewTrack } from "./note-preview";
import { applyPreset } from "./presets";
import type { Track } from "./types";

describe("preset audition", () => {
  it("plays the selected patch rather than the previous track patch before an edit commits", () => {
    const previous = applyPreset("Init");
    const selected = { ...previous, name: "Selected bass", cutoff: 320, oscillators: previous.oscillators.map(o => ({ ...o, wave: "square" as const })) };
    const track = { id: "synth", kind: "instrument", patch: previous } as Track;
    const result = previewTrack(track, selected);
    expect(result.patch?.cutoff).toBe(320);
    expect(result.patch?.oscillators[0]?.wave).toBe("square");
    expect(track.patch).toBe(previous);
    expect(previewTrack(track)).toBe(track);
  });
});