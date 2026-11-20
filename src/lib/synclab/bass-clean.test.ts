import { describe, expect, it } from "vitest";
import { cleanBassPatch } from "./bass-gen";
import { applyPreset } from "./presets";

describe("Bass Generator clean sound", () => {
  it("skips the voice saturation stage and removes drive/distortion", () => {
    const p = cleanBassPatch(applyPreset("Reese Bass"));
    expect(p.clean).toBe(true);
    expect(p.fx.distortion).toBe(0);
    expect(p.fx.saturation).toBe(0);
    expect(p.drive).toBe(0);
    expect(p.unison.voices).toBe(1);
  });
  it("Sub Bass sounds at the written note, not two octaves below it", () => {
    const p = cleanBassPatch(applyPreset("Sub Bass"));
    const on = p.oscillators.filter((o) => o.on);
    expect(Math.min(...on.map((o) => o.octave))).toBe(0);
  });
});
