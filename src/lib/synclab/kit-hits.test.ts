import { describe, expect, it } from "vitest";
import { acousticPieceFor, HitQueue, swingFor } from "./kit-hits";

describe("Live Drummer kit picture timing", () => {
  it("plays a queued hit only when the audio clock reaches it", () => {
    const q = new HitQueue();
    q.push({ at: 10.3, role: "kick", vel: 1 });
    expect(q.drain(10.29)).toEqual([]);
    expect(q.drain(10.31).map((h) => h.role)).toEqual(["kick"]);
    expect(q.size).toBe(0);
  });
  it("keeps hits in time order even when they arrive out of order", () => {
    const q = new HitQueue();
    q.push({ at: 2, role: "snare", vel: 1 });
    q.push({ at: 1, role: "hat", vel: 1 });
    expect(q.drain(2.05, 2).map((h) => h.role)).toEqual(["hat", "snare"]);
  });
  it("drops hits that are far too late instead of flashing a burst", () => {
    const q = new HitQueue();
    q.push({ at: 1, role: "kick", vel: 1 });
    q.push({ at: 4.9, role: "snare", vel: 1 });
    expect(q.drain(5).map((h) => h.role)).toEqual(["snare"]);
  });
  it("maps drummer roles onto the acoustic set", () => {
    expect(acousticPieceFor("openhat", 0)).toEqual({ piece: "hat", open: true });
    expect(acousticPieceFor("rim", 0).piece).toBe("snare");
    expect(acousticPieceFor("tomLo", 0).piece).toBe("tomLo");
    expect(acousticPieceFor("crash", 0).piece).toBe("crash1");
    expect(acousticPieceFor("crash", 1).piece).toBe("crash2");
  });
  it("swings harder for louder hits", () => {
    expect(swingFor(0.2)).toBeLessThan(swingFor(1));
    expect(swingFor(1)).toBeCloseTo(1.2, 5);
  });
});
