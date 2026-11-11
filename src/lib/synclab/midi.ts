// Minimal Web MIDI helper — hardware controller input for SYNCLAB.
import { curvedVelocity, playbackPreferences } from "./preferences";
import { dispatchRealtime } from "./midi-clock";

export interface MidiPortInfo {
  id: string;
  name: string;
}

type AnyAccess = {
  inputs: Map<string, { id: string; name?: string | null; onmidimessage: ((e: { data: Uint8Array }) => void) | null }>;
  onstatechange: (() => void) | null;
};

let access: AnyAccess | null = null;

export function midiSupported() {
  return typeof navigator !== "undefined" && typeof (navigator as never as { requestMIDIAccess?: unknown }).requestMIDIAccess === "function";
}

export async function getMidiAccess(): Promise<AnyAccess | null> {
  if (access) return access;
  if (!midiSupported()) return null;
  const req = (navigator as never as { requestMIDIAccess: (o?: unknown) => Promise<AnyAccess> }).requestMIDIAccess;
  try {
    access = await req.call(navigator, { sysex: false });
    return access;
  } catch {
    return null;
  }
}

/* Bluetooth LE MIDI devices connected through Web Bluetooth act as extra inputs. */
const virtualPorts = new Map<string, string>();
const virtualHandlers = new Set<{ id: string; fn: (e: { data: Uint8Array }) => void }>();
export function addVirtualInput(id: string, name: string) { virtualPorts.set(id, name); }
export function removeVirtualInput(id: string) { virtualPorts.delete(id); }
export function feedVirtualInput(id: string, data: Uint8Array) {
  for (const h of virtualHandlers) if (h.id === "all" || h.id === id) h.fn({ data });
}

export function listOutputs(a: AnyAccess | null): MidiPortInfo[] {
  if (!a) return [];
  const outs = (a as unknown as { outputs?: Map<string, { id: string; name?: string | null }> }).outputs;
  return outs ? Array.from(outs.values()).map((o) => ({ id: o.id, name: o.name || "MIDI OUTPUT" })) : [];
}

export function listInputs(a: AnyAccess | null): MidiPortInfo[] {
  const real = a ? Array.from(a.inputs.values()).map((i) => ({ id: i.id, name: i.name || "MIDI INPUT" })) : [];
  return [...real, ...Array.from(virtualPorts, ([id, name]) => ({ id, name }))];
}

export type MidiMessage =
  | { type: "on" | "off"; pitch: number; velocity: number; channel: number }
  | { type: "cc"; cc: number; value: number; channel: number }
  | { type: "pitchbend"; value: number; channel: number };

export type MidiHandler = (msg: MidiMessage) => void;

/** Keep legacy single-input preferences compatible with multi-input selection. */
export function selectedMidiInputs(id: string | null): string[] {
  if (!id || id === "all") return [];
  try {
    const value: unknown = JSON.parse(id);
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  } catch { /* legacy port ID */ }
  return [id];
}
export function midiInputEnabled(selection: string | null, id: string): boolean {
  return selection === "all" || selectedMidiInputs(selection).includes(id);
}
export function toggleMidiInput(selection: string | null, id: string, enabled: boolean, ports: MidiPortInfo[]): string | null {
  const ids = new Set(selection === "all" ? ports.map(port => port.id) : selectedMidiInputs(selection));
  if (enabled) ids.add(id); else ids.delete(id);
  return ids.size ? JSON.stringify([...ids]) : null;
}

// Focused tools may consume notes before the ordinary track input path.
const noteConsumers = new Set<(msg: MidiMessage) => boolean>();
export function claimMidiNotes(consumer: (msg: MidiMessage) => boolean): () => void {
  noteConsumers.add(consumer);
  return () => { noteConsumers.delete(consumer); };
}

/**
 * Whole-controller consumers (DJ Decks hardware): they see every raw note/CC from an input, with its
 * port name, before MIDI Thru, note routing or mappings, and return true to keep it for themselves.
 */
export type RawMidi = { status: number; d1: number; d2: number; inputId: string; portName: string };
const controllerConsumers = new Set<(msg: RawMidi) => boolean>();
export function claimControllerMidi(consumer: (msg: RawMidi) => boolean): () => void {
  controllerConsumers.add(consumer);
  return () => { controllerConsumers.delete(consumer); };
}

/** Subscribe to one input id, or all inputs when id is "all". Returns an unsubscribe fn. */
export function subscribe(a: AnyAccess | null, id: string, handler: (msg: MidiMessage, inputId?: string) => void): () => void {
  const ports = Array.from(a?.inputs.values() ?? []).filter((p) => midiInputEnabled(id, p.id));
  // Some controllers expose the same keys on two ports (e.g. "MIDI" + "DAW"),
  // and listening to all inputs would then play and record every note twice.
  const lastNote = new Map<string, number>();
  const onMsg = (e: { data: Uint8Array }, inputId: string) => {
    const [status = 0, d1 = 0, d2 = 0] = Array.from(e.data);
    // MIDI clock and transport messages go to the clock follower, never to notes or controls.
    if (status >= 0xf8 && dispatchRealtime(status, (e as { timeStamp?: number }).timeStamp ?? performance.now())) return;
    const cmd = status & 0xf0;
    const channel = status & 0x0f;
    if (cmd === 0x90 || cmd === 0x80) {
      const key = `${cmd === 0x90 && d2 > 0 ? "on" : "off"}:${channel}:${d1}`;
      const now = performance.now();
      const prev = lastNote.get(key);
      lastNote.set(key, now);
      if (prev != null && now - prev < 25) return;
    }
    if (controllerConsumers.size && cmd >= 0x80 && cmd <= 0xe0) {
      const portName = ports.find((p) => p.id === inputId)?.name ?? virtualPorts.get(inputId) ?? "";
      for (const consumer of controllerConsumers) if (consumer({ status, d1, d2, inputId, portName: portName || "" })) return;
    }
    if (cmd === 0x90 || cmd === 0x80) {
      const prefs = playbackPreferences();
      // Release held notes even when MIDI thru is off; CC mappings remain active.
      if (!prefs.midiThru && cmd === 0x90 && d2 > 0) return;
      const msg: MidiMessage = { type: cmd === 0x90 && d2 > 0 ? "on" : "off", pitch: d1, velocity: curvedVelocity(d2 / 127, prefs.velocityCurve), channel };
      for (const consumer of Array.from(noteConsumers).reverse()) if (consumer(msg)) return;
       handler(msg, inputId);
    }
    else if (cmd === 0xb0) handler({ type: "cc", cc: d1, value: d2 / 127, channel }, inputId);
    else if (cmd === 0xe0) handler({ type: "pitchbend", value: ((d2 << 7) | d1) / 16383, channel }, inputId);
  };
  const handlers = ports.map(port => ({ port, fn: (e: { data: Uint8Array }) => onMsg(e, port.id) }));
  for (const { port, fn } of handlers) port.onmidimessage = fn;
  const virtualIds = id === "all" ? ["all"] : selectedMidiInputs(id);
  const virtual = virtualIds.map(inputId => ({ id: inputId, fn: (e: { data: Uint8Array }) => onMsg(e, inputId) }));
  virtual.forEach(handler => virtualHandlers.add(handler));
  return () => {
    virtual.forEach(handler => virtualHandlers.delete(handler));
    for (const { port, fn } of handlers) if (port.onmidimessage === fn) port.onmidimessage = null;
  };
}


/** Plain explanation of why this device's browser can't reach MIDI hardware, with options that do work. */
export function midiUnsupportedMessage(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  if (ios)
    return "On iPhone or iPad, no browser can see MIDI hardware — not Safari at any iOS or iPadOS version, not Chrome or Firefox on iOS either. You still don't need an Apple developer account: install the free MIDIWeb Browser from the App Store (needs iOS/iPadOS 17 or later), open synclabsapp.com inside it, and connect your Korg by USB cable — it adds MIDI to web pages for you. \"Web MIDI Browser\" is another free option (works back to iOS 9). Bluetooth MIDI is not offered there, so use the cable. Or make music with the on-screen Touch Synth and keys, record with the microphone, or use the Mac/Windows desktop app.";
  if (/Android/.test(ua)) return "This Android browser can't see MIDI. Open SYNCLAB in Chrome and connect the keyboard by USB (OTG adapter) or Bluetooth MIDI.";
  return "This browser cannot see MIDI hardware — use Chrome or Edge.";
}
