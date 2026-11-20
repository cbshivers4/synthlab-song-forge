import { describe, expect, it } from "vitest";
import { SYNTH_PRESETS, applyPreset, DRUM_KITS } from "./presets";
import { DRUM_KIT_VOICES } from "./audio-engine";
import { effectPresets } from "./effect-presets";
import { PARAMS_BY_KIND } from "./plugins";
import type { PluginKind } from "./types";

describe("presets sound different", () => {
  it("synth preset names are unique so every preset can load", () => {
    const names = SYNTH_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("no two synth presets have identical settings", () => {
    const sig = (n: string) =>
      JSON.stringify(applyPreset(n), (k, v) => (k === "name" || k === "id" ? undefined : v));
    const sigs = SYNTH_PRESETS.map((p) => sig(p.name));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
  it("every drum kit has its own voice", () => {
    const sigs = DRUM_KITS.map((k) => JSON.stringify(DRUM_KIT_VOICES[k.id]));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
  it("no two presets of an effect have identical settings", () => {
    for (const kind of Object.keys(PARAMS_BY_KIND) as PluginKind[]) {
      for (const name of ["Effect", "Tape Echo"]) {
        const params = PARAMS_BY_KIND[kind]();
        const sigs = effectPresets({ kind, name }).map((p) =>
          JSON.stringify(
            params.map((q) =>
              Math.round(Math.max(q.min, Math.min(q.max, p.values[q.id] ?? q.value)) * 1000),
            ),
          ),
        );
        expect(new Set(sigs).size, `${kind} ${name}`).toBe(sigs.length);
      }
    }
  });
});
