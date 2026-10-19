// Bluetooth support. Audio (headphones, speakers, headset mics) is paired in the
// operating system and then appears as a normal input/output device. Bluetooth LE
// MIDI keyboards are connected directly through Web Bluetooth (Chrome/Edge).
import { addVirtualInput, feedVirtualInput, removeVirtualInput } from "@/lib/synclab/midi";

const MIDI_SERVICE = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const MIDI_CHAR = "7772e5db-3868-4112-a1a9-f2669d106bf3";

const BT_NAME = /bluetooth|airpods|beats|buds|bose|jbl|sony wh|sony wf|wh-1000|soundcore|headset|hands-free|\bbt\b/i;
export const looksBluetooth = (label: string) => BT_NAME.test(label);

export function bluetoothMidiSupported() {
  return typeof navigator !== "undefined" && typeof (navigator as unknown as { bluetooth?: { requestDevice?: unknown } }).bluetooth?.requestDevice === "function";
}

type BtChar = { value?: DataView; startNotifications(): Promise<unknown>; addEventListener(t: string, f: (e: Event) => void): void };
type BtDevice = {
  id: string; name?: string;
  gatt?: { connect(): Promise<{ getPrimaryService(u: string): Promise<{ getCharacteristic(u: string): Promise<BtChar> }> }>; disconnect(): void; connected: boolean };
  addEventListener(t: string, f: () => void): void;
};

/** Split a BLE-MIDI packet into ordinary MIDI messages. */
export function parseBleMidi(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 1; // byte 0 is the header
  let status = 0;
  while (i < bytes.length) {
    const b = bytes[i] ?? 0;
    // timestamp byte (high bit set) followed by a status byte or running-status data
    if (b & 0x80) {
      i++;
      const n = bytes[i] ?? 0;
      if (n & 0x80) { status = n; i++; }
    }
    if (!status || status >= 0xf0) { i++; continue; }
    const cmd = status & 0xf0;
    const len = cmd === 0xc0 || cmd === 0xd0 ? 1 : 2;
    const data = bytes.slice(i, i + len);
    if (data.length < len) break;
    out.push(new Uint8Array([status, ...data]));
    i += len;
  }
  return out;
}

const connected = new Map<string, BtDevice>();

export async function connectBluetoothMidi(): Promise<{ id: string; name: string }> {
  if (!bluetoothMidiSupported()) throw new Error("This browser can't scan nearby Bluetooth devices. Use Chrome or Edge on a computer or Android; iPhone and iPad browsers do not support this scan.");
  const bt = (navigator as unknown as { bluetooth: { requestDevice(o: unknown): Promise<BtDevice> } }).bluetooth;
  // Some BLE MIDI controllers do not advertise the MIDI service until connected.
  // Discover all BLE devices, then validate the service rather than hiding them.
  const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: [MIDI_SERVICE] });
  if (!device.gatt) throw new Error("This device does not offer Bluetooth LE MIDI. Pair audio devices in your system Bluetooth settings instead.");
  let ch: BtChar;
  try {
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService(MIDI_SERVICE);
    ch = await svc.getCharacteristic(MIDI_CHAR);
    await ch.startNotifications();
  } catch (error) {
    device.gatt.disconnect();
    if (error instanceof Error && error.name === "NotFoundError") {
      throw new Error("The selected device does not provide Bluetooth LE MIDI. For headphones, speakers or audio-only devices, pair them in your system Bluetooth settings first.");
    }
    throw error;
  }
  const id = `ble:${device.id}`;
  const name = `${device.name || "Bluetooth MIDI"} (Bluetooth)`;
  ch.addEventListener("characteristicvaluechanged", () => {
    const v = ch.value;
    if (!v) return;
    for (const msg of parseBleMidi(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))) feedVirtualInput(id, msg);
  });
  addVirtualInput(id, name);
  connected.set(id, device);
  device.addEventListener("gattserverdisconnected", () => {
    removeVirtualInput(id);
    connected.delete(id);
    window.dispatchEvent(new CustomEvent("synclab:bluetooth-midi"));
  });
  return { id, name };
}

export function disconnectBluetoothMidi(id: string) {
  connected.get(id)?.gatt?.disconnect();
}
