import { describe, expect, it } from "vitest";
import { sidewaysSliderValue } from "./sideways-slider";

// A vertical fader laid out 32px wide, 200px tall at layout (100, 50) on a 360px-wide
// upright phone appears on screen rotated: x 110..310, y 100..132.
const W = 360;
const fader = { left: W - 250, right: W - 50, top: 100, bottom: 132 };
const base = { rect: fader, screenWidth: W, min: 0, max: 1.2, step: 0.01, vertical: true };

describe("sideways phone sliders follow the finger", () => {
  it("finger at the top of a vertical fader gives the maximum", () => {
    // layout top edge y=50 -> screen x = 360 - 50 = 310
    expect(sidewaysSliderValue({ ...base, clientX: 310, clientY: 116 })).toBe(1.2);
  });
  it("finger at the bottom gives the minimum, so a silent fader can be raised from there", () => {
    expect(sidewaysSliderValue({ ...base, clientX: 110, clientY: 116 })).toBe(0);
    // moving the finger toward the screen's right edge raises the fader
    expect(sidewaysSliderValue({ ...base, clientX: 210, clientY: 116 })).toBe(0.6);
  });
  it("horizontal sliders run along the screen's vertical axis", () => {
    // layout box x 100..300, y 50..70 -> screen x 290..310, y 100..300
    const rect = { left: 290, right: 310, top: 100, bottom: 300 };
    const h = { rect, screenWidth: W, min: -1, max: 1, step: 0.01, vertical: false };
    expect(sidewaysSliderValue({ ...h, clientX: 300, clientY: 100 })).toBe(-1);
    expect(sidewaysSliderValue({ ...h, clientX: 300, clientY: 200 })).toBe(0);
    expect(sidewaysSliderValue({ ...h, clientX: 300, clientY: 300 })).toBe(1);
  });
});
