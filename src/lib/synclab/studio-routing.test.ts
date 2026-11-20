import { describe, expect, it } from "vitest";
import { studioCablePatch } from "./studio-routing";
import type { PluginInstance } from "./types";

const effect = (id: string, bypass = false): PluginInstance => ({
  id,
  defId: id,
  name: id,
  vendor: "SYNCLAB",
  format: "Built-in",
  kind: "delay",
  bypass,
  params: [],
});
const track = {
  id: "t",
  plugins: [effect("a"), effect("b", true)],
  sends: { reverb: 0.2, delay: 0, chorus: 0.3 },
};
const out = { device: "track:t", port: "out" };
describe("Studio View real cable routing", () => {
  it("adds a send without changing the other sends", () => {
    expect(studioCablePatch(track, out, { device: "bus:delay", port: "in" })?.sends).toEqual({
      reverb: 0.2,
      delay: 0.5,
      chorus: 0.3,
    });
  });
  it("reconnects a bypassed insert atomically and retains its settings", () => {
    const result = studioCablePatch(track, out, { device: "fx:b", port: "in" });
    expect(result?.plugins?.map((p) => [p.id, p.bypass])).toEqual([
      ["b", false],
      ["a", false],
    ]);
    expect(track.plugins[1]?.bypass).toBe(true);
  });
  it("routes an effect to the mixer without bypassing earlier effects", () => {
    expect(
      studioCablePatch(
        track,
        { device: "fx:a", port: "out" },
        { device: "master", port: "in:t" },
      )?.plugins?.map((p) => p.bypass),
    ).toEqual([false, true]);
  });
  it("rejects cross-channel, self, fixed output and unsupported effect-send cables", () => {
    for (const target of [
      { device: "master", port: "in:other" },
      { device: "fx:other", port: "in" },
      { device: "monitor-l", port: "in" },
    ])
      expect(studioCablePatch(track, out, target)).toBeNull();
    expect(
      studioCablePatch(track, { device: "fx:a", port: "out" }, { device: "fx:a", port: "in" }),
    ).toBeNull();
    expect(
      studioCablePatch(track, { device: "fx:a", port: "out" }, { device: "bus:delay", port: "in" }),
    ).toBeNull();
  });
});
