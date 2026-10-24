import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS, instantiate } from "./plugins";
import { currentEffectPreset, effectPresets, effectPresetParams } from "./effect-presets";

describe("effect-specific preset recall", () => {
  for (const definition of BUILT_IN_PLUGINS) {
    it(`${definition.name} recalls only its own complete, in-range presets`, () => {
      const plugin = instantiate(definition);
      const presets = effectPresets(plugin);
      expect(presets.length).toBeGreaterThanOrEqual(5);
      for (const preset of presets) {
        const params = effectPresetParams(plugin, preset.id);
        expect(params).toBeDefined();
        expect(params?.map(p => p.id)).toEqual(plugin.params.map(p => p.id));
        for (const param of params ?? []) {
          expect(param.value).toBeGreaterThanOrEqual(param.min);
          expect(param.value).toBeLessThanOrEqual(param.max);
        }
        const recalled = JSON.parse(JSON.stringify({ ...plugin, params }));
        expect(currentEffectPreset(recalled)?.id).toBe(preset.id);
      }
    });
  }
  it("does not show reverb presets on a delay", () => {
    const definition = BUILT_IN_PLUGINS.find(p => p.name === "Stereo Delay");
    if (!definition) throw new Error("Stereo Delay is missing");
    const delay = instantiate(definition);
    expect(effectPresetParams(delay, "reverb:Large Hall:3")).toBeUndefined();
    expect(effectPresets(delay).some(p => p.name === "Large Hall")).toBe(false);
  });
  it("tape echo and stereo delay have distinct presets", () => {
    expect(effectPresets({ kind: "delay", name: "Tape Echo" }).map(p => p.name)).not.toEqual(effectPresets({ kind: "delay", name: "Stereo Delay" }).map(p => p.name));
  });
  it("manual edits are Custom and Default restores the original controls", () => {
    const definition = BUILT_IN_PLUGINS.find(p => p.kind === "eq");
    if (!definition) throw new Error("Channel EQ is missing");
    const plugin = instantiate(definition);
    const edited = { ...plugin, params: plugin.params.map(p => ({ ...p, value: p.id === "low" ? 1.23 : p.value })) };
    expect(currentEffectPreset(edited)).toBeUndefined();
    const preset = effectPresets(plugin).find(p => p.name === "Default");
    if (!preset) throw new Error("Default preset is missing");
    expect(effectPresetParams(edited, preset.id)).toEqual(plugin.params);
  });
});