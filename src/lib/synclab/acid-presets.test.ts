import { describe, expect, it } from "vitest";
import { applyPreset, SYNTH_PRESETS } from "./presets";

describe("Acid Bass electro and techno voices", () => {
  const electro = SYNTH_PRESETS.filter((p) => p.name.startsWith("TD-3 Electro "));
  const techno = SYNTH_PRESETS.filter((p) => p.name.startsWith("TD-3 Techno "));

  it("adds both genre banks without replacing existing acid voices", () => {
    expect(electro).toHaveLength(8);
    expect(techno).toHaveLength(8);
    expect(SYNTH_PRESETS.some((p) => p.name === "TD-3 Acid Saw")).toBe(true);
  });

  it("keeps every new voice in Acid Bass with distinct playable patch settings", () => {
    const voices = [...electro, ...techno];
    const signatures = voices.map((def) => {
      expect(def.category).toBe("Acid Bass");
      const patch = applyPreset(def.name);
      expect(patch.oscillators.filter((o) => o.on)).toHaveLength(1);
      expect(patch.unison.voices).toBe(1);
      expect(["mono", "legato"]).toContain(patch.voiceMode);
      expect(patch.amp.attack).toBeGreaterThan(0);
      expect(patch.filterEnv.amount).toBeGreaterThan(0);
      return JSON.stringify({ ...patch, name: "" });
    });
    expect(new Set(signatures).size).toBe(16);
    expect(applyPreset("TD-3 Electro Sub Glide").oscillators[0]?.octave).toBe(-2);
    expect(applyPreset("TD-3 Techno Industrial Grind").fx.distortion).toBe(0.5);
  });
});
