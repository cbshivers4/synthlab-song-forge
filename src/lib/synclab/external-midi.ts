// Send notes from SYNCLAB tracks to other Mac music apps through MIDI outputs
// such as the macOS IAC Driver. Routed tracks play in the external app instead
// of the internal synth, so the app's own sound can be recorded back in.

type Out = { id: string; name?: string | null; send: (data: number[], ts?: number) => void };
type Access = { outputs: Map<string, Out> };

let access: Access | null = null;
const KEY = "synclab.extmidi.routes";
export type ExtRoute = { portId: string; channel: number };
let routes: Record<string, ExtRoute> = {};
try { routes = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { routes = {}; }
const listeners = new Set<() => void>();

export async function getOutputAccess(): Promise<Access | null> {
  if (access) return access;
  const nav = navigator as never as { requestMIDIAccess?: (o?: unknown) => Promise<Access> };
  if (!nav.requestMIDIAccess) return null;
  try { access = await nav.requestMIDIAccess.call(navigator, { sysex: false }); } catch { access = null; }
  return access;
}

export function listOutputs(): { id: string; name: string }[] {
  return access ? Array.from(access.outputs.values()).map((o) => ({ id: o.id, name: o.name || "MIDI OUTPUT" })) : [];
}

export function getRoutes() { return routes; }
export function setRoute(trackId: string, r: ExtRoute | null) {
  routes = { ...routes };
  if (r) routes[trackId] = r; else delete routes[trackId];
  try { localStorage.setItem(KEY, JSON.stringify(routes)); } catch { /* blocked */ }
  listeners.forEach((l) => l());
}
export function onRoutesChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Returns true when the note was sent to an external app (internal synth should stay silent). */
export function sendExternalNote(trackId: string, midi: number, duration: number, velocity: number, delaySec: number): boolean {
  const r = routes[trackId];
  if (!r || !access) return false;
  const out = access.outputs.get(r.portId);
  if (!out) return false;
  const ch = (r.channel - 1) & 0x0f;
  const note = Math.max(0, Math.min(127, Math.round(midi)));
  const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));
  const start = performance.now() + Math.max(0, delaySec) * 1000;
  try {
    out.send([0x90 | ch, note, vel], start);
    out.send([0x80 | ch, note, 0], start + Math.max(0.02, duration) * 1000);
  } catch { return false; }
  return true;
}

export function sendTestNote(portId: string, channel: number) {
  const out = access?.outputs.get(portId);
  if (!out) return false;
  const ch = (channel - 1) & 0x0f;
  out.send([0x90 | ch, 60, 100]);
  out.send([0x80 | ch, 60, 0], performance.now() + 400);
  return true;
}
