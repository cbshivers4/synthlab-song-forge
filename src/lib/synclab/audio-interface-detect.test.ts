import { describe, expect, it } from "vitest";
import { connectedInterface, isInterfaceLabel } from "./audio-interface-detect";

describe("audio interface detection", () => {
  it("reports no interface for built-in and Bluetooth devices only", () => {
    expect(
      connectedInterface(
        [{ label: "MacBook Pro Microphone (Built-in)" }, { label: "AirPods Pro (Bluetooth)" }],
        [{ label: "MacBook Pro Speakers" }],
      ),
    ).toBeNull();
  });
  it("finds a USB interface by brand, ignoring Chrome's Default prefix", () => {
    expect(
      connectedInterface([
        { label: "Default - Scarlett 2i2 USB" },
        { label: "Built-in Microphone" },
      ]),
    ).toBe("Scarlett 2i2 USB");
  });
  it("treats a Volt 1 as an interface but not a Bluetooth headset", () => {
    expect(isInterfaceLabel("Volt 1")).toBe(true);
    expect(isInterfaceLabel("Bose QC45 Hands-Free (Bluetooth)")).toBe(false);
  });
  it("prefers the interface the user picked", () => {
    expect(connectedInterface([{ label: "Volt 1" }, { label: "MOTU M2" }], [], "MOTU M2")).toBe(
      "MOTU M2",
    );
  });
});
