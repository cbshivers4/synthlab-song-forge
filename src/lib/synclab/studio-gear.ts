/**
 * Connected gear for Studio View: what the browser can actually report (MIDI ports, audio input
 * names) plus what the user says is plugged into their interface (a browser can't see a guitar
 * on the end of a cable). Pure so the classification is tested; the "plugged in" list is device-only.
 */
import { useSyncExternalStore } from "react";
import { cleanDeviceLabel, isInterfaceLabel } from "./audio-interface-detect";

export type GearKind =
  | "keyboard"
  | "pads"
  | "synth"
  | "dj"
  | "controller"
  | "guitar"
  | "bass"
  | "mic"
  | "drum"
  | "interface"
  | "headset";
/** how it reaches the computer: usb/bluetooth/network are reported names; "cable" is a user-declared jack into the interface */
export type GearLink = "usb" | "bluetooth" | "network" | "cable" | "built-in";

export interface Gear {
  id: string;
  kind: GearKind;
  name: string;
  link: GearLink;
  /** the interface a cabled instrument goes through */
  via?: string | undefined;
  /** shown on the cable label: "1/4\" cable → Input 1" */
  detail: string;
  /** true when the browser reported it, false when the user told us */
  reported: boolean;
}

export const GEAR_LABEL: Record<GearKind, string> = {
  keyboard: "Keyboard controller",
  pads: "Pad controller",
  synth: "Hardware synth",
  dj: "DJ controller",
  controller: "MIDI controller",
  guitar: "Electric guitar",
  bass: "Bass guitar",
  mic: "Microphone",
  drum: "Drum machine",
  interface: "Audio interface",
  headset: "Headset",
};
export const LINK_LABEL: Record<GearLink, string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  network: "Network MIDI",
  cable: "Cable",
  "built-in": "Built-in",
};

const PAD = /\b(mpd|maschine|launchpad|push|apc|pads?|fire|lpd|beatstep|circuit)(?![a-z])/i;
const DJ = /\b(ddj|djm|xdj|traktor|kontrol s\d|mixtrack|inpulse|flx\d|rane|numark|hercules dj)\b/i;
const SYNTH =
  /\b(minilogue|monologue|prologue|korg|prophet|sequential|juno|jupiter|system-?\d|moog|subsequent|grandmother|matriarch|minimoog|nord|hydrasynth|digitone|digitakt|elektron|microfreak|minifreak|op-?1|volca|deepmind|behringer|waldorf|opsix|wavestate|summit|peak|polybrute|td-3|tr-8|mc-\d)\b/i;
const KEYS =
  /\b(keystep|keylab|mpk|oxygen|launchkey|komplete kontrol|keystation|a-?\d{2}|seaboard|lumi|minilab|nektar|impact|code\s?\d\d|key|keys|piano|digital piano|stage)\b/i;

export function classifyMidi(name: string): GearKind {
  if (DJ.test(name)) return "dj";
  if (PAD.test(name)) return "pads";
  if (SYNTH.test(name)) return "synth";
  if (KEYS.test(name)) return "keyboard";
  return "controller";
}

export function midiLink(name: string): GearLink {
  if (/bluetooth|\bble\b|\bbt\b|widi|wireless/i.test(name)) return "bluetooth";
  if (/network|session|rtp|wi-?fi/i.test(name)) return "network";
  return "usb";
}

/** OS/virtual ports that aren't hardware sitting in the room */
const VIRTUAL = /\b(iac|through|thru|loopmidi|virtual|microsoft gs|midi mapper|wavetable)\b/i;

export function audioLink(label: string): GearLink {
  if (/bluetooth|airpods|\bbt\b|hands-?free|wireless|buds/i.test(label)) return "bluetooth";
  if (/built-?in|internal|macbook|default|realtek|array|webcam|facetime/i.test(label))
    return "built-in";
  return "usb";
}

export interface PluggedIn {
  id: string;
  kind: Extract<GearKind, "guitar" | "bass" | "mic" | "keyboard" | "synth" | "drum">;
  input: number;
  name?: string;
}

export function connectedGear(o: {
  midiInputs: { id: string; name: string }[];
  midiOutputs: { id: string; name: string }[];
  audioInputs: { label: string }[];
  interfaceName: string | null;
  plugged: PluggedIn[];
}): Gear[] {
  const gear: Gear[] = [];
  // one entry per MIDI device even when it shows up as both an input and an output
  const seen = new Set<string>();
  for (const port of [...o.midiInputs, ...o.midiOutputs]) {
    const name =
      port.name.replace(/\s+(midi\s*)?(in|out|input|output|port\s*\d+|\d+)$/i, "").trim() ||
      port.name;
    const key = name.toLowerCase();
    if (seen.has(key) || VIRTUAL.test(name)) continue;
    seen.add(key);
    const link = midiLink(port.name);
    gear.push({
      id: `midi:${key}`,
      kind: classifyMidi(name),
      name,
      link,
      detail:
        link === "bluetooth"
          ? "Bluetooth MIDI"
          : link === "network"
            ? "Network MIDI session"
            : "USB-MIDI cable",
      reported: true,
    });
  }
  if (o.interfaceName) {
    gear.push({
      id: "audio:interface",
      kind: "interface",
      name: o.interfaceName,
      link: "usb",
      detail: "USB cable",
      reported: true,
    });
  }
  for (const d of o.audioInputs) {
    const label = cleanDeviceLabel(d.label);
    if (!label || isInterfaceLabel(d.label) || audioLink(d.label) !== "bluetooth") continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    gear.push({
      id: `audio:${key}`,
      kind: "headset",
      name: label,
      link: "bluetooth",
      detail: "Bluetooth audio",
      reported: true,
    });
  }
  for (const p of o.plugged) {
    const via = o.interfaceName ?? undefined;
    const jack =
      p.kind === "mic"
        ? "XLR cable"
        : p.kind === "keyboard" || p.kind === "synth" || p.kind === "drum"
          ? '1/4" line cable'
          : '1/4" instrument cable';
    gear.push({
      id: `plug:${p.id}`,
      kind: p.kind,
      name: p.name?.trim() || GEAR_LABEL[p.kind],
      link: "cable",
      via,
      detail: `${jack} → ${via ? `${via} ` : ""}Input ${p.input}`,
      reported: false,
    });
  }
  return gear;
}

/* ---- device-only list of what the user has plugged into their interface ---- */
const KEY = "synclab.studio-gear";
let cached: PluggedIn[] | null = null;
const subs = new Set<() => void>();
const EMPTY: PluggedIn[] = [];
export function pluggedGear(): PluggedIn[] {
  if (cached) return cached;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    cached = Array.isArray(v) ? v : [];
  } catch {
    cached = [];
  }
  return cached;
}
export function setPluggedGear(next: PluggedIn[]) {
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  for (const fn of subs) fn();
}
export function usePluggedGear(): PluggedIn[] {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    pluggedGear,
    () => EMPTY,
  );
}
