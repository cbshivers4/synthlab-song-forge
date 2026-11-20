import { describe, expect, it, vi } from "vitest";
import { arpLiveNote, arpSequence, stopLiveArps } from "./live-arp";
import { triggerNote } from "./schedule-step";
import { applyPreset } from "./presets";

const arp = (
  o: Partial<{ direction: "up" | "down" | "updown" | "alternate" | "random"; octaves: number }>,
) => ({ on: true, rate: 1, gate: 0.5, direction: "up" as const, octaves: 1, ...o });

describe("live arpeggiator", () => {
  it("walks held notes in each direction", () => {
    expect(arpSequence([64, 60, 67], arp({}))).toEqual([60, 64, 67]);
    expect(arpSequence([60, 64, 67], arp({ direction: "down" }))).toEqual([67, 64, 60]);
    expect(arpSequence([60, 64], arp({ octaves: 2 }))).toEqual([60, 64, 72, 76]);
    expect(arpSequence([60, 64, 67], arp({ direction: "updown" }))).toEqual([60, 64, 67, 64]);
  });

  it("plays a hand-played note as a stream of arp notes when ARP is on", () => {
    vi.useFakeTimers();
    const ctx = { currentTime: 0 } as AudioContext;
    const played: number[] = [];
    const engine = {
      ctx,
      tempo: 120,
      init: () => ctx,
      playNote: (_t: string, _p: unknown, m: number) => {
        played.push(m);
      },
    };
    const patch = { ...applyPreset("Night Arp"), arp: arp({ octaves: 2 }) };
    triggerNote(engine as never, { id: "s", kind: "instrument", patch } as never, 60, 1, 0.9);
    expect(played.length).toBeGreaterThan(0);
    for (let i = 0; i < 8; i++) {
      (ctx as { currentTime: number }).currentTime += 0.1;
      vi.advanceTimersByTime(25);
    }
    expect(played).toContain(72);
    expect(played.length).toBeGreaterThanOrEqual(4);
    stopLiveArps();
    vi.useRealTimers();
  });

  it("returns false so the note plays normally when ARP is off", () => {
    const ctx = { currentTime: 0 } as AudioContext;
    const patch = { ...applyPreset("Night Arp"), arp: { ...arp({}), on: false } };
    expect(arpLiveNote({ ctx, tempo: 120, playNote: () => {} }, "x", patch, 60, 1, 1)).toBe(false);
  });
});
