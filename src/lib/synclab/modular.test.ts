import { describe, expect, it } from "vitest";
import { MODULE_DEFS, MODULAR_PRESETS, newModule, normalizeModular, type ModuleType } from "./modular";

const added: ModuleType[] = ["sub", "formant", "phaser", "compressor", "stereo", "attenuverter"];
describe("expanded modular devices", () => {
  it.each(added)("creates and retains %s controls in saved patches", (type) => {
    const module = newModule(type);
    for (const param of MODULE_DEFS[type].params) expect(module.params[param.id]).toBe(param.def);
    expect(MODULE_DEFS[type].outputs).toEqual([{ id: "out", label: type === "attenuverter" ? "CV OUT" : "OUT" }]);
    const patch = { version: 2, modules: [module], cables: [] };
    expect(normalizeModular(JSON.parse(JSON.stringify(patch)))).toEqual(patch);
  });
  it("keeps all demo cables connected to declared real ports", () => {
    for (const preset of MODULAR_PRESETS) for (const cable of preset.modular.cables) {
      const from = preset.modular.modules.find(m => m.id === cable.from.module);
      const to = preset.modular.modules.find(m => m.id === cable.to.module);
      expect(from).toBeDefined(); expect(to).toBeDefined();
      if (!from || !to) throw new Error("Missing module");
      expect(MODULE_DEFS[from.type].outputs.some(p => p.id === cable.from.port)).toBe(true);
      expect(MODULE_DEFS[to.type].inputs.some(p => p.id === cable.to.port)).toBe(true);
    }
  });
});