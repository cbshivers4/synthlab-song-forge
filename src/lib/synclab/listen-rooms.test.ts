import { describe, expect, it } from "vitest";
import { LISTEN_ROOMS, roomById, roomImpulse, roomNoise } from "./listen-rooms";
import { MASTER_DEFAULTS, brickwall } from "./mastering";

describe("sound check rooms", () => {
  it("offers the places the user asked for: car, club, walkman, home and movie theater", () => {
    const ids = LISTEN_ROOMS.map((r) => r.id);
    for (const id of ["car", "club", "walkman", "home", "theater"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a flat studio reference with no colouring", () => {
    const studio = roomById("studio");
    expect(studio.eq).toEqual([]);
    expect(studio.reverb).toBeUndefined();
    expect(studio.noise).toBeUndefined();
    expect(studio.level).toBe(0);
  });

  it("plays club systems in mono and lets walkman use tape wow", () => {
    expect(roomById("club").width).toBe(0);
    expect(roomById("walkman").wow).toBeDefined();
  });

  it("room reverb tails die away and are repeatable", () => {
    const [a] = roomImpulse(48000, 1, 4000);
    const [b] = roomImpulse(48000, 1, 4000);
    expect(a).toEqual(b);
    const energy = (from: number, to: number) => a.slice(from, to).reduce((s, v) => s + v * v, 0);
    expect(energy(0, 4800)).toBeGreaterThan(energy(43200, 48000) * 50);
  });

  it("background noise is normalised so its dB setting means what it says", () => {
    const [l] = roomNoise("road", 48000, 2);
    const mid = l.slice(4800, l.length - 4800);
    const rms = Math.sqrt(mid.reduce((s, v) => s + v * v, 0) / mid.length);
    expect(rms).toBeGreaterThan(0.8);
    expect(rms).toBeLessThan(1.2);
  });
});

describe("advanced mastering devices", () => {
  it("are all off by default so presets sound the same as before", () => {
    expect(MASTER_DEFAULTS.eqOn).toBe(false);
    expect(MASTER_DEFAULTS.mbOn).toBe(false);
    expect(MASTER_DEFAULTS.imgOn).toBe(false);
    expect(MASTER_DEFAULTS.excOn).toBe(false);
    expect(MASTER_DEFAULTS.limLookahead).toBe(2);
    expect(MASTER_DEFAULTS.limRelease).toBe(60);
  });

  it("maximizer holds the ceiling and reports how much it pulled down", () => {
    const n = 4800;
    const left = new Float32Array(n).fill(0.25);
    left[2400] = 2; // a +6 dB spike
    const stats = { minGain: 1 };
    const out = brickwall({ left, right: new Float32Array(left), sampleRate: 48000 }, 0.9, 2, 60, stats);
    expect(Math.max(...out.left.map(Math.abs))).toBeLessThanOrEqual(0.9);
    expect(-20 * Math.log10(stats.minGain)).toBeCloseTo(20 * Math.log10(2 / 0.9), 1);
  });
});
