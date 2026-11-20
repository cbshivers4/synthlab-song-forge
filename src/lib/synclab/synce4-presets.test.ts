import { describe, expect, it } from "vitest";
import { applyPreset, SYNTH_PRESETS } from "./presets";

describe("SYNCE 4 strings and stabs", () => {
  const added = SYNTH_PRESETS.filter((p) => p.name.startsWith("SYNCE 4 "));

  it("provides playable, distinct strings and stabs in the general synth library", () => {
    expect(added.filter((p) => p.category === "Strings")).toHaveLength(6);
    expect(added.filter((p) => p.category === "Stabs")).toHaveLength(6);
    const sounds = added.map((def) => {
      const patch = applyPreset(def.name);
      expect(patch.voiceMode).toBe("poly");
      expect(patch.modular).toBeUndefined();
      expect(patch.oscillators.some((o) => o.on && o.level > 0)).toBe(true);
      expect(patch.amp.attack).toBeGreaterThan(0);
      if (def.category === "Stabs") {
        expect(patch.amp.sustain).toBe(0);
        expect(patch.amp.decay).toBeLessThanOrEqual(0.32);
      }
      return JSON.stringify({ ...patch, name: "" });
    });
    expect(new Set(sounds).size).toBe(12);
  });

  it("retains existing factory sounds and creates independent patches", () => {
    const existing = applyPreset("Belleville Strings");
    expect(existing.amp.attack).toBe(0.35);
    expect(existing.fx.chorus).toBe(0.45);
    const first = applyPreset("SYNCE 4 Motor City Strings");
    first.amp.attack = 9;
    expect(applyPreset(first.name).amp.attack).toBe(0.32);
    expect(applyPreset("Detroit Stab").amp.decay).toBe(0.22);
  });
});
