import { describe, expect, it } from "vitest";
import { arpHit } from "./arp-pattern";
import { SYNTH_PRESETS, applyPreset } from "./presets";
import { ARP_DESIGNS } from "./sound-designs";
import { scheduleStep, OFFLINE_LIVE } from "./schedule-step";
import type { SynthPatch } from "./types";

const arp = (o: Partial<SynthPatch["arp"]>): SynthPatch["arp"] => ({
  on: true,
  rate: 1,
  gate: 0.5,
  direction: "up",
  octaves: 1,
  ...o,
});

describe("arp rhythm and note patterns", () => {
  it("rests play nothing and don't move the note walk on", () => {
    const a = arp({ rhythm: "X.x." });
    const played = [0, 1, 2, 3, 4].map((t) => arpHit(a, [60, 64, 67], t)?.pitches[0] ?? null);
    expect(played).toEqual([60, null, 64, null, 67]);
  });
  it("accents are full level, other notes softer, and holds lengthen the note", () => {
    const a = arp({ rhythm: "X--x" });
    expect(arpHit(a, [60], 0)).toEqual({ pitches: [60], accent: 1, length: 3 });
    expect(arpHit(a, [60], 1)).toBeNull();
    expect(arpHit(a, [60], 3)?.accent).toBeLessThan(1);
  });
  it("a note pattern turns one held key into a riff", () => {
    const a = arp({ notes: [0, 12, 7, 3] });
    expect([0, 1, 2, 3, 4].map((t) => arpHit(a, [48], t)?.pitches[0])).toEqual([
      48, 60, 55, 51, 48,
    ]);
  });
  it("chord mode plays every held key on each hit, climbing octaves", () => {
    const a = arp({ direction: "chord", octaves: 2 });
    expect(arpHit(a, [60, 63, 67], 0)?.pitches).toEqual([60, 63, 67]);
    expect(arpHit(a, [60, 63, 67], 1)?.pitches).toEqual([72, 75, 79]);
  });
  it("random order is the same every time, so export matches playback", () => {
    const a = arp({ direction: "random", octaves: 2 });
    const run = () => Array.from({ length: 12 }, (_, t) => arpHit(a, [60, 64, 67], t)?.pitches[0]);
    expect(run()).toEqual(run());
  });
});

describe("arp presets", () => {
  it("every arpeggio and sequence preset plays its own groove", () => {
    const seen = new Map<string, string>();
    for (const def of SYNTH_PRESETS) {
      const a = applyPreset(def.name).arp;
      if (!a.on) continue;
      expect(ARP_DESIGNS[def.name], def.name).toBeDefined();
      const sig = JSON.stringify([a.rate, a.direction, a.octaves, a.rhythm ?? "", a.notes ?? []]);
      expect(
        seen.get(sig),
        `${def.name} plays the same pattern as ${seen.get(sig)}`,
      ).toBeUndefined();
      seen.set(sig, def.name);
    }
    expect(seen.size).toBeGreaterThanOrEqual(45);
  });
  it("song playback arpeggiates a held chord instead of repeating it", () => {
    const played: number[] = [];
    const engine = {
      tempo: 120,
      playNote: (_t: string, _p: unknown, m: number) => played.push(m),
      setPitchBend() {},
      setModWheel() {},
      playClick() {},
    };
    const patch = { ...applyPreset("Night Arp"), arp: arp({ octaves: 1 }) };
    const track = {
      id: "a",
      kind: "instrument",
      steps: 16,
      muted: false,
      solo: false,
      patch,
      notes: [60, 64, 67].map((pitch, i) => ({
        id: `n${i}`,
        step: 0,
        length: 4,
        pitch,
        velocity: 0.8,
      })),
    };
    const tp = {
      bpm: 120,
      swing: 0,
      bars: 1,
      metronome: false,
      recording: false,
      playing: true,
      step: 0,
      countIn: false,
      loop: false,
    };
    for (let n = 0; n < 4; n++)
      scheduleStep(engine as never, [track] as never, tp as never, n, n * 0.125, OFFLINE_LIVE);
    expect(played).toEqual([60, 64, 67, 60]);
  });
});
