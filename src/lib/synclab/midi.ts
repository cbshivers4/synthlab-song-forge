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

export function listInputs(a: AnyAccess | null): MidiPortInfo[] {
  if (!a) return [];
  return Array.from(a.inputs.values()).map((i) => ({ id: i.id, name: i.name || "MIDI INPUT" }));
}

export type MidiHandler = (msg: { type: "on" | "off"; pitch: number; velocity: number }) => void;

/** Subscribe to one input id, or all inputs when id is "all". Returns an unsubscribe fn. */
export function subscribe(a: AnyAccess | null, id: string, handler: MidiHandler): () => void {
  if (!a) return () => {};
  const ports = Array.from(a.inputs.values()).filter((p) => id === "all" || p.id === id);
  const onMsg = (e: { data: Uint8Array }) => {
    const [status = 0, d1 = 0, d2 = 0] = Array.from(e.data);
    const cmd = status & 0xf0;
    if (cmd === 0x90 && d2 > 0) handler({ type: "on", pitch: d1, velocity: d2 / 127 });
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) handler({ type: "off", pitch: d1, velocity: 0 });
  };
  for (const p of ports) p.onmidimessage = onMsg;
  return () => {
    for (const p of ports) if (p.onmidimessage === onMsg) p.onmidimessage = null;
  };
}
