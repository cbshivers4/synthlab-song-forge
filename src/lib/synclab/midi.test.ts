import { describe, expect, it } from "vitest";
import {
  addVirtualInput,
  claimMidiNotes,
  feedVirtualInput,
  removeVirtualInput,
  subscribe,
  midiInputEnabled,
  toggleMidiInput,
} from "./midi";

describe("focused MIDI note consumers", () => {
  it("receives two enabled controllers and excludes an unselected third controller", () => {
    const ports = [
      { id: "keys", name: "Keys" },
      { id: "pads", name: "Pads" },
      { id: "other", name: "Other" },
    ];
    let selection = toggleMidiInput(null, "keys", true, ports);
    selection = toggleMidiInput(selection, "pads", true, ports);
    expect(midiInputEnabled(selection, "keys")).toBe(true);
    expect(midiInputEnabled(selection, "pads")).toBe(true);
    expect(midiInputEnabled(selection, "other")).toBe(false);
    const received: number[] = [];
    const stop = subscribe(null, selection ?? "", (msg) => {
      if (msg.type === "on") received.push(msg.pitch);
    });
    feedVirtualInput("keys", new Uint8Array([0x90, 60, 100]));
    feedVirtualInput("pads", new Uint8Array([0x90, 36, 100]));
    feedVirtualInput("other", new Uint8Array([0x90, 72, 100]));
    expect(received).toEqual([60, 36]);
    stop();
  });
  it("All devices receives both controllers and can exclude one without disabling the other", () => {
    const ports = [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ];
    const received: number[] = [];
    const stop = subscribe(null, "all", (msg) => {
      if (msg.type === "on") received.push(msg.pitch);
    });
    feedVirtualInput("one", new Uint8Array([0x90, 60, 100]));
    feedVirtualInput("two", new Uint8Array([0x90, 64, 100]));
    expect(received).toEqual([60, 64]);
    const selection = toggleMidiInput("all", "one", false, ports);
    expect(midiInputEnabled(selection, "one")).toBe(false);
    expect(midiInputEnabled(selection, "two")).toBe(true);
    stop();
  });
  it("consumes learned notes once without also playing tracks, preserving CC and other notes", () => {
    const messages: string[] = [];
    const stop = subscribe(null, "test-video", (msg) => messages.push(msg.type));
    addVirtualInput("test-video", "Test keyboard");
    const release = claimMidiNotes(
      (msg) => (msg.type === "on" || msg.type === "off") && msg.pitch === 48,
    );
    feedVirtualInput("test-video", new Uint8Array([0x90, 48, 100]));
    feedVirtualInput("test-video", new Uint8Array([0x80, 48, 0]));
    feedVirtualInput("test-video", new Uint8Array([0x90, 49, 100]));
    feedVirtualInput("test-video", new Uint8Array([0xb0, 7, 100]));
    expect(messages).toEqual(["on", "cc"]);
    release();
    stop();
    removeVirtualInput("test-video");
  });
});
