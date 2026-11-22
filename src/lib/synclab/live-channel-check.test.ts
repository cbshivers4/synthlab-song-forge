import { describe, expect, it } from "vitest";
import {
  DRUMMER_CHANNEL_VOLUME,
  audiblePatch,
  bypassDrive,
  checkLiveChannel,
  listNames,
} from "./live-channel-check";
import type { PluginInstance, Track } from "./types";

const track = (over: Partial<Track> = {}) =>
  ({
    id: "d",
    name: "DRUMMER",
    kind: "drum",
    volume: 0.8,
    muted: false,
    solo: false,
    ...over,
  }) as Track;
const fx = (kind: string, name: string, bypass = false) =>
  ({
    id: kind,
    defId: kind,
    name,
    vendor: "SYNCLAB",
    format: "Built-in",
    kind,
    bypass,
    params: [],
  }) as unknown as PluginInstance;

describe("Live player channel check", () => {
  it("flags a fader pulled all the way down as silent", () => {
    expect(checkLiveChannel(track({ volume: 0 }), []).silent).toEqual(["fader"]);
  });
  it("flags another soloed channel", () => {
    const me = track();
    expect(checkLiveChannel(me, [me, track({ id: "x", solo: true })]).silent).toEqual(["solo"]);
  });
  it("a normal channel has nothing to report", () => {
    const me = track();
    expect(checkLiveChannel(me, [me])).toEqual({ silent: [], drive: [] });
  });
  it("Turn it up restores the fader, unmutes and un-bypasses", () => {
    expect(audiblePatch(["fader", "muted", "bypassed"], DRUMMER_CHANNEL_VOLUME)).toEqual({
      volume: 0.4,
      muted: false,
      deviceBypassed: false,
    });
  });
  it("lists active fuzz/overdrive/amp but not wah or bypassed units", () => {
    const plugins = [
      fx("wah", "Wah"),
      fx("fuzz", "Fuzz Pedal"),
      fx("overdrive", "Overdrive", true),
      fx("leadamp", "Lead Amp"),
    ];
    expect(checkLiveChannel(track({ plugins }), []).drive.map((p) => p.name)).toEqual([
      "Fuzz Pedal",
      "Lead Amp",
    ]);
    expect(bypassDrive(plugins).map((p) => p.bypass)).toEqual([false, true, true, true]);
  });
  it("joins names", () => {
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});
