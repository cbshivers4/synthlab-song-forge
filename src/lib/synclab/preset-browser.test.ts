import { describe, expect, it } from "vitest";
import { SYNTH_PRESETS } from "./presets";
import { GRANULAR_PRESETS, GRANULAR_PRESET_TYPES } from "./granular";
import { classifyPreset, presetBrowserIndex, presetMatchesSynth } from "./preset-categories";

const indexFor = (style: string) => presetBrowserIndex(SYNTH_PRESETS.filter((p) => presetMatchesSynth(p.category, style)), [], GRANULAR_PRESET_TYPES);
const typeOf = (style: string, name: string) => indexFor(style).types.find((g) => g.items.includes(name))?.label;

describe("synth preset browser categories", () => {
  it("puts every preset of every synth into exactly one sound type", () => {
    for (const style of ["spec4", "acid", "poly", "modular", "granular"]) {
      const names = [...new Set(SYNTH_PRESETS.filter((p) => presetMatchesSynth(p.category, style)).map((p) => p.name))];
      const listed = indexFor(style).types.flatMap((g) => g.items);
      expect(listed.length).toBe(names.length);
      expect(new Set(listed)).toEqual(new Set(names));
    }
  });

  it("sorts genre-group presets by sound and keeps the genre as a style", () => {
    expect(classifyPreset({ name: "Cybotron Lead", category: "Detroit Electro" })).toEqual({ type: "Lead", style: "Detroit Electro" });
    expect(classifyPreset({ name: "Trap Bell", category: "Trap" })).toEqual({ type: "Bell", style: "Trap" });
    expect(classifyPreset({ name: "Hoover Rave", category: "Rave" })).toEqual({ type: "Lead", style: "Rave" });
    expect(classifyPreset({ name: "Juan's Strings", category: "Detroit Classics" })).toEqual({ type: "Strings", style: "Detroit Classics" });
    expect(indexFor("spec4").styles.map((g) => g.label)).toContain("Detroit Techno");
  });

  it("merges duplicate old group names into one type", () => {
    const labels = indexFor("spec4").types.map((g) => g.label);
    expect(labels).toContain("Pluck");
    expect(labels).not.toContain("Plucks");
    expect(labels).not.toContain("Bells");
    expect(labels).not.toContain("Detroit Techno");
  });

  it("splits Acid Bass into Acid Bass and Clean Bass, with Electro and Techno styles", () => {
    const acid = indexFor("acid");
    expect(acid.types.map((g) => g.label)).toEqual(["Acid Bass", "Clean Bass"]);
    expect(acid.styles.map((g) => g.label)).toEqual(["Electro", "Techno"]);
  });

  it("gives every grain preset its own sound type", () => {
    for (const p of GRANULAR_PRESETS) expect(GRANULAR_PRESET_TYPES[p.name], p.name).toBeTruthy();
    expect(typeOf("granular", "Granular Ghost Choir")).toBe("Choir");
    expect(typeOf("granular", "Granular Deep Drone")).toBe("Drone");
    expect(indexFor("granular").types.length).toBeGreaterThanOrEqual(6);
  });

  it("sorts Modular Tech patches by sound", () => {
    expect(typeOf("modular", "Modular Tech Wobble Bass")).toBe("Bass");
    expect(typeOf("modular", "Modular Tech Empty Rack")).toBe("Template");
    expect(typeOf("modular", "Modular Tech Kick")).toBe("Percussive");
  });

  it("lists My Presets last in the arrow order", () => {
    const idx = presetBrowserIndex([{ name: "Poly Synth Brass", category: "Poly Synth · Brass" }], ["My Lead"]);
    expect(idx.order).toEqual(["Poly Synth Brass", "My Lead"]);
    expect(idx.mine).toEqual(["My Lead"]);
  });
});
