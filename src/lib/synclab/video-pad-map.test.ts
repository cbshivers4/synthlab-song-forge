import { describe, expect, it } from "vitest";
import { VIDEO_PAD_KEYS, videoPadForNote } from "./video-pad-map";

describe("video pad keyboard mapping", () => {
  it("maps sixteen consecutive notes to sixteen unique pad keys", () => {
    expect(new Set(VIDEO_PAD_KEYS).size).toBe(16);
    for (let i = 0; i < 16; i++) expect(videoPadForNote(60 + i, 16)).toBe(i);
  });
  it("does not trigger missing pads or notes outside the mapped range", () => {
    for (const note of [59, 64, 76, 60.5]) expect(videoPadForNote(note, 4)).toBeNull();
    expect(videoPadForNote(60, 0)).toBeNull();
  });
});