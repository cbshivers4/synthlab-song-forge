import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS, instantiate } from "./plugins";
import {
  FACTORY_BUS_TEMPLATES,
  allBusTemplates,
  templateFromPlugins,
  templatePlugins,
} from "./bus-templates";
import { applyVcaLink, bakeLegacyVca, dbToGain, gainToDb, type LinkMemory } from "./vca-link";
import type { BusState, Track } from "./types";

const track = (id: string, patch: Partial<Track> = {}) =>
  ({ id, name: id, volume: 1, pan: 0, vca: "A", bus: "master", plugins: [], ...patch }) as Track;
const eqDef = BUILT_IN_PLUGINS.find((d) => d.kind === "eq")!;
const makeEq = () => instantiate(eqDef);
const base: BusState = { volume: 1, muted: false };
const eqOf = (t: Track, band: string) =>
  t.plugins?.find((p) => p.kind === "eq")?.params.find((p) => p.id === band)?.value;

describe("bus templates", () => {
  it("every factory template uses real built-in effects and real knob names", () => {
    for (const t of FACTORY_BUS_TEMPLATES) {
      const plugins = templatePlugins(t, BUILT_IN_PLUGINS);
      expect(plugins.length, t.name).toBe(t.effects.length);
      t.effects.forEach((step, i) => {
        for (const id of Object.keys(step.params ?? {}))
          expect(
            plugins[i]!.params.some((p) => p.id === id),
            `${t.name} ${step.effect} ${id}`,
          ).toBe(true);
      });
    }
  });

  it("the Vocal Chain loads a de-esser, compressor, delay and reverb in order", () => {
    const vocal = FACTORY_BUS_TEMPLATES.find((t) => t.id === "vocal-chain")!;
    expect(templatePlugins(vocal, BUILT_IN_PLUGINS).map((p) => p.name)).toEqual([
      "Channel Strip",
      "De-Esser",
      "Bus Compressor",
      "Stereo Delay",
      "Hall Reverb",
    ]);
  });

  it("a saved change to a factory template replaces its effects", () => {
    const edited = { ...FACTORY_BUS_TEMPLATES[0]!, effects: [{ effect: "Hall Reverb" }] };
    const all = allBusTemplates([edited]);
    expect(all.find((t) => t.id === edited.id)!.effects).toEqual([{ effect: "Hall Reverb" }]);
    expect(all.length).toBe(FACTORY_BUS_TEMPLATES.length);
  });

  it("saving a bus as a template keeps its knob values", () => {
    const comp = instantiate(BUILT_IN_PLUGINS.find((d) => d.name === "Bus Compressor")!);
    comp.params = comp.params.map((p) => (p.id === "ratio" ? { ...p, value: 6 } : p));
    const t = templateFromPlugins({ id: "x", name: "Mine", description: "", color: "" }, [comp]);
    expect(
      templatePlugins(t, BUILT_IN_PLUGINS)[0]!.params.find((p) => p.id === "ratio")!.value,
    ).toBe(6);
  });
});

describe("VCA moves its channels' own controls", () => {
  it("pulling the VCA down 6 dB moves every member fader down 6 dB", () => {
    const tracks = [
      track("a", { volume: 1 }),
      track("b", { volume: dbToGain(-10) }),
      track("c", { vca: undefined }),
    ];
    const out = applyVcaLink(
      tracks,
      "A",
      base,
      { ...base, volume: dbToGain(-6) },
      new Map(),
      makeEq,
    );
    expect(gainToDb(out[0]!.volume)).toBeCloseTo(-6, 5);
    expect(gainToDb(out[1]!.volume)).toBeCloseTo(-16, 5);
    expect(out[2]!.volume).toBe(1);
  });

  it("VCA to the bottom and back restores the original balance", () => {
    const memory = new Map<string, LinkMemory>();
    let tracks = [track("a", { volume: 1 }), track("b", { volume: dbToGain(-12) })];
    tracks = applyVcaLink(tracks, "A", base, { ...base, volume: 0 }, memory, makeEq);
    expect(tracks.map((t) => t.volume)).toEqual([0, 0]);
    tracks = applyVcaLink(tracks, "A", { ...base, volume: 0 }, base, memory, makeEq);
    expect(gainToDb(tracks[0]!.volume)).toBeCloseTo(0, 5);
    expect(gainToDb(tracks[1]!.volume)).toBeCloseTo(-12, 5);
  });

  it("the VCA pan knob shifts member pans and stops at hard left/right", () => {
    const tracks = [track("a", { pan: 0 }), track("b", { pan: 0.8 })];
    const out = applyVcaLink(tracks, "A", base, { ...base, pan: 0.3 }, new Map(), makeEq);
    expect(out[0]!.pan).toBeCloseTo(0.3);
    expect(out[1]!.pan).toBe(1);
  });

  it("the VCA EQ knobs move each member's channel EQ, adding one where missing", () => {
    const eq = makeEq();
    eq.params = eq.params.map((p) => (p.id === "low" ? { ...p, value: 3 } : p));
    const tracks = [track("a", { plugins: [eq] }), track("b")];
    const out = applyVcaLink(tracks, "A", base, { ...base, eqLow: -4 }, new Map(), makeEq);
    expect(eqOf(out[0]!, "low")).toBe(-1);
    expect(eqOf(out[1]!, "low")).toBe(-4);
    expect(eqOf(out[1]!, "high")).toBe(0);
  });

  it("old projects keep their sound: a scaled VCA is baked into the faders", () => {
    const { tracks, vcas } = bakeLegacyVca(
      [track("a", { volume: 0.8 }), track("b", { vca: "B" })],
      {
        A: { volume: 0.5, muted: false },
        B: { volume: 1, muted: false },
        C: { volume: 1, muted: false },
        D: { volume: 1, muted: false },
      },
    );
    expect(tracks[0]!.volume).toBeCloseTo(0.4);
    expect(tracks[1]!.volume).toBe(1);
    expect(vcas.A.volume).toBe(1);
  });

  it("new snapshots already hold the VCA move: undo/reopen keeps a -6 dB VCA at -6 dB", () => {
    const vcaDown = { volume: dbToGain(-6), muted: false };
    // the VCA was pulled down 6 dB, so the fader already sits at -6 dB
    const pulled = applyVcaLink([track("v")], "A", base, vcaDown, new Map(), makeEq);
    const vcas = { A: vcaDown, B: base, C: base, D: base };
    const reopened = bakeLegacyVca(pulled, vcas, true);
    expect(gainToDb(reopened.tracks[0]!.volume)).toBeCloseTo(-6, 5);
    expect(reopened.vcas.A.volume).toBeCloseTo(dbToGain(-6));
  });
});
