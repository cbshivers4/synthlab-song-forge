// Minimal Web MIDI helper — hardware controller input for SYNCLAB.

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

export function listInputs(a: AnyAccess | null): MidiPortInfo[] {
  const real = a ? Array.from(a.inputs.values()).map((i) => ({ id: i.id, name: i.name || "MIDI INPUT" })) : [];
  return [...real, ...Array.from(virtualPorts, ([id, name]) => ({ id, name }))];
}

export type MidiMessage =
  | { type: "on" | "off"; pitch: number; velocity: number; channel: number }
  | { type: "cc"; cc: number; value: number; channel: number }
  | { type: "pitchbend"; value: number; channel: number };

export type MidiHandler = (msg: MidiMessage) => void;

/** Subscribe to one input id, or all inputs when id is "all". Returns an unsubscribe fn. */
export function subscribe(a: AnyAccess | null, id: string, handler: MidiHandler): () => void {
  const ports = Array.from(a?.inputs.values() ?? []).filter((p) => id === "all" || p.id === id);
  // Some controllers expose the same keys on two ports (e.g. "MIDI" + "DAW"),
  // and listening to all inputs would then play and record every note twice.
  const lastNote = new Map<string, number>();
  const onMsg = (e: { data: Uint8Array }) => {
    const [status = 0, d1 = 0, d2 = 0] = Array.from(e.data);
    const cmd = status & 0xf0;
    const channel = status & 0x0f;
    if (cmd === 0x90 || cmd === 0x80) {
      const key = `${cmd === 0x90 && d2 > 0 ? "on" : "off"}:${channel}:${d1}`;
      const now = performance.now();
      const prev = lastNote.get(key);
      lastNote.set(key, now);
      if (prev != null && now - prev < 25) return;
    }
    if (cmd === 0x90 && d2 > 0) handler({ type: "on", pitch: d1, velocity: d2 / 127, channel });
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) handler({ type: "off", pitch: d1, velocity: 0, channel });
    else if (cmd === 0xb0) handler({ type: "cc", cc: d1, value: d2 / 127, channel });
    else if (cmd === 0xe0) handler({ type: "pitchbend", value: ((d2 << 7) | d1) / 16383, channel });
  };
  for (const p of ports) p.onmidimessage = onMsg;
  const vh = { id, fn: onMsg };
  virtualHandlers.add(vh);
  return () => {
    virtualHandlers.delete(vh);
    for (const p of ports) if (p.onmidimessage === onMsg) p.onmidimessage = null;
  };
}
