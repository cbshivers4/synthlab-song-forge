import { describe, expect, it } from "vitest";
import {
  binForFreq,
  dbToFrac,
  followedSource,
  formatFreq,
  fracToFreq,
  freqToFrac,
  openScopeWindow,
  getScopeWindow,
  scopeSourceFor,
  scopeSourceGroups,
  triggerIndex,
  MASTER_SOURCE,
} from "./scope-window";
import type { Track } from "./types";

const tracks = [
  { id: "t1", name: "Kick", plugins: [{ id: "p1", name: "Reverb", bypass: false }] },
  { id: "t2", name: "Vox", plugins: [] },
] as unknown as Track[];

describe("expanded scope window", () => {
  it("spans 20 Hz to 20 kHz on a log scale", () => {
    expect(freqToFrac(20)).toBe(0);
    expect(freqToFrac(20000)).toBeCloseTo(1);
    expect(fracToFreq(0.5)).toBeCloseTo(632.5, 0);
    expect(formatFreq(1300)).toBe("1.3 kHz");
    expect(formatFreq(80)).toBe("80 Hz");
  });

  it("shows real dBFS from 0 at the top to -96 at the bottom", () => {
    expect(dbToFrac(0)).toBe(0);
    expect(dbToFrac(-48)).toBe(0.5);
    expect(dbToFrac(-200)).toBe(1);
    expect(dbToFrac(6)).toBe(0);
  });

  it("maps frequencies to analyser bins", () => {
    expect(binForFreq(24000, 48000, 4096)).toBe(4095);
    expect(binForFreq(12000, 48000, 4096)).toBe(2048);
  });

  it("lists master, buses, returns, VCAs, channels and effects as signals", () => {
    const groups = scopeSourceGroups(tracks);
    expect(groups.map((g) => g.label)).toEqual([
      "Main",
      "Buses",
      "Returns",
      "VCAs",
      "Channels",
      "Effects",
    ]);
    expect(groups[0]!.sources[0]).toEqual(MASTER_SOURCE);
    expect(groups[5]!.sources).toEqual([{ id: "p1", label: "Kick · Reverb" }]);
  });

  it("names aux return and VCA scopes for the big window", () => {
    expect(scopeSourceFor("aux:reverb", tracks)).toEqual({
      id: "aux:reverb",
      label: "Reverb return",
    });
    expect(scopeSourceFor("vca:B", tracks)).toEqual({ id: "vca:B", label: "VCA B" });
    expect(scopeSourceFor("bus:drums", tracks).label).toBe("Drums bus");
  });

  it("names a bypassed effect scope by its effect", () => {
    expect(scopeSourceFor("bypassed:p1", tracks)).toEqual({ id: "p1", label: "Kick · Reverb" });
    expect(scopeSourceFor("ch:t2", tracks).label).toBe("Vox");
  });

  it("Follow Selection picks the selected channel, else the master", () => {
    expect(followedSource("t2", tracks)).toEqual({ id: "ch:t2", label: "Vox" });
    expect(followedSource(null, tracks)).toEqual(MASTER_SOURCE);
  });

  it("modular taps only open as a waveform", () => {
    openScopeWindow({ id: "t1:m1", label: "VCO 1", kind: "modular" }, "spectrum");
    expect(getScopeWindow().view).toBe("wave");
    expect(getScopeWindow().open).toBe(true);
  });

  it("starts the waveform on a rising zero crossing", () => {
    expect(triggerIndex([0.5, -0.2, -0.1, 0.3, 0.6, 0.2, -0.4, 0.1], 2)).toBe(3);
  });
});
