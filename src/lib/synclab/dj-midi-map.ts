/**
 * DJ Decks hardware: which controller message does what. Pure (no audio, no browser) so it is tested.
 *
 * A binding key is "n:<channel>:<note>" for buttons/pads or "c:<channel>:<cc>" for knobs, faders and
 * jog wheels (channel 0-15). Known controllers get a ready-made layout matched by their USB port name;
 * any other controller is set up with Learn (press an on-screen action, then move the hardware control).
 */
export type DjDeck = "A" | "B";
export type DjActionKind = "button" | "knob" | "jog" | "touch" | "browse";
export type DjActionDef = {
  id: string;
  label: string;
  group: "Deck A" | "Deck B" | "Mixer";
  kind: DjActionKind;
  hidden?: boolean;
};

const LOOPS = [1, 2, 4, 8] as const;

function deckActions(d: DjDeck): DjActionDef[] {
  const group = d === "A" ? "Deck A" : "Deck B";
  const a = (id: string, label: string, kind: DjActionKind, hidden = false): DjActionDef => ({
    id: `${d}:${id}`,
    label,
    group,
    kind,
    ...(hidden ? { hidden } : {}),
  });
  return [
    a("play", "Play / pause", "button"),
    a("cue", "Cue", "button"),
    a("start", "Back to start", "button"),
    a("sync", "Sync", "button"),
    a("phones", "Headphone cue", "button"),
    a("load", "Load selected track", "button"),
    ...[1, 2, 3, 4].map((n) => a(`hotcue${n}`, `Hot cue ${n}`, "button")),
    ...[1, 2, 3, 4].map((n) => a(`clearcue${n}`, `Delete hot cue ${n}`, "button")),
    ...LOOPS.map((n) => a(`loop:${n}`, `${n}-beat loop`, "button")),
    a("loopoff", "Exit loop", "button"),
    a("gain", "Trim", "knob"),
    a("eqHigh", "EQ high", "knob"),
    a("eqMid", "EQ mid", "knob"),
    a("eqLow", "EQ low", "knob"),
    a("filter", "Filter", "knob"),
    a("fader", "Channel fader", "knob"),
    a("pitch", "Tempo slider", "knob"),
    a("pitchFine", "Tempo slider (fine)", "knob", true),
    a("jog", "Jog wheel top (scratch)", "jog"),
    a("touch", "Jog wheel touch", "touch"),
    a("nudge", "Jog wheel edge (bend)", "jog"),
    a("search", "Fast search", "jog"),
  ];
}

export const DJ_ACTIONS: DjActionDef[] = [
  ...deckActions("A"),
  ...deckActions("B"),
  { id: "mix:crossfader", label: "Crossfader", group: "Mixer", kind: "knob" },
  { id: "mix:master", label: "Master level", group: "Mixer", kind: "knob" },
  { id: "mix:phonesLevel", label: "Headphone level", group: "Mixer", kind: "knob" },
  { id: "mix:phonesMix", label: "Headphone mix (cue ↔ master)", group: "Mixer", kind: "knob" },
  { id: "mix:browse", label: "Browse tracks", group: "Mixer", kind: "browse" },
  { id: "mix:record", label: "Record mix", group: "Mixer", kind: "button" },
];

/** Label for any action, including layout-only ones such as the ¼-beat loop pad. */
export function djActionLabel(id: string): string {
  const def = DJ_ACTIONS.find((x) => x.id === id);
  if (def) return `${def.group === "Mixer" ? "" : def.group + " · "}${def.label}`;
  const loop = /^([AB]):loop:([\d.]+)$/.exec(id);
  if (loop) return `Deck ${loop[1]} · ${loop[2]}-beat loop`;
  return id;
}
export function djActionKind(id: string): DjActionKind {
  const def = DJ_ACTIONS.find((x) => x.id === id);
  if (def) return def.kind;
  return "button";
}

export type DjProfile = {
  id: string;
  name: string;
  /** matched against the USB/Bluetooth MIDI port name */
  port: RegExp;
  map: Record<string, string>;
  /** button lights: action → note key that lights it */
  leds: Record<string, string>;
  source: string;
};

/** Pioneer DDJ-400 and DDJ-FLX4 share one layout (rekordbox mode): deck 1 on channel 1, deck 2 on channel 2. */
function pioneerDdj(): DjProfile {
  const map: Record<string, string> = {};
  const leds: Record<string, string> = {};
  (["A", "B"] as DjDeck[]).forEach((d, ch) => {
    const n = (num: number, id: string, c = ch) => {
      map[`n:${c}:${num}`] = `${d}:${id}`;
    };
    const cc = (num: number, id: string, c = ch) => {
      map[`c:${c}:${num}`] = `${d}:${id}`;
    };
    n(0x0b, "play");
    n(0x0c, "cue");
    n(0x48, "start");
    n(0x58, "sync");
    n(0x54, "phones");
    n(0x10, "loop:4");
    n(0x11, "loopoff");
    n(0x4d, "loopoff");
    n(0x36, "touch");
    n(0x67, "touch");
    cc(0x04, "gain");
    cc(0x07, "eqHigh");
    cc(0x0b, "eqMid");
    cc(0x0f, "eqLow");
    cc(0x13, "fader");
    cc(0x00, "pitch");
    cc(0x20, "pitchFine");
    cc(0x21, "nudge");
    cc(0x22, "jog");
    cc(0x23, "jog");
    cc(0x29, "search");
    const pads = d === "A" ? 7 : 9,
      shiftPads = pads + 1;
    [1, 2, 3, 4].forEach((k) => {
      n(k - 1, `hotcue${k}`, pads);
      n(k - 1, `clearcue${k}`, shiftPads);
      leds[`${d}:hotcue${k}`] = `n:${pads}:${k - 1}`;
    });
    [0.25, 0.5, 1, 2, 4, 8, 16, 32].forEach((beats, k) => {
      n(0x60 + k, `loop:${beats}`, pads);
      leds[`${d}:loop:${beats}`] = `n:${pads}:${0x60 + k}`;
    });
    map[`c:6:${d === "A" ? 0x17 : 0x18}`] = `${d}:filter`;
    map[`n:6:${d === "A" ? 0x46 : 0x47}`] = `${d}:load`;
    leds[`${d}:play`] = `n:${ch}:${0x0b}`;
    leds[`${d}:cue`] = `n:${ch}:${0x0c}`;
    leds[`${d}:phones`] = `n:${ch}:${0x54}`;
  });
  map["c:6:31"] = "mix:crossfader";
  map["c:6:13"] = "mix:phonesLevel";
  map["c:6:64"] = "mix:browse";
  return {
    id: "pioneer-ddj-400",
    name: "Pioneer DDJ-400 / DDJ-FLX4",
    port: /DDJ[-\s]?(400|FLX4)/i,
    map,
    leds,
    source: "Pioneer's rekordbox MIDI layout (as used by the open-source Mixxx mapping)",
  };
}

export const DJ_PROFILES: DjProfile[] = [pioneerDdj()];
export const djProfileFor = (portName: string | undefined | null) =>
  portName ? (DJ_PROFILES.find((p) => p.port.test(portName)) ?? null) : null;

export type DjEvent =
  { key: string; type: "press" | "release" } | { key: string; type: "value"; raw: number };

/** Turns raw MIDI bytes into a binding key and press/release/value. Pitch-bend and other messages are ignored. */
export function djEvent(status: number, d1: number, d2: number): DjEvent | null {
  const cmd = status & 0xf0,
    ch = status & 0x0f;
  if (cmd === 0x90) return { key: `n:${ch}:${d1}`, type: d2 > 0 ? "press" : "release" };
  if (cmd === 0x80) return { key: `n:${ch}:${d1}`, type: "release" };
  if (cmd === 0xb0) return { key: `c:${ch}:${d1}`, type: "value", raw: d2 };
  return null;
}

/** Learned bindings win over the controller's built-in layout. */
export function resolveDjAction(
  key: string,
  learned: Record<string, string>,
  profile: DjProfile | null,
): string | null {
  return learned[key] ?? profile?.map[key] ?? null;
}

/** Relative encoders: jog wheels usually centre on 64; browse knobs send 1, 2… forwards and 127, 126… backwards. */
export function relativeDelta(raw: number, style: "centre" | "signed"): number {
  if (style === "centre") return raw - 64;
  return raw < 64 ? raw : raw - 128;
}

/** Tempo slider (7-bit, or 14-bit with the fine message) to a pitch offset within ±range. Top of the slider = slower. */
export function tempoPitch(
  msb: number,
  lsb: number | null,
  range: number,
  reverse: boolean,
): number {
  const v = lsb == null ? msb / 127 : ((msb << 7) | lsb) / 16383;
  const p = (v * 2 - 1) * range;
  return Math.round((reverse ? -p : p) * 10000) / 10000;
}

/** Human-readable control name, e.g. "Note 11 · ch 1" or "CC 19 · ch 2". */
export function djKeyLabel(key: string): string {
  const [t, ch, num] = key.split(":");
  return `${t === "n" ? "Note" : "CC"} ${num} · ch ${Number(ch) + 1}`;
}

/** One key per action for learned controls: learning X onto a key replaces that key's old job and X's old key. */
export function learnBinding(
  learned: Record<string, string>,
  key: string,
  actionId: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(learned)) if (k !== key && v !== actionId) next[k] = v;
  next[key] = actionId;
  return next;
}

/** Whether a message may be learned for this kind of action (a knob needs a CC; a button accepts a press or a CC button). */
export function learnable(kind: DjActionKind, ev: DjEvent): boolean {
  if (kind === "knob" || kind === "jog" || kind === "browse") return ev.type === "value";
  return ev.type === "press" || (ev.type === "value" && ev.raw > 0);
}
