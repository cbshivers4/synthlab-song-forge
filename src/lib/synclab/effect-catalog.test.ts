import { describe, expect, it } from "vitest";
import { availableEffects, groupByCategory, EFFECT_CATEGORIES } from "./effect-catalog";
import { BUILT_IN_PLUGINS } from "./plugins";

describe("complete hardware effect catalog", () => {
  it("includes every factory effect when opening an older or empty installed list", () => {
    const list = availableEffects(BUILT_IN_PLUGINS.slice(0, 2));
    expect(list.map(def => def.id)).toEqual(BUILT_IN_PLUGINS.map(def => def.id));
    expect(availableEffects([]).some(def => def.kind === "distmatrix")).toBe(true);
    expect(availableEffects([]).some(def => def.kind === "pitchvoice")).toBe(true);
  });
  it("retains custom devices without duplicating factory definitions", () => {
    const factory = BUILT_IN_PLUGINS[0];
    if (!factory) throw new Error("Factory catalog is empty");
    const custom = { ...factory, id: "custom-effect", name: "Custom effect" };
    const list = availableEffects([factory, custom]);
    expect(list.filter(def => def.id === factory.id)).toHaveLength(1);
    expect(list.find(def => def.id === custom.id)).toEqual(custom);
  });
  it("places every factory device in exactly one of the nine categories", () => {
    const groups = groupByCategory(availableEffects([]));
    expect(groups.map(([category]) => category)).toEqual([...EFFECT_CATEGORIES]);
    expect(groups.flatMap(([, defs]) => defs).map(def => def.id).sort()).toEqual(BUILT_IN_PLUGINS.map(def => def.id).sort());
  });
});