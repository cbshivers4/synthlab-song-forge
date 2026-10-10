import { describe, expect, it } from "vitest";
import { addVirtualInput, claimMidiNotes, feedVirtualInput, removeVirtualInput, subscribe } from "./midi";

describe("focused MIDI note consumers", () => {
  it("consumes learned notes once without also playing tracks, preserving CC and other notes", () => {
    const messages: string[] = [];
    const stop = subscribe(null, "test-video", (msg) => messages.push(msg.type));
    addVirtualInput("test-video", "Test keyboard");
    const release = claimMidiNotes((msg) => (msg.type === "on" || msg.type === "off") && msg.pitch === 48);
    feedVirtualInput("test-video", new Uint8Array([0x90, 48, 100]));
    feedVirtualInput("test-video", new Uint8Array([0x80, 48, 0]));
    feedVirtualInput("test-video", new Uint8Array([0x90, 49, 100]));
    feedVirtualInput("test-video", new Uint8Array([0xb0, 7, 100]));
    expect(messages).toEqual(["on", "cc"]);
    release(); stop(); removeVirtualInput("test-video");
  });
});