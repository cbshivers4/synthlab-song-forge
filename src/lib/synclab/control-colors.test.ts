import { describe, expect, it } from "vitest";
import {
  controlColorCss,
  effectiveColors,
  sanitizeControlColors,
} from "./control-colors";

describe("knob, slider and front-panel colours", () => {
  it("keeps only valid colours on known parts and devices", () => {
    const p = sanitizeControlColors({
      all: { ring: "#FF0000", body: "red", nope: "#00ff00" },
      devices: { drums: { face: "#112233" }, unknown: { ring: "#000000" }, mixer: {} },
    });
    expect(p).toEqual({ all: { ring: "#ff0000" }, devices: { drums: { face: "#112233" } } });
  });
  it("a device's own colour wins over the all-devices colour, other parts inherit", () => {
    const p = sanitizeControlColors({
      all: { ring: "#ff0000", slider: "#00ff00" },
      devices: { drums: { ring: "#0000ff" } },
    });
    expect(effectiveColors(p, "drums")).toEqual({ ring: "#0000ff", slider: "#00ff00" });
    expect(effectiveColors(p, "mixer")).toEqual({ ring: "#ff0000", slider: "#00ff00" });
  });
  it("device rules come after the all-devices rules so they win", () => {
    const css = controlColorCss(
      sanitizeControlColors({ all: { ring: "#ff0000" }, devices: { drums: { ring: "#0000ff" } } }),
    );
    expect(css.indexOf("#ff0000")).toBeLessThan(css.indexOf("#0000ff"));
    expect(css).toContain(":where(.drum-hardware) .hardware-knob { --knob-accent: #0000ff");
  });
  it("nothing chosen leaves every device's built-in look", () => {
    expect(controlColorCss({ all: {}, devices: {} })).toBe("");
  });
  it("a light front panel switches device text to dark", () => {
    const css = controlColorCss(sanitizeControlColors({ all: { face: "#f0f0f0" } }));
    expect(css).toContain("--foreground: #000000");
  });
});
