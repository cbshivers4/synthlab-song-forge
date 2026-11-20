import { describe, expect, it } from "vitest";
import { classifyMidi, connectedGear, midiLink } from "./studio-gear";

describe("studio gear", () => {
  it("recognises common hardware from its MIDI name", () => {
    expect(classifyMidi("Arturia KeyStep 37")).toBe("keyboard");
    expect(classifyMidi("Akai MPD218")).toBe("pads");
    expect(classifyMidi("KORG minilogue xd")).toBe("synth");
    expect(classifyMidi("DDJ-FLX4")).toBe("dj");
    expect(classifyMidi("Some Box")).toBe("controller");
  });
  it("tells Bluetooth and network MIDI from USB", () => {
    expect(midiLink("WIDI Master Bluetooth")).toBe("bluetooth");
    expect(midiLink("Network Session 1")).toBe("network");
    expect(midiLink("Launchkey Mini MIDI")).toBe("usb");
  });
  it("lists a device once even when it has an input and an output, and skips virtual ports", () => {
    const g = connectedGear({
      midiInputs: [
        { id: "1", name: "Launchkey Mini MIDI In" },
        { id: "2", name: "IAC Driver Bus 1" },
      ],
      midiOutputs: [{ id: "3", name: "Launchkey Mini MIDI Out" }],
      audioInputs: [],
      interfaceName: null,
      plugged: [],
    });
    expect(g.map((x) => x.name)).toEqual(["Launchkey Mini"]);
  });
  it("puts a declared guitar through the interface on the input the user chose", () => {
    const g = connectedGear({
      midiInputs: [],
      midiOutputs: [],
      audioInputs: [],
      interfaceName: "Scarlett 2i2",
      plugged: [{ id: "a", kind: "guitar", input: 2 }],
    });
    expect(g.find((x) => x.kind === "guitar")).toMatchObject({
      link: "cable",
      via: "Scarlett 2i2",
      detail: '1/4" instrument cable → Scarlett 2i2 Input 2',
      reported: false,
    });
    expect(g.find((x) => x.kind === "interface")).toMatchObject({ link: "usb", reported: true });
  });
  it("shows Bluetooth audio inputs as wireless headsets but not built-in mics", () => {
    const g = connectedGear({
      midiInputs: [],
      midiOutputs: [],
      audioInputs: [
        { label: "AirPods Pro (Bluetooth)" },
        { label: "MacBook Pro Microphone (Built-in)" },
      ],
      interfaceName: null,
      plugged: [],
    });
    expect(g.map((x) => [x.kind, x.link])).toEqual([["headset", "bluetooth"]]);
  });
});
