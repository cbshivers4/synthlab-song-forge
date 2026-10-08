import { describe, expect, it } from "vitest";
import { DRUM_KIND_ORDER, drumRows, padNote } from "./drum-notes";
import type { DrumPad } from "./types";

describe("drum display order", () => {
  it("starts with kick and preserves pad identity, original indices and MIDI notes", () => {
    const pads = [...DRUM_KIND_ORDER].reverse().map((kind, index) => ({
      id: `pad-${index}`, kind, name: kind, steps: [0, 1],
    } as DrumPad));
    const original = pads.map((pad) => pad.id);
    const rows = drumRows(pads);
    expect(rows.map(({ pad }) => pad.kind)).toEqual([
      "kick", "snare", "hat", "openhat", "clap", "rim", "tom", "perc", "ride", "crash", "fx",
    ]);
    expect(pads.map((pad) => pad.id)).toEqual(original);
    for (const row of rows) {
      expect(pads[row.index]).toBe(row.pad);
      expect(row.note).toBe(padNote(row.pad, pads));
    }
  });
});