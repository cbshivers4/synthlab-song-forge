import { describe, expect, it } from "vitest";
import { applyPreset, SYNTH_PRESETS } from "./presets";
import { STANDARD_CATEGORIES } from "./preset-library";
import { orderPresetGroups, presetCategoryLabel, presetMatchesSynth } from "./preset-categories";

const menu = (style: string) => SYNTH_PRESETS.filter((p) => presetMatchesSynth(p.category, style));

describe("synth preset categories", () => {
  for (const style of ["spec4", "poly"]) {
    it(`${style} lists at least 5 presets in every standard category`, () => {
      const list = menu(style);
      for (const cat of STANDARD_CATEGORIES) {
        expect(list.filter((p) => presetCategoryLabel(p.category) === cat).length, `${style} ${cat}`).toBeGreaterThanOrEqual(5);
      }
    });
  }
  it("Poly Synth presets only show in the Poly Synth menu", () => {
    const poly = menu("poly");
    expect(poly.length).toBeGreaterThan(90);
    expect(poly.every((p) => !menu("spec4").includes(p) && !menu("acid").includes(p))).toBe(true);
    expect(presetCategoryLabel("Poly Synth · Woodwind")).toBe("Woodwind");
  });
  it("every Poly Synth preset name starts with Poly so the channel opens as a Poly Synth", () => {
    expect(menu("poly").every((p) => p.name.startsWith("Poly "))).toBe(true);
  });
  it("menu groups follow the standard order with My Presets last", () => {
    const order = orderPresetGroups([{ category: "My Presets" }, { category: "Detroit Techno" }, { category: "Woodwind" }, { category: "Arpeggio" }]);
    expect(order.map((g) => g.category)).toEqual(["Arpeggio", "Woodwind", "Detroit Techno", "My Presets"]);
  });
  it("sequence and arpeggio presets run the synced arpeggiator; templates start dry", () => {
    for (const p of menu("poly").concat(menu("spec4"))) {
      const cat = presetCategoryLabel(p.category);
      if (cat !== "Arpeggio" || p.name.startsWith("Poly Arp")) continue;
      expect(applyPreset(p.name).arp.on, p.name).toBe(true);
    }
    const t = applyPreset("Template Init Saw");
    expect(t.fx.reverb + t.fx.delay + t.fx.chorus + t.fx.distortion).toBe(0);
  });
});

describe("Acid Bass clean presets", () => {
  const clean = menu("acid").filter((p) => p.name.startsWith("TD-3 Clean "));
  it("adds 12 non-distorted bass voices to the Acid Bass menu", () => {
    expect(clean).toHaveLength(12);
    for (const def of clean) {
      const p = applyPreset(def.name);
      expect(p.drive, def.name).toBe(0);
      expect(p.fx.distortion, def.name).toBe(0);
      expect(p.fx.saturation ?? 0, def.name).toBe(0);
      expect(p.fx.bitcrush, def.name).toBe(0);
      expect(p.clean, def.name).toBe(true);
      expect(p.resonance, def.name).toBeLessThanOrEqual(6);
      expect(p.oscillators.filter((o) => o.on)).toHaveLength(1);
      expect(p.unison.voices).toBe(1);
      expect(["mono", "legato"]).toContain(p.voiceMode);
    }
  });
});
