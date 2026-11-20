import { describe, expect, it } from "vitest";
import {
  DRUM_GENRES,
  GENRE_GROUPS,
  barOptions,
  defaultDrummer,
  fillEvery,
  genBar,
  grooveBars,
  isFillBar,
  padForRole,
  writeHitsToPads,
} from "./drummer";
import { defaultPads } from "./presets";

describe("live drummer grooves", () => {
  it("covers all four genre groups with many styles", () => {
    for (const g of GENRE_GROUPS)
      expect(DRUM_GENRES.filter((x) => x.group === g).length).toBeGreaterThanOrEqual(8);
    expect(new Set(DRUM_GENRES.map((g) => g.id)).size).toBe(DRUM_GENRES.length);
  });

  it("every genre plays something in every lane length", () => {
    for (const g of DRUM_GENRES) {
      const hits = genBar(defaultDrummer(g.id), 0, 16);
      expect(hits.length, g.id).toBeGreaterThan(3);
      expect(hits.every((h) => h.step >= 0 && h.step < 16 && h.vel > 0 && h.vel <= 1)).toBe(true);
    }
  });

  it("is the same every time for the same bar and settings (live = printed)", () => {
    const s = defaultDrummer("funk");
    expect(genBar(s, 3, 16, barOptions(s, 3))).toEqual(genBar(s, 3, 16, barOptions(s, 3)));
  });

  it("plays more notes when complex and fewer when simple", () => {
    for (const id of ["boom-bap", "house", "rock", "samba"]) {
      const simple = genBar({ ...defaultDrummer(id), complexity: 0 }, 0).length;
      const complex = genBar({ ...defaultDrummer(id), complexity: 1 }, 0).length;
      expect(complex, id).toBeGreaterThan(simple);
    }
  });

  it("plays harder when louder", () => {
    const avg = (l: number) => {
      const h = genBar({ ...defaultDrummer("rock"), loudness: l, humanize: 0 }, 0);
      return h.reduce((a, x) => a + x.vel, 0) / h.length;
    };
    expect(avg(1)).toBeGreaterThan(avg(0.2));
  });

  it("puts fills at the end of phrases: every 8, 4 or 2 bars", () => {
    expect(fillEvery(0)).toBe(0);
    expect(fillEvery(0.3)).toBe(8);
    expect(fillEvery(0.6)).toBe(4);
    expect(fillEvery(0.9)).toBe(2);
    expect([0, 1, 2, 3, 4, 5, 6, 7].filter((b) => isFillBar(b, 0.6))).toEqual([3, 7]);
    const s = { ...defaultDrummer("rock"), fills: 0.6 };
    const fill = genBar(s, 3, 16, barOptions(s, 3));
    expect(fill.some((h) => h.role.startsWith("tom") && h.step >= 12)).toBe(true);
  });

  it("leaves out drum pieces you switch off", () => {
    const s = {
      ...defaultDrummer("house"),
      pieces: { kick: false, snare: true, hats: true, cymbals: true, toms: true, perc: true },
    };
    expect(genBar(s, 1).some((h) => h.role === "kick")).toBe(false);
  });

  it("plays the time on the ride when asked", () => {
    const hits = genBar({ ...defaultDrummer("rock"), timekeeper: "ride" }, 1);
    expect(hits.some((h) => h.role === "ride")).toBe(true);
    expect(hits.some((h) => h.role === "hat")).toBe(false);
  });

  it("follows the song's time signature", () => {
    const hits = genBar(defaultDrummer("rock"), 0, 12);
    expect(hits.every((h) => h.step < 12)).toBe(true);
  });
});

describe("printing the drummer to the timeline", () => {
  it("finds the kit's own congas and toms, and pitches a plain tom when the kit has none", () => {
    const latin = defaultPads(16, "latin");
    expect(padForRole(latin, "conga")?.pad.voice).toBe("conga_hi");
    const plain = defaultPads(16, "606");
    const lo = padForRole(plain, "tomMid");
    expect(lo?.pad.kind).toBe("tom");
  });

  it("writes hits at their song bars and keeps a block for the printed range", () => {
    const pads = defaultPads(16, "rock").map((p) => ({ ...p, steps: Array(16).fill(0) }));
    const s = defaultDrummer("rock");
    const { pads: written, steps } = writeHitsToPads(pads, grooveBars(s, 2, 4, 16), 16);
    expect(steps).toBe(6 * 16);
    const kick = written.find((p) => p.kind === "kick" && !p.voice)!;
    expect(kick.steps.slice(0, 32).every((v) => v === 0)).toBe(true);
    expect(kick.steps[32]).toBeGreaterThan(0);
    expect(written.every((p) => p.steps.length === steps)).toBe(true);
  });
});
