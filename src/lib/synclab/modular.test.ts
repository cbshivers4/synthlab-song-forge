import { describe, expect, it } from "vitest";
import {
  MODULE_DEFS,
  MODULAR_PRESETS,
  newModule,
  normalizeModular,
  type ModuleType,
} from "./modular";

const added: ModuleType[] = [
  "sub",
  "formant",
  "phaser",
  "compressor",
  "stereo",
  "attenuverter",
  "seq",
  "chaos",
  "follower",
  "macro",
  "comb",
];
describe("expanded modular devices", () => {
  it.each(added)("creates and retains %s controls in saved patches", (type) => {
    const module = newModule(type);
    for (const param of MODULE_DEFS[type].params) expect(module.params[param.id]).toBe(param.def);
    expect(MODULE_DEFS[type].outputs[0]?.id).toBe("out");
    const patch = { version: 2, modules: [module], cables: [] };
    expect(normalizeModular(JSON.parse(JSON.stringify(patch)))).toEqual(patch);
  });
  it("keeps all demo cables connected to declared real ports", () => {
    for (const preset of MODULAR_PRESETS)
      for (const cable of preset.modular.cables) {
        const from = preset.modular.modules.find((m) => m.id === cable.from.module);
        const to = preset.modular.modules.find((m) => m.id === cable.to.module);
        expect(from).toBeDefined();
        expect(to).toBeDefined();
        if (!from || !to) throw new Error("Missing module");
        expect(MODULE_DEFS[from.type].outputs.some((p) => p.id === cable.from.port)).toBe(true);
        expect(MODULE_DEFS[to.type].inputs.some((p) => p.id === cable.to.port)).toBe(true);
      }
  });
  it.each(Object.keys(MODULE_DEFS) as ModuleType[])(
    "gives %s multiple functional parameters without losing edits",
    (type) => {
      const def = MODULE_DEFS[type];
      expect(def.params.length).toBeGreaterThanOrEqual(2);
      expect(new Set(def.params.map((p) => p.id)).size).toBe(def.params.length);
      const module = newModule(type);
      const param = def.params.find((p) => !p.options);
      if (!param) throw new Error("Missing adjustable parameter");
      module.params[param.id] = param.max ?? 1;
      const patch = normalizeModular(
        JSON.parse(JSON.stringify({ version: 2, modules: [module], cables: [] })),
      );
      expect(patch.modules[0]?.params[param.id]).toBe(param.max ?? 1);
    },
  );
});
describe("advanced modular racks", () => {
  it("adds 40 advanced racks with unique names", () => {
    const advanced = MODULAR_PRESETS.filter((p) =>
      /Seq |Chaos |Comb |Follower |Macro |Ring |Gate /.test(p.name),
    );
    expect(advanced).toHaveLength(40);
    expect(new Set(MODULAR_PRESETS.map((p) => p.name)).size).toBe(MODULAR_PRESETS.length);
  });
  it("gives every advanced rack its own patch", () => {
    const racks = MODULAR_PRESETS.map((p) =>
      JSON.stringify(p.modular.modules.map((m) => [m.type, m.params])),
    );
    expect(new Set(racks).size).toBe(racks.length);
  });
  it("sequencer steps are in semitones so a x1 cable into VCO PITCH plays them in tune", () => {
    expect(MODULE_DEFS.vco.inputs.find((i) => i.id === "pitch")?.scale).toBe(1200);
    const seq = MODULAR_PRESETS.find(
      (p) => p.name === "Modular Tech Seq Bass Detroit",
    )!.modular.modules.find((m) => m.type === "seq")!;
    expect([seq.params["s1"], seq.params["s3"], seq.params["s8"]]).toEqual([0, 12, 10]);
  });
});
