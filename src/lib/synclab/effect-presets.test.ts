import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS, instantiate } from "./plugins";
import { currentEffectPreset, effectPresets, effectPresetParams } from "./effect-presets";

describe("effect-specific preset recall", () => {
  for (const definition of BUILT_IN_PLUGINS) {
    it(`${definition.name} recalls only its own complete, in-range presets`, () => {
      const plugin = instantiate(definition);
      const presets = effectPresets(plugin);
      expect(presets).toHaveLength(15);
      expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
      expect(new Set(presets.map((p) => JSON.stringify(p.values))).size).toBe(presets.length);
      for (const preset of presets) {
        const params = effectPresetParams(plugin, preset.id);
        expect(params).toBeDefined();
        expect(params?.map((p) => p.id)).toEqual(plugin.params.map((p) => p.id));
        for (const param of params ?? []) {
          expect(preset.values[param.id]).toBe(param.value);
          expect(param.value).toBeGreaterThanOrEqual(param.min);
          expect(param.value).toBeLessThanOrEqual(param.max);
        }
        const recalled = JSON.parse(JSON.stringify({ ...plugin, params }));
        expect(currentEffectPreset(recalled)?.id).toBe(preset.id);
      }
    });
  }
  it("does not show reverb presets on a delay", () => {
    const definition = BUILT_IN_PLUGINS.find((p) => p.name === "Stereo Delay");
    if (!definition) throw new Error("Stereo Delay is missing");
    const delay = instantiate(definition);
    expect(effectPresetParams(delay, "reverb:Large Hall:3")).toBeUndefined();
    expect(effectPresets(delay).some((p) => p.name === "Large Hall")).toBe(false);
  });
  it("tape echo and stereo delay have distinct presets", () => {
    expect(effectPresets({ kind: "delay", name: "Tape Echo" }).map((p) => p.name)).not.toEqual(
      effectPresets({ kind: "delay", name: "Stereo Delay" }).map((p) => p.name),
    );
  });
  it("retains the original preset IDs and values when expanding the library", () => {
    const delay = { kind: "delay" as const, name: "Stereo Delay" };
    expect(
      effectPresets(delay)
        .slice(0, 5)
        .map((p) => p.id),
    ).toEqual([
      "delay:Default:0",
      "delay:Vocal Slap:1",
      "delay:Wide Echo:2",
      "delay:Dub Repeats:3",
      "delay:Short Rhythm:4",
    ]);
    expect(effectPresets(delay)[1]?.values).toMatchObject({
      time: 95,
      feedback: 0.12,
      mix: 0.18,
      tone: 6500,
    });
  });
  it("manual edits are Custom and Default restores the original controls", () => {
    const definition = BUILT_IN_PLUGINS.find((p) => p.kind === "eq");
    if (!definition) throw new Error("Channel EQ is missing");
    const plugin = instantiate(definition);
    const edited = {
      ...plugin,
      params: plugin.params.map((p) => ({ ...p, value: p.id === "low" ? 1.23 : p.value })),
    };
    expect(currentEffectPreset(edited)).toBeUndefined();
    const preset = effectPresets(plugin).find((p) => p.name === "Default");
    if (!preset) throw new Error("Default preset is missing");
    expect(effectPresetParams(edited, preset.id)).toEqual(plugin.params);
  });
});
