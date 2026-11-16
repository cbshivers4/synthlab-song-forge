import { describe, expect, it } from "vitest";
import {
  BLG_PRESETS, applyMinorness, blgNotes, currentLine, defaultBlgPattern, editableLine, generateLine, presetPattern,
  randomizeBlg, sourceSlots, stretchInterval, variatorValue, type BlgPattern,
} from "./bassline-player";

const opts = { bars: 4, barSteps: 16, octave: 1 };
const shape = (p: BlgPattern) => blgNotes(p, opts).map((n) => `${n.step}:${n.length}:${n.pitch}`).join(",");
const count = (line: ReturnType<typeof generateLine>) => line.filter(Boolean).length;

describe("Bassline Generator player", () => {
  it("sources are fixed: the same number always gives the same phrase", () => {
    expect(JSON.stringify(sourceSlots("on", "A", 20))).toBe(JSON.stringify(sourceSlots("on", "A", 20)));
    expect(JSON.stringify(sourceSlots("on", "A", 20))).not.toBe(JSON.stringify(sourceSlots("on", "B", 20)));
  });

  it("higher source numbers make busier lines", () => {
    const busy = (lane: "on" | "off", idx: number) => sourceSlots(lane, "A", idx).filter((s) => s.hit).length;
    expect(busy("on", 63)).toBeGreaterThan(busy("on", 0));
    expect(busy("off", 63)).toBeGreaterThan(busy("off", 0));
  });

  it("on-beat notes land on odd steps (1, 3, 5…) and off-beat notes between them", () => {
    const p = { ...defaultBlgPattern(), steps: 32 };
    generateLine(p).forEach((c, i) => { if (c) expect(c.lane).toBe(i % 2 === 0 ? "on" : "off"); });
  });

  it("turning a lane's velocity to zero switches that lane off", () => {
    const p = defaultBlgPattern();
    const line = generateLine({ ...p, off: { ...p.off, velocity: 0 } });
    expect(line.some((c) => c?.lane === "off")).toBe(false);
    expect(line.some((c) => c?.lane === "on")).toBe(true);
  });

  it("the line is mono: notes never overlap", () => {
    for (const pre of BLG_PRESETS) {
      const notes = blgNotes(presetPattern(pre), opts).sort((a, b) => a.step - b.step);
      for (let i = 1; i < notes.length; i++) expect(notes[i - 1]!.step + notes[i - 1]!.length, pre.id).toBeLessThanOrEqual(notes[i]!.step + 1e-6);
    }
  });

  it("a Square variator leaves the first half alone and changes the second half", () => {
    const p = { ...defaultBlgPattern(), steps: 32 };
    const varied = { ...p, on: { ...p.on, variator: "square", amount: 0.8 } };
    const a = generateLine(p), b = generateLine(varied);
    expect(JSON.stringify(b.slice(0, 16).filter((c, i) => i % 2 === 0))).toBe(JSON.stringify(a.slice(0, 16).filter((c, i) => i % 2 === 0)));
    expect(JSON.stringify(b.slice(16))).not.toBe(JSON.stringify(a.slice(16)));
    expect(variatorValue("square-inv", 0, 32)).toBe(1);
    expect(variatorValue("pulse2", 15, 32)).toBe(1);
  });

  it("Minorness flattens 7ths, then 3rds, then 6ths, then 2nds", () => {
    expect(applyMinorness(11, 1)).toBe(10);
    expect(applyMinorness(4, 1)).toBe(4);
    expect(applyMinorness(4, 2)).toBe(3);
    expect(applyMinorness(9, 3)).toBe(8);
    expect(applyMinorness(14, 4)).toBe(13);
    expect(applyMinorness(7, 4)).toBe(7);
  });

  it("Note Range stretches an octave to an octave + fifth and shrinks it to a fifth", () => {
    expect(stretchInterval(12, 1)).toBe(19);
    expect(stretchInterval(12, -1)).toBe(5);
    expect(stretchInterval(0, 1)).toBe(0);
  });

  it("Shift moves the whole line by steps", () => {
    const p = defaultBlgPattern();
    const a = generateLine(p), b = generateLine({ ...p, shift: 2 });
    expect(count(a)).toBe(count(b));
    a.forEach((c, i) => { if (c) expect(b[(i + 2) % 16]?.iv).toBe(c.iv); });
  });

  it("Rate 1/8 spreads the same line twice as wide as 1/16", () => {
    const p = defaultBlgPattern();
    const a = blgNotes(p, { ...opts, bars: 2 });
    const b = blgNotes({ ...p, rate: "1/8" }, { ...opts, bars: 4 });
    expect(b.map((n) => n.step)).toEqual(a.map((n) => n.step * 2));
  });

  it("Shuffle delays only off-beat notes", () => {
    const p = { ...defaultBlgPattern(), shuffle: 75 };
    for (const n of blgNotes(p, opts)) {
      const frac = n.step % 2;
      expect([0, 1.5]).toContain(frac);
    }
  });

  it("Follow chords plays each bar on that bar's chord root", () => {
    const p = { ...defaultBlgPattern(), off: { ...defaultBlgPattern().off, velocity: 0 }, on: { ...defaultBlgPattern().on, index: 0 } };
    const notes = blgNotes(p, { ...opts, rootsPerBar: [9, 5, 0, 7] });
    const first = (bar: number) => notes.find((n) => n.step >= bar * 16)!.pitch % 12;
    expect([first(0), first(1), first(2), first(3)]).toEqual([9, 5, 0, 7]);
  });

  it("hand edits replace the generated line until cleared", () => {
    const p = defaultBlgPattern();
    const edits: ReturnType<typeof editableLine> = editableLine(p).map(() => null);
    edits[0] = { iv: 7, vel: 1, len: 1, lane: "on", tie: true };
    const line = currentLine({ ...p, edits });
    expect(line.filter(Boolean)).toHaveLength(1);
    expect(line[0]!.len).toBe(16); // tied: runs to the end
  });

  it("every patch plays its own bassline", () => {
    const shapes = BLG_PRESETS.map((pre) => shape(presetPattern(pre)));
    expect(new Set(shapes).size).toBe(BLG_PRESETS.length);
    for (const pre of BLG_PRESETS) expect(blgNotes(presetPattern(pre), opts).length, pre.id).toBeGreaterThan(3);
  });

  it("Randomize changes the line", () => {
    const p = defaultBlgPattern();
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    expect(shape(randomizeBlg(p, rand))).not.toBe(shape(p));
  });
});
