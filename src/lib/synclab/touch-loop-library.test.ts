import { describe, expect, it } from "vitest";
import {
  genreLoops,
  loadGenreLoops,
  TOUCH_LOOP_GENRES,
  TOUCH_LOOP_LIBRARY,
} from "./touch-loop-library";
import { TOUCH_LANES, TOUCH_SCALES } from "./touch-synth";

describe("Touch Synth genre loops", () => {
  it("offers 68 distinct compositions across 34 genres with all five lanes populated", () => {
    expect(TOUCH_LOOP_LIBRARY).toHaveLength(68);
    expect(TOUCH_LOOP_GENRES).toHaveLength(34);
    const signatures = TOUCH_LOOP_LIBRARY.map((p) => {
      const loops = genreLoops(p, 0);
      for (const lane of TOUCH_LANES) {
        expect(loops[lane.id]?.length).toBeGreaterThan(0);
        for (const n of loops[lane.id] ?? []) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.step + n.length).toBeLessThanOrEqual(32);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1);
          if (!lane.drums) expect(TOUCH_SCALES[p.scale]).toContain(n.pitch % 12);
        }
      }
      return JSON.stringify(loops);
    });
    expect(new Set(signatures).size).toBe(68);
  });
  it("loading a single lane retains every other recorded note", () => {
    const note = { step: 5, pitch: 60, length: 1, vel: 0.9 };
    const result = loadGenreLoops(
      { bass: [note], melody: [note] },
      { bass: [{ ...note, step: 8 }] },
      "bass",
    );
    expect(result["bass"]?.map((n) => n.step)).toEqual([8]);
    expect(result["melody"]).toEqual([note]);
  });
  it("loads independent editable copies rather than changing factory compositions", () => {
    const preset = TOUCH_LOOP_LIBRARY[0];
    if (!preset) throw new Error("Missing factory composition");
    const source = genreLoops(preset, 0);
    const loaded = loadGenreLoops({}, source);
    const first = loaded["bass"]?.[0];
    if (!first) throw new Error("Missing bass loop");
    first.pitch = 1;
    expect(source["bass"]?.[0]?.pitch).toBe(36);
    expect(genreLoops(preset, 7)["bass"]?.[0]?.pitch).toBe(43);
  });
});
