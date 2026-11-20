import { describe, expect, it } from "vitest";
import {
  angleDelta,
  armFraction,
  beatPhase,
  crossfade,
  djSilenceReason,
  DEG_PER_SEC,
  scrubBoost,
  scrubTo,
  scratchRate,
  detectBpm,
  eqDb,
  filterFor,
  phaseShift,
  phonesBlend,
  phonesRoute,
  snapToBeat,
  speedFactor,
  syncRate,
  wavFromPcm16,
} from "./dj";

function clickTrack(bpm: number, seconds: number, sr = 22050, offset = 0.1) {
  const out = new Float32Array(Math.floor(seconds * sr));
  const beat = 60 / bpm;
  for (let t = offset; t < seconds; t += beat) {
    const at = Math.floor(t * sr);
    for (let i = 0; i < 2000 && at + i < out.length; i++)
      out[at + i] = Math.sin((2 * Math.PI * 60 * i) / sr) * Math.exp(-i / 400);
  }
  return out;
}

describe("DJ tempo detection", () => {
  it.each([90, 124, 128, 140, 174])("finds %i BPM on a kick pattern", (bpm) => {
    const r = detectBpm(clickTrack(bpm, 20), 22050);
    // 174 folds to 87 for half-time; either reading lines up a mix
    const ok =
      Math.abs(r.bpm - bpm) < 1.2 ||
      Math.abs(r.bpm * 2 - bpm) < 1.5 ||
      Math.abs(r.bpm / 2 - bpm) < 1.5;
    expect(ok, `${r.bpm}`).toBe(true);
  });

  it("finds the first beat", () => {
    const r = detectBpm(clickTrack(120, 20, 22050, 0.25), 22050);
    const ph = beatPhase(0.25, r.firstBeat, 120);
    expect(Math.min(ph, 1 - ph)).toBeLessThan(0.05);
  });
});

describe("DJ sync and mixing maths", () => {
  it("matches tempo within the pitch range", () => {
    expect(syncRate(120, 126)).toBeCloseTo(1.05, 3);
    expect(syncRate(126, 63)).toBeCloseTo(1, 3); // half-time counts as the same tempo
    expect(syncRate(100, 140, 0.08)).toBe(1.08);
  });

  it("lines up beats with the smallest move", () => {
    const shift = phaseShift(10.1, 0, 120, 0);
    expect(shift).toBeCloseTo(-0.1, 3);
    expect(snapToBeat(10.3, 0, 120)).toBeCloseTo(10, 6);
  });

  it("crossfader keeps equal power and fully cuts each side", () => {
    const [a, b] = crossfade(0);
    expect(a * a + b * b).toBeCloseTo(1, 6);
    expect(crossfade(-1)[1]).toBeCloseTo(0, 6);
    expect(crossfade(1)[0]).toBeCloseTo(0, 6);
  });

  it("EQ knobs: centre is flat, bottom kills, top boosts 6 dB", () => {
    expect(eqDb(0.5)).toBe(0);
    expect(eqDb(0)).toBe(-40);
    expect(eqDb(1)).toBe(6);
    expect(filterFor(0.5).type).toBe("off");
    expect(filterFor(0.2).type).toBe("lowpass");
    expect(filterFor(0.8).type).toBe("highpass");
  });

  it("writes a valid 16-bit stereo WAV from recorded slices", async () => {
    const blob = wavFromPcm16([new Int16Array([1, 2, 3, 4]), new Int16Array([5, 6])], 48000);
    expect(blob.size).toBe(44 + 6 * 2);
    const v = new DataView(await blob.arrayBuffer());
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(22, true)).toBe(2);
  });
});

describe("DJ headphone cue", () => {
  it("MIXING fully left is only the cued decks, fully right only the master", () => {
    const [c0, m0] = phonesBlend(0);
    expect(c0).toBeCloseTo(1);
    expect(m0).toBeCloseTo(0);
    const [c1, m1] = phonesBlend(1);
    expect(c1).toBeCloseTo(0);
    expect(m1).toBeCloseTo(1);
  });
  it("MIXING in the middle keeps both at equal power", () => {
    const [c, m] = phonesBlend(0.5);
    expect(c).toBeCloseTo(Math.SQRT1_2);
    expect(m).toBeCloseTo(Math.SQRT1_2);
  });
  it("a second output is only used when the browser can pick one and one is chosen", () => {
    expect(phonesRoute("device", true, "usb-phones")).toBe("device");
    expect(phonesRoute("device", false, "usb-phones")).toBe("off");
    expect(phonesRoute("device", true, null)).toBe("off");
    expect(phonesRoute("split", false, null)).toBe("split");
  });
});

describe("DJ turntable speed", () => {
  it("45 RPM plays 1.35x faster than 33", () => {
    expect(speedFactor(33)).toBe(1);
    expect(speedFactor(45)).toBeCloseTo(1.35);
  });
});

describe("back to the start: grabbing the record and the waveform", () => {
  it("crosses the ±180° seam without jumping", () => {
    expect(angleDelta(170, -170)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(-20);
    expect(angleDelta(10, 40)).toBe(30);
  });
  it("one turn of the record is 1.8 seconds of track at 33⅓", () => {
    expect(360 / DEG_PER_SEC).toBeCloseTo(1.8, 5);
  });
  it("slow moves follow the finger exactly", () => {
    expect(scrubBoost(1)).toBe(1);
    expect(scrubTo(30, -0.5, 0.5, 200)).toBeCloseTo(29.5, 6);
  });
  it("fast flicks travel further, capped at 12×", () => {
    expect(scrubBoost(30)).toBe(10);
    expect(scrubBoost(1000)).toBe(12);
    expect(scrubTo(60, -2, 0.02, 200)).toBeCloseTo(36, 6);
  });
  it("winding back never goes before the beginning or past the end", () => {
    expect(scrubTo(5, -20, 0.01, 200)).toBe(0);
    expect(scrubTo(195, 20, 0.01, 200)).toBeCloseTo(199.99, 6);
  });
});

describe("tone arm and scratching", () => {
  // desktop plinth: arm rests at 31° over the outer edge and swings 22° to the label
  it("arm over the outer edge is the start, over the label is the end, halfway is the middle", () => {
    expect(armFraction(90 + 31, 31, 22)).toBe(0);
    expect(armFraction(90 + 53, 31, 22)).toBe(1);
    expect(armFraction(90 + 42, 31, 22)).toBeCloseTo(0.5, 6);
  });
  it("swinging the arm off the record clamps to the start or the end", () => {
    expect(armFraction(90, 31, 22)).toBe(0);
    expect(armFraction(180, 31, 22)).toBe(1);
  });
  it("record held still is silent; scratch speed follows the hand in either direction, capped at 4x", () => {
    expect(scratchRate(0)).toBe(0);
    expect(scratchRate(0.01)).toBe(0);
    expect(scratchRate(1)).toBe(1);
    expect(scratchRate(-0.5)).toBe(0.5);
    expect(scratchRate(-30)).toBe(4);
  });
});

describe("why a playing deck is silent", () => {
  const ok = {
    deck: "A" as const,
    gain: 1,
    fader: 0.85,
    filter: 0.5,
    eq: { high: 0.5, mid: 0.5, low: 0.5 },
    crossfader: 0,
    master: 0.9,
  };
  it("default controls let the sound through", () => {
    expect(djSilenceReason(ok)).toBeNull();
  });
  it("names the GAIN knob when it is all the way down", () => {
    expect(djSilenceReason({ ...ok, gain: 0 })).toMatch(/GAIN/);
  });
  it("names the volume fader when it is all the way down", () => {
    expect(djSilenceReason({ ...ok, fader: 0 })).toMatch(/volume fader/);
  });
  it("crossfader fully on B silences deck A but not deck B", () => {
    expect(djSilenceReason({ ...ok, crossfader: 1 })).toMatch(/crossfader.*deck B/);
    expect(djSilenceReason({ ...ok, deck: "B", crossfader: 1 })).toBeNull();
  });
  it("names MASTER, all-killed EQ and a fully turned filter", () => {
    expect(djSilenceReason({ ...ok, master: 0 })).toMatch(/MASTER/);
    expect(djSilenceReason({ ...ok, eq: { high: 0, mid: 0, low: 0 } })).toMatch(/EQ/);
    expect(djSilenceReason({ ...ok, filter: 0 })).toMatch(/FILT/);
    expect(djSilenceReason({ ...ok, filter: 0.3 })).toBeNull();
  });
});
