import { beforeEach, describe, expect, it, vi } from "vitest";

type Sent = { data: number[]; ts?: number | undefined };

function fakeMidi(names: string[]) {
  const sent: Record<string, Sent[]> = {};
  const outputs = new Map<string, { id: string; name: string; state: string; send: (d: number[], ts?: number) => void; clear: () => void }>();
  names.forEach((name, i) => {
    const id = `port-${i}`;
    sent[id] = [];
    outputs.set(id, { id, name, state: "connected", send: (data, ts) => sent[id]!.push({ data, ts }), clear: () => sent[id]!.push({ data: [-1] }) });
  });
  return { sent, outputs, access: { outputs, addEventListener: () => {} } };
}

async function load(names: string[]) {
  vi.resetModules();
  const fake = fakeMidi(names);
  vi.stubGlobal("navigator", { requestMIDIAccess: () => Promise.resolve(fake.access) });
  const mod = await import("./external-midi");
  await mod.getOutputAccess();
  return { ...fake, mod };
}

describe("external MIDI instruments", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it("sends a routed track's notes on its chosen channel and tells the synth to stay silent", async () => {
    const { mod, sent } = await load(["Minilogue"]);
    mod.setRoute("t1", { portId: "port-0", channel: 3 });
    expect(mod.sendExternalNote("t1", 60, 0.5, 1, 0)).toBe(true);
    const msgs = sent["port-0"]!.map((m) => m.data);
    expect(msgs).toContainEqual([0x92, 60, 127]);
    expect(msgs).toContainEqual([0x82, 60, 0]);
    expect(mod.sendExternalNote("unrouted", 60, 0.5, 1, 0)).toBe(false);
  });

  it("sends the chosen program number when the route is set", async () => {
    const { mod, sent } = await load(["TR-8"]);
    mod.setRoute("t1", { portId: "port-0", channel: 10, program: 5 });
    expect(sent["port-0"]!.map((m) => m.data)).toContainEqual([0xc9, 4]);
  });

  it("holds keyboard notes until release", async () => {
    const { mod, sent } = await load(["Synth"]);
    mod.setRoute("t1", { portId: "port-0", channel: 1 });
    sent["port-0"]!.length = 0;
    mod.externalNoteOn("t1", 64, 0.5);
    expect(sent["port-0"]!.map((m) => m.data)).toEqual([[0x90, 64, 64]]);
    mod.externalNoteOff("t1", 64);
    expect(sent["port-0"]!.map((m) => m.data)).toEqual([[0x90, 64, 64], [0x80, 64, 0]]);
  });

  it("Stop clears queued notes and releases everything on the track's channel", async () => {
    const { mod, sent } = await load(["Synth"]);
    mod.setRoute("t1", { portId: "port-0", channel: 2 });
    mod.sendExternalNote("t1", 48, 4, 1, 0.1);
    mod.externalNoteOn("t1", 50, 1);
    sent["port-0"]!.length = 0;
    mod.stopExternalNotes(["t1"]);
    const msgs = sent["port-0"]!.map((m) => m.data);
    expect(msgs[0]).toEqual([-1]); // queue cleared first
    expect(msgs).toContainEqual([0x81, 48, 0]);
    expect(msgs).toContainEqual([0x81, 50, 0]);
    expect(msgs).toContainEqual([0xb1, 64, 0]);
    expect(msgs).toContainEqual([0xb1, 123, 0]);
  });

  it("a routed track whose instrument is unplugged stays silent and reports it", async () => {
    const { mod, outputs } = await load(["Synth"]);
    mod.setRoute("t1", { portId: "port-0", channel: 1 });
    outputs.get("port-0")!.state = "disconnected";
    expect(mod.routeStatus("t1")).toBe("missing");
    expect(mod.sendExternalNote("t1", 60, 0.5, 1, 0)).toBe(true);
  });
});
