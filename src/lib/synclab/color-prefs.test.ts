import { describe, expect, it } from "vitest";
import { COLOR_PREFS_DEFAULTS, inkFor, sanitizeColorPrefs } from "./color-prefs";

describe("colour preferences", () => {
  it("track menus take the track colour unless turned off", () => {
    expect(sanitizeColorPrefs({}).menuTrackTint).toBe(true);
    expect(sanitizeColorPrefs({ menuTrackTint: false }).menuTrackTint).toBe(false);
  });

  it("custom menu colours stay off until chosen, and the logo keeps its original look", () => {
    const p = sanitizeColorPrefs(undefined);
    expect(p.menuCustom).toBe(false);
    expect(p.logoMode).toBe("original");
    expect(p.logoStrength).toBe(0.06);
  });

  it("rejects broken colours and clamps logo brightness", () => {
    const p = sanitizeColorPrefs({
      menuBg: "red; display:none",
      logoColor: "#FF0000",
      logoStrength: 5,
    });
    expect(p.menuBg).toBe(COLOR_PREFS_DEFAULTS.menuBg);
    expect(p.logoColor).toBe("#ff0000");
    expect(p.logoStrength).toBe(0.6);
    expect(sanitizeColorPrefs({ logoStrength: -1 }).logoStrength).toBe(0.02);
  });

  it("picks readable text for the highlight colour", () => {
    expect(inkFor("#ffff00")).toBe("#000000");
    expect(inkFor("#1a1a40")).toBe("#ffffff");
  });
});
