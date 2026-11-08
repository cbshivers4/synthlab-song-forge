import { describe, expect, it } from "vitest";
import { BUILT_IN_PLUGINS } from "./plugins";
import { effectCategory, effectForm, groupByCategory, availableEffects } from "./effect-catalog";
import { fuzzTransfer, overdriveTransfer, wahFrequency, PEDAL_KINDS } from "./creative-fx";

describe("lead / bass guitar amps and effect pedals", () => {
  it("offers a lead guitar amp, a bass guitar amp and ten pedals in Amps & Pedals", () => {
    const group = groupByCategory(availableEffects([])).find(([c]) => c === "Amps & Pedals")?.[1] ?? [];
    const names = group.map(d => d.name);
    expect(names).toContain("Lead Guitar Amp");
    expect(names).toContain("Bass Guitar Amp");
    expect(group.filter(d => effectForm(d.kind) === "pedal")).toHaveLength(10);
    expect(PEDAL_KINDS).toHaveLength(10);
    for (const kind of PEDAL_KINDS) expect(effectCategory(kind)).toBe("Amps & Pedals");
    expect(BUILT_IN_PLUGINS.filter(d => effectCategory(d.kind) === "Amps & Pedals")).toHaveLength(13);
  });
  it("amps render as amp heads and pedals as stompboxes, rack units stay racks", () => {
    expect(effectForm("leadamp")).toBe("amp");
    expect(effectForm("bassamp")).toBe("amp");
    expect(effectForm("overdrive")).toBe("pedal");
    expect(effectForm("reverb")).toBeUndefined();
  });
  it("overdrive keeps full-scale peaks at unity and adds gain to quiet playing", () => {
    expect(overdriveTransfer(1, 1)).toBeCloseTo(1, 5);
    expect(overdriveTransfer(0.05, 1)).toBeGreaterThan(overdriveTransfer(0.05, 0) * 3);
  });
  it("fuzz bias gate silences quiet signal; zero bias does not", () => {
    expect(fuzzTransfer(0.002, 0.6, 1)).toBe(0);
    expect(Math.abs(fuzzTransfer(0.002, 0.6, 0))).toBeGreaterThan(0);
  });
  it("wah sweeps from 350 Hz heel down to 2.2 kHz toe down", () => {
    expect(wahFrequency(0)).toBeCloseTo(350, 3);
    expect(wahFrequency(1)).toBeCloseTo(2200, 3);
  });
});

describe("Amp Room signal order", async () => {
  const { insertRigDevice, rigDevices, otherInserts } = await import("./guitar-rig");
  const { instantiate } = await import("./plugins");
  const def = (kind: string) => BUILT_IN_PLUGINS.find(d => d.kind === kind)!;
  it("puts a new pedal before the amp, like guitar → pedals → amp", () => {
    const eq = instantiate(def("eq")), amp = instantiate(def("leadamp")), drive = instantiate(def("overdrive"));
    const chain = insertRigDevice([eq, amp], drive);
    expect(chain.map(p => p.kind)).toEqual(["eq", "overdrive", "leadamp"]);
  });
  it("adds an amp after the pedals and lists only rig devices with their real slot", () => {
    const reverb = instantiate(def("reverb")), fuzz = instantiate(def("fuzz")), amp = instantiate(def("bassamp"));
    const chain = insertRigDevice([fuzz, reverb], amp);
    expect(chain.map(p => p.kind)).toEqual(["fuzz", "bassamp", "reverb"]);
    expect(rigDevices(chain).map(x => [x.plugin.kind, x.index])).toEqual([["fuzz", 0], ["bassamp", 1]]);
    expect(otherInserts(chain)).toBe(1);
  });
});
