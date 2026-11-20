import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS } from "./plugins";
import { effectCategory } from "./effect-catalog";
import { effectPresets } from "./effect-presets";
import { OPEN_AIR_SPACES, STUDIO_DEVICES, openAirImpulse, studioChoice } from "./studio-fx";

const REQUESTED = [
  "Auto Filter",
  "Analog Delay",
  "Channel Strip",
  "Chorus",
  "De-Esser",
  "Expander",
  "Flanger",
  "Multiband Dynamics",
  "Mustang Native",
  "Phaser",
  "Splitter",
  "Vocal Tune",
  "Voice FX",
  "VU Meter",
  "Tuner",
  "Tone Generator",
  "Open Air",
];

describe("studio effects pack", () => {
  it("adds every requested device to the effect menus", () => {
    const names = BUILT_IN_PLUGINS.map((d) => d.name);
    for (const n of REQUESTED) expect(names).toContain(n);
    expect(STUDIO_DEVICES).toHaveLength(17);
  });
  it("files devices where you would look for them", () => {
    const kind = (n: string) => BUILT_IN_PLUGINS.find((d) => d.name === n)!.kind;
    expect(effectCategory(kind("Vocal Tune"))).toBe("Pitch & Voice");
    expect(effectCategory(kind("De-Esser"))).toBe("Dynamics");
    expect(effectCategory(kind("Mustang Native"))).toBe("Amps & Pedals");
    expect(effectCategory(kind("Open Air"))).toBe("Delay & Reverb");
    expect(effectCategory(kind("Tuner"))).toBe("Utility");
  });
  it("gives each new device 15 presets with different settings", () => {
    for (const n of REQUESTED) {
      const def = BUILT_IN_PLUGINS.find((d) => d.name === n)!;
      const list = effectPresets({ kind: def.kind, name: def.name });
      expect(list).toHaveLength(15);
      expect(new Set(list.map((p) => JSON.stringify(p.values))).size).toBe(15);
    }
  });
  it("names mode knobs instead of showing numbers", () => {
    expect(studioChoice("vocaltune", "key", 9)).toBe("A");
    expect(studioChoice("vocaltune", "scale", 2)).toBe("Minor");
    expect(studioChoice("mustang", "model", 6)).toBe("Metal 2000");
    expect(studioChoice("openair", "space", 6)).toBe("Cathedral");
    expect(studioChoice("autofilter", "cutoff", 1)).toBeUndefined();
  });
  it("Open Air spaces have different real decay lengths", () => {
    const fake = {
      sampleRate: 8000,
      createBuffer: (ch: number, len: number, sr: number) => {
        const data = Array.from({ length: ch }, () => new Float32Array(len));
        return { length: len, sampleRate: sr, getChannelData: (i: number) => data[i]! };
      },
    } as unknown as BaseAudioContext;
    const booth = openAirImpulse(fake, OPEN_AIR_SPACES.indexOf("Vocal Booth"), 1, 0.4).tail;
    const cathedral = openAirImpulse(fake, OPEN_AIR_SPACES.indexOf("Cathedral"), 1, 0.4).tail;
    expect(cathedral.length).toBeGreaterThan(booth.length * 10);
    const tail = cathedral.getChannelData(0);
    const energy = (a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; i++) s += tail[i]! ** 2;
      return s;
    };
    expect(energy(0, 4000)).toBeGreaterThan(energy(tail.length - 4000, tail.length) * 50);
  });
});
