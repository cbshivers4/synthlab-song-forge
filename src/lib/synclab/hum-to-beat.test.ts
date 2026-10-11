import { describe, expect, it } from "vitest";
import { alignToStart, analyseBeatbox, analyseMelody } from "./hum-to-beat";

const RATE = 44100;

describe("hum-to-beat", () => {
  it("tracks a hummed A4 then C5", () => {
    const d = new Float32Array(RATE);
    for (let i = 0; i < RATE; i++) {
      const hz = i < RATE / 2 ? 440 : 523.25;
      d[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / RATE);
    }
    const notes = alignToStart(analyseMelody(d, RATE, 120));
    expect(notes.map((n) => n.pitch)).toEqual([69, 72]);
    expect(notes[0]!.step).toBe(0);
  });

  it("hears a quiet hum with harmonics, vibrato and gaps", () => {
    const d = new Float32Array(RATE * 2);
    const segs = [[0, 0.5, 220], [0.6, 1.1, 246.94], [1.2, 1.8, 196]] as const;
    let ph = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / RATE;
      const seg = segs.find(([a, b]) => t >= a && t < b);
      if (!seg) { d[i] = 0.0005 * Math.sin(i); continue; }
      const hz = seg[2] * (1 + 0.006 * Math.sin(2 * Math.PI * 5 * t));
      ph += (2 * Math.PI * hz) / RATE;
      d[i] = 0.02 * (Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph));
    }
    const notes = alignToStart(analyseMelody(d, RATE, 120));
    expect(notes.map((n) => n.pitch)).toEqual([57, 59, 55]);
  });

  it("classifies a low thump as kick and noise burst as hat", () => {
    const d = new Float32Array(RATE);
    const stepSamples = Math.round(RATE * 0.125); // 1/16 at 120 BPM
    for (let i = 0; i < 4000; i++) d[i] = Math.sin((2 * Math.PI * 60 * i) / RATE) * Math.exp(-i / 2000);
    const s = stepSamples * 4;
    for (let i = 0; i < 3000; i++) d[s + i] = (Math.random() * 2 - 1) * 0.8 * Math.exp(-i / 800);
    const hits = analyseBeatbox(d, RATE, 120);
    expect(hits.map((h) => h.kind)).toEqual(["kick", "hat"]);
    expect(hits[1]!.step - hits[0]!.step).toBe(4);
  });
});
