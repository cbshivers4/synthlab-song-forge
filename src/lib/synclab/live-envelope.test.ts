import { describe, expect, it } from "vitest";
import { envelopePoints } from "./live-envelope";

const env = { attack: 1, decay: 1, sustain: 0.5, release: 1 };
describe("live note envelope edits", () => {
  it("continues the current attack instead of restarting the note", () => {
    expect(envelopePoints(env, 4, 0.5)[0]).toEqual([0.5, 0.5]);
  });
  it("updates sustain while keeping the original release time", () => {
    expect(envelopePoints({ ...env, sustain: 0.2 }, 4, 3)).toEqual([
      [3, 0.2],
      [4, 0.2],
      [5, 0],
    ]);
  });
  it("does not revive a finished note", () => {
    expect(envelopePoints(env, 4, 6)).toEqual([[6, 0]]);
  });
});
