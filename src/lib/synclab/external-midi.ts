// Play external MIDI instruments — hardware synths, drum machines and other
// music apps (e.g. through the macOS IAC Driver) — from SYNCLAB tracks.
// A routed track sends its notes out of a MIDI output instead of playing the
// built-in synth; the instrument's own audio comes back through an audio input.
// Routes are device-only (port IDs belong to this computer), never project data.

type Out = {
  id: string;
  name?: string | null;
  state?: string;
  send: (data: number[], ts?: number) => void;
  clear?: () => void;
};
type Access = {
  outputs: Map<string, Out>;
  onstatechange?: ((e: unknown) => void) | null;
  addEventListener?: (t: string, fn: () => void) => void;
};

let access: Access | null = null;
let pendingAccess: Promise<Access | null> | null = null;
const KEY = "synclab.extmidi.routes";
export type ExtRoute = {
  portId: string;
  /** Port name, so the route finds the instrument again if the computer renumbers its ports. */
  portName?: string;
  /** MIDI channel 1–16. */
  channel: number;
  /** Program (patch) number 1–128 sent when the route is chosen, or none. */
  program?: number | null;
};
let routes: Record<string, ExtRoute> = {};
try {
  routes = typeof localStorage === "undefined" ? {} : JSON.parse(localStorage.getItem(KEY) || "{}");
} catch {
  routes = {};
}
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Notes currently sounding (or scheduled) per port: "channel:note" → count. */
const sounding = new Map<string, Map<string, number>>();
/** Notes held by a player's key, released on key-up: "track:note" → port/channel/note. */
const held = new Map<string, { portId: string; ch: number; note: number }>();

export function midiOutSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as never as { requestMIDIAccess?: unknown }).requestMIDIAccess === "function"
  );
}

export function getOutputAccess(): Promise<Access | null> {
  if (access) return Promise.resolve(access);
  if (pendingAccess) return pendingAccess;
  const nav = navigator as never as { requestMIDIAccess?: (o?: unknown) => Promise<Access> };
  if (!nav.requestMIDIAccess) return Promise.resolve(null);
  pendingAccess = nav.requestMIDIAccess
    .call(navigator, { sysex: false })
    .then((a) => {
      access = a;
      const changed = () => {
        relinkRoutes();
        notify();
      };
      if (a.addEventListener) a.addEventListener("statechange", changed);
      else a.onstatechange = changed;
      relinkRoutes();
      for (const r of Object.values(routes)) sendProgram(r);
      notify();
      return a;
    })
    .catch(() => null)
    .finally(() => {
      pendingAccess = null;
    });
  return pendingAccess;
}

/** Re-open MIDI outputs on start-up when this device already has routed tracks. */
export function restoreExternalRoutes() {
  if (Object.keys(routes).length && midiOutSupported()) void getOutputAccess();
}

export function listOutputs(): { id: string; name: string; connected: boolean }[] {
  return access
    ? Array.from(access.outputs.values()).map((o) => ({
        id: o.id,
        name: o.name || "MIDI OUTPUT",
        connected: o.state !== "disconnected",
      }))
    : [];
}

/** When a saved port ID is gone but a port with the same name exists, point the route at it. */
function relinkRoutes() {
  if (!access) return;
  let moved = false;
  for (const [trackId, r] of Object.entries(routes)) {
    if (access.outputs.has(r.portId) || !r.portName) continue;
    const match = Array.from(access.outputs.values()).find((o) => o.name === r.portName);
    if (match) {
      routes[trackId] = { ...r, portId: match.id };
      moved = true;
    }
  }
  if (moved) save();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(routes));
  } catch {
    /* blocked */
  }
}

function port(r: ExtRoute | undefined): Out | null {
  if (!r || !access) return null;
  const out = access.outputs.get(r.portId);
  return out && out.state !== "disconnected" ? out : null;
}

function sendProgram(r: ExtRoute) {
  const out = port(r);
  if (!out || r.program == null) return;
  try {
    out.send([0xc0 | ((r.channel - 1) & 0x0f), Math.max(0, Math.min(127, r.program - 1))]);
  } catch {
    /* port went away */
  }
}

export function getRoutes() {
  return routes;
}
export function getRoute(trackId: string): ExtRoute | undefined {
  return routes[trackId];
}
export function isExternal(trackId: string) {
  return Boolean(routes[trackId]);
}
/** "connected" when the route's output is present, "missing" when routed but the instrument isn't reachable. */
export function routeStatus(trackId: string): "none" | "connected" | "missing" {
  const r = routes[trackId];
  if (!r) return "none";
  return port(r) ? "connected" : "missing";
}

export function setRoute(trackId: string, r: ExtRoute | null) {
  const old = routes[trackId];
  if (old) stopExternalNotes([trackId]);
  routes = { ...routes };
  if (r) {
    const name = access?.outputs.get(r.portId)?.name ?? r.portName;
    routes[trackId] = name ? { ...r, portName: name } : { ...r };
    sendProgram(routes[trackId]!);
  } else delete routes[trackId];
  save();
  notify();
}
export function onRoutesChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const clampNote = (midi: number) => Math.max(0, Math.min(127, Math.round(midi)));
const clampVel = (v: number) => Math.max(1, Math.min(127, Math.round(v * 127)));

function mark(portId: string, key: string, delta: number) {
  const m = sounding.get(portId) ?? new Map<string, number>();
  const n = (m.get(key) ?? 0) + delta;
  if (n > 0) m.set(key, n);
  else m.delete(key);
  sounding.set(portId, m);
}

/**
 * Send a note of known length (song playback, on-screen keys, recordings).
 * Returns true when the track is routed out, so the built-in synth stays silent.
 */
export function sendExternalNote(
  trackId: string,
  midi: number,
  duration: number,
  velocity: number,
  delaySec: number,
): boolean {
  const r = routes[trackId];
  if (!r) return false;
  const out = port(r);
  if (!out) return true; // routed but unplugged: stay silent rather than play a different sound
  const ch = (r.channel - 1) & 0x0f;
  const note = clampNote(midi);
  const start = performance.now() + Math.max(0, delaySec) * 1000;
  const end = start + Math.max(0.02, duration) * 1000;
  const key = `${ch}:${note}`;
  try {
    out.send([0x90 | ch, note, clampVel(velocity)], start);
    out.send([0x80 | ch, note, 0], end);
    mark(r.portId, key, 1);
    setTimeout(() => mark(r.portId, key, -1), Math.max(0, end - performance.now()) + 20);
  } catch {
    /* port went away */
  }
  return true;
}

/** A key pressed on a MIDI keyboard: the note holds until externalNoteOff. */
export function externalNoteOn(trackId: string, midi: number, velocity: number): boolean {
  const r = routes[trackId];
  if (!r) return false;
  const out = port(r);
  if (!out) return true;
  const ch = (r.channel - 1) & 0x0f;
  const note = clampNote(midi);
  const k = `${trackId}:${note}`;
  if (held.has(k)) externalNoteOff(trackId, midi);
  try {
    out.send([0x90 | ch, note, clampVel(velocity)]);
    held.set(k, { portId: r.portId, ch, note });
    mark(r.portId, `${ch}:${note}`, 1);
  } catch {
    /* port went away */
  }
  return true;
}

export function externalNoteOff(trackId: string, midi: number) {
  const k = `${trackId}:${clampNote(midi)}`;
  const h = held.get(k);
  if (!h) return;
  held.delete(k);
  const out = access?.outputs.get(h.portId);
  try {
    out?.send([0x80 | h.ch, h.note, 0]);
  } catch {
    /* port went away */
  }
  mark(h.portId, `${h.ch}:${h.note}`, -1);
}

/** Pitch wheel (0..1, centre 0.5) forwarded to a routed instrument. */
export function sendExternalBend(trackId: string, value: number): boolean {
  const out = port(routes[trackId]);
  const r = routes[trackId];
  if (!out || !r) return Boolean(r);
  const v = Math.max(0, Math.min(16383, Math.round(value * 16383)));
  try {
    out.send([0xe0 | ((r.channel - 1) & 0x0f), v & 0x7f, v >> 7]);
  } catch {
    /* port went away */
  }
  return true;
}

/** Controller knobs that aren't mapped to SYNCLAB controls (mod wheel, sustain…) reach the instrument. */
export function sendExternalCc(trackId: string, cc: number, value: number): boolean {
  const out = port(routes[trackId]);
  const r = routes[trackId];
  if (!out || !r) return false;
  try {
    out.send([
      0xb0 | ((r.channel - 1) & 0x0f),
      cc & 0x7f,
      Math.max(0, Math.min(127, Math.round(value * 127))),
    ]);
  } catch {
    /* port went away */
  }
  return true;
}

/**
 * Stop: cancel queued notes and release everything the given tracks' instruments
 * are playing, so hardware never hangs on a note after the song stops.
 */
export function stopExternalNotes(trackIds: string[]) {
  if (!access) return;
  const targets = new Map<string, Set<number>>();
  for (const id of trackIds) {
    const r = routes[id];
    if (!r) continue;
    const s = targets.get(r.portId) ?? new Set<number>();
    s.add((r.channel - 1) & 0x0f);
    targets.set(r.portId, s);
    for (const k of [...held.keys()]) if (k.startsWith(`${id}:`)) held.delete(k);
  }
  for (const [portId, chans] of targets) {
    const out = access.outputs.get(portId);
    if (!out) continue;
    try {
      out.clear?.();
    } catch {
      /* not supported */
    }
    const m = sounding.get(portId);
    for (const [key] of m ?? []) {
      const [ch, note] = key.split(":").map(Number) as [number, number];
      if (chans.has(ch)) {
        try {
          out.send([0x80 | ch, note, 0]);
        } catch {
          /* gone */
        }
        m?.delete(key);
      }
    }
    for (const ch of chans) {
      try {
        out.send([0xb0 | ch, 64, 0]); // sustain pedal up
        out.send([0xb0 | ch, 123, 0]); // all notes off
      } catch {
        /* gone */
      }
    }
  }
}

export function sendTestNote(portId: string, channel: number) {
  const out = access?.outputs.get(portId);
  if (!out) return false;
  const ch = (channel - 1) & 0x0f;
  try {
    out.send([0x90 | ch, 60, 100]);
    out.send([0x80 | ch, 60, 0], performance.now() + 400);
  } catch {
    return false;
  }
  return true;
}
