import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS } from "./plugins";
import { resonatorQ } from "./audio-engine";

const ids = (name: string) => BUILT_IN_PLUGINS.find(p => p.name === name)?.params.map(p => p.id) ?? [];

describe("effects that share a sound engine still differ", () => {
  it("Tape Echo has tape heads, wow and saturation; Stereo Delay bounces left/right instead", () => {
    expect(ids("Tape Echo")).toEqual(expect.arrayContaining(["heads", "wow", "saturation"]));
    expect(ids("Tape Echo")).not.toContain("pingpong");
    expect(ids("Stereo Delay")).toContain("pingpong");
    expect(ids("Stereo Delay")).not.toContain("wow");
  });
  it("Stereo Imager has Stereoize, which Stereo Width does not", () => {
    expect(ids("Stereo Imager")).toContain("stereoize");
    expect(ids("Stereo Width")).not.toContain("stereoize");
  });
  it("Harmonic Body rings longer when Decay is longer", () => {
    expect(resonatorQ(196, 4)).toBeGreaterThan(resonatorQ(196, 1));
  });
});
