import { afterEach, describe, expect, it, vi } from "vitest";
import { bluetoothMidiSupported, connectBluetoothMidi } from "./bluetooth";
import { listInputs } from "./midi";

afterEach(() => vi.unstubAllGlobals());

describe("Bluetooth MIDI discovery", () => {
  it("includes nearby devices without advertised MIDI service and registers verified MIDI inputs", async () => {
    const characteristic = {
      startNotifications: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };
    const service = { getCharacteristic: vi.fn().mockResolvedValue(characteristic) };
    const gatt = {
      connect: vi.fn().mockResolvedValue({ getPrimaryService: vi.fn().mockResolvedValue(service) }),
      disconnect: vi.fn(),
      connected: true,
    };
    const requestDevice = vi
      .fn()
      .mockResolvedValue({ id: "test-bt", name: "Keys", gatt, addEventListener: vi.fn() });
    vi.stubGlobal("navigator", { bluetooth: { requestDevice } });
    await expect(connectBluetoothMidi()).resolves.toEqual({
      id: "ble:test-bt",
      name: "Keys (Bluetooth)",
    });
    expect(requestDevice).toHaveBeenCalledWith({
      acceptAllDevices: true,
      optionalServices: ["03b80e5a-ede8-4b33-a751-6ce34ec4c700"],
    });
    expect(listInputs(null)).toContainEqual({ id: "ble:test-bt", name: "Keys (Bluetooth)" });
  });
  it("rejects audio-only devices and releases their connection rather than claiming MIDI works", async () => {
    const failure = new Error("No MIDI service");
    failure.name = "NotFoundError";
    const disconnect = vi.fn();
    vi.stubGlobal("navigator", {
      bluetooth: {
        requestDevice: vi.fn().mockResolvedValue({
          id: "speaker",
          gatt: {
            connect: vi
              .fn()
              .mockResolvedValue({ getPrimaryService: vi.fn().mockRejectedValue(failure) }),
            disconnect,
          },
        }),
      },
    });
    await expect(connectBluetoothMidi()).rejects.toThrow("does not provide Bluetooth LE MIDI");
    expect(disconnect).toHaveBeenCalledOnce();
    expect(listInputs(null).some((p) => p.id === "ble:speaker")).toBe(false);
  });
  it("does not claim discovery support without a working browser device chooser", () => {
    vi.stubGlobal("navigator", { bluetooth: {} });
    expect(bluetoothMidiSupported()).toBe(false);
  });
});
