import { describe, expect, it } from "vitest";
import { defaultPatch } from "./presets";
import { voiceDriveAmount, voiceSaturate, voiceSaturationCurve, VOICE_SHAPER_IN } from "./voice-saturation";

/** How much louder quiet parts come out than loud ones (1 = untouched dynamics). */
const squash = (amount: number) => (voiceSaturate(0.1, amount) / 0.1) / (voiceSaturate(1, amount) / 1);

describe("synth voice warmth", () => {
  it("leaves the default patch's dynamics nearly untouched so presets keep their own character", () => {
    expect(squash(voiceDriveAmount(defaultPatch()))).toBeLessThan(1.25);
  });
  it("still distorts hard when DISTORTION is turned all the way up", () => {
    const p = defaultPatch();
    p.fx.distortion = 1;
    expect(squash(voiceDriveAmount(p))).toBeGreaterThan(3);
  });
  it("never hard-clips loud or resonant voices", () => {
    const amount = voiceDriveAmount(defaultPatch());
    expect(voiceSaturate(2, amount)).toBeGreaterThan(voiceSaturate(1, amount));
    const curve = voiceSaturationCurve(amount);
    expect(curve[curve.length - 1]).toBeCloseTo(voiceSaturate(1 / VOICE_SHAPER_IN, amount), 5);
  });
  it("keeps clean voices clean until a grit knob is used", () => {
    const p = defaultPatch();
    p.clean = true; p.drive = 0; p.fx.distortion = 0;
    expect(squash(voiceDriveAmount(p))).toBeCloseTo(1, 5);
  });
});
