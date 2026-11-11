/**
 * Factory sound designs layered onto existing presets by name:
 * - ARP_DESIGNS gives every arpeggio/sequence preset its own groove (speed, direction, rhythm, riff),
 *   so no two arps play the same pattern;
 * - PIANO_DESIGNS turns the piano/electric-piano presets into the modelled piano engine.
 */
import type { SynthPatch } from "./types";
import type { PianoModel } from "./piano-voice";
import { ARP_NOTE_PATTERNS, ARP_RHYTHMS } from "./arp-pattern";

type Dir = SynthPatch["arp"]["direction"];
/** [rate (notes per 16th), direction, octaves, gate, swing, rhythm id, note pattern id] */
export type ArpDesign = [number, Dir, number, number, number, string, string];

export const ARP_DESIGNS: Record<string, ArpDesign> = {
  // Spec 4
  "Night Arp": [1, "updown", 2, 0.5, 0, "skip", "chord"],
  "Motor City Sequence": [1, "up", 1, 0.45, 0, "straight", "electro"],
  "Belle Isle Pulse": [0.5, "updown", 1, 0.7, 0, "pulse-hold", "sus"],
  "Woodward Run": [1.5, "up", 3, 0.4, 0, "straight", "chord"],
  "Eastside Ostinato": [1, "alternate", 1, 0.55, 0, "gallop", "pedal"],
  "Grand River Gate": [1, "down", 2, 0.3, 0.2, "trance-gate", "chord"],
  "Riverfront Sequencer": [1, "random", 2, 0.5, 0, "morse", "minor-pent"],
  "Cass Corridor Stepper": [1, "up", 1, 0.35, 0.3, "funk", "call-answer"],
  "Midnight Mover": [0.5, "up", 1, 0.8, 0, "long-short", "dub"],
  "Trance Arp": [1, "up", 2, 0.45, 0, "accent4", "octave"],
  "Chip Arp": [2, "up", 2, 0.5, 0, "stutter", "major-pent"],
  "Dark Sequence": [1, "up", 1, 0.4, 0, "rolling", "acid"],
  "Glass Arp": [0.667, "up", 3, 0.5, 0, "straight", "two-octaves"],
  "Berlin School": [1, "up", 1, 0.5, 0, "straight", "berlin"],
  "Plucky Arp": [1, "updown", 2, 0.3, 0, "reverse-gallop", "chord"],
  "Wide Arp": [1, "up", 2, 0.6, 0, "dotted", "fifths"],
  "Minor Pulse": [1, "down", 1, 0.5, 0, "offbeat", "octave-drop"],
  "Sparkle Arp": [1.5, "random", 3, 0.3, 0, "straight", "sparkle"],
  "Driving 16ths": [1, "up", 1, 0.6, 0, "accent4", "root-fifth-oct"],
  "Cascade Arp": [1.5, "down", 3, 0.4, 0, "straight", "fall"],
  "Pluck Ladder Arp": [1, "up", 3, 0.3, 0, "push", "climb"],
  "Euphoria Arp": [1, "up", 2, 0.5, 0, "rolling", "sus"],
  "Midnight Broken Chord": [0.5, "alternate", 2, 0.7, 0, "clave", "chord"],
  "Bubble Arp": [2, "updown", 1, 0.25, 0, "gallop", "fifths"],
  "Hex Grid Sequence": [1, "up", 2, 0.35, 0, "morse", "two-octaves"],
  "Pulse Lattice Sequence": [2, "updown", 1, 0.3, 0, "sparse", "climb"],
  "Night Shift Sequence": [1, "alternate", 2, 0.5, 0.2, "skip", "acid"],
  "Crystal Step Sequence": [0.75, "up", 3, 0.35, 0, "dotted", "sus"],
  "Offbeat Machine Sequence": [1, "down", 1, 0.4, 0.1, "dembow", "root-fifth-oct"],
  "Rolling Ostinato": [1, "up", 2, 0.6, 0, "clave", "pedal"],
  // Poly Synth
  "Poly Arp Belleville Run": [1, "up", 2, 0.5, 0, "gallop", "root-fifth-oct"],
  "Poly Arp Glass Cascade": [2, "down", 3, 0.35, 0, "rolling", "two-octaves"],
  "Poly Arp Bounce": [1, "updown", 2, 0.35, 0, "reverse-gallop", "octave"],
  "Poly Arp Random Stars": [1, "random", 3, 0.3, 0, "sparse", "sparkle"],
  "Poly Arp Motor City Pulse": [1, "alternate", 1, 0.6, 0, "tresillo", "pedal"],
  "Poly Arp Trance Gate": [1, "up", 1, 0.8, 0, "trance-gate", "sus"],
  "Poly Rhythm Stab Sequence": [1, "chord", 1, 0.25, 0, "tresillo", "chord"],
  "Poly Synth Classic Arp": [1, "up", 2, 0.45, 0, "straight", "chord"],
  "Poly Synth Sparkle Arp": [2, "up", 3, 0.3, 0, "accent4", "two-octaves"],
  "Poly Synth Rising Arp": [1, "up", 3, 0.4, 0, "rolling", "climb"],
  "Poly Synth Dream Arp": [0.75, "updown", 2, 0.6, 0, "skip", "major-pent"],
  "Poly Synth Synthwave Arp": [1, "updown", 2, 0.45, 0, "accent4", "octave-drop"],
  "Poly Synth Laser Rain": [2, "random", 3, 0.3, 0, "stutter", "fall"],
  "Poly Synth Chord Sequencer": [1, "chord", 1, 0.5, 0, "funk", "chord"],
  "Poly Synth Offbeat Chords Seq": [1, "chord", 1, 0.4, 0.2, "offbeat", "chord"],
  "Poly Synth Analog Step Seq": [1, "up", 2, 0.5, 0, "long-short", "berlin"],
  "Poly Synth Dub Chord Seq": [1, "chord", 2, 0.35, 0, "push", "dub"],
};

export function applyArpDesign(p: SynthPatch, d: ArpDesign) {
  const [rate, direction, octaves, gate, swing, rhythmId, notesId] = d;
  const rhythm = ARP_RHYTHMS.find((r) => r.id === rhythmId)?.steps ?? "";
  const notes = ARP_NOTE_PATTERNS.find((n) => n.id === notesId)?.notes ?? [];
  p.arp = { on: true, rate, direction, octaves, gate, sync: true, ...(swing ? { swing } : {}), ...(rhythm ? { rhythm } : {}), ...(notes.length ? { notes: [...notes] } : {}) };
  // chord hits stack voices: keep each one a bit lower so stabs don't overload the channel
  if (direction === "chord") p.oscillators = p.oscillators.map((o) => ({ ...o, level: o.level * 0.7 }));
}

/* ---------------- pianos ---------------- */

export interface PianoDesign {
  model: PianoModel;
  level?: number;
  cutoff?: number;
  release?: number;
  reverb?: number;
  chorus?: number;
  delay?: number;
  crush?: number;
  /** stereo tremolo (suitcase EP): [rate Hz, depth] */
  pan?: [number, number];
  /** volume tremolo (Wurlitzer vibrato): [rate Hz, depth] */
  trem?: [number, number];
}

/** Existing presets turned into real pianos, plus new ones (marked new: true). */
export const PIANO_DESIGNS: Record<string, PianoDesign & { poly?: boolean; fresh?: boolean }> = {
  // existing names (Live Keys uses Grand-ish Piano, Rhodes Soul and Wurli Warm)
  "Grand-ish Piano": { model: "grand", reverb: 0.22 },
  "Digital Piano": { model: "bright", reverb: 0.16, chorus: 0.12 },
  "Electric Piano": { model: "tine", chorus: 0.15, pan: [4.5, 0.25], reverb: 0.18 },
  "Mellow Rhodes": { model: "tine", cutoff: 3200, chorus: 0.3, reverb: 0.3 },
  "Rhodes Soul": { model: "tine", pan: [3.5, 0.4], reverb: 0.25 },
  "Crystal EP": { model: "tine", chorus: 0.4, delay: 0.18, reverb: 0.3 },
  "Wurli Warm": { model: "reed", cutoff: 5000, trem: [5.5, 0.12], reverb: 0.2 },
  "Wurly": { model: "reed", trem: [6, 0.18], reverb: 0.15 },
  "Toy Piano": { model: "toy", reverb: 0.3 },
  "Poly Synth Stage Piano": { model: "bright", chorus: 0.1, reverb: 0.2, poly: true },
  "Poly Synth Analog EP": { model: "tine", chorus: 0.25, reverb: 0.25, poly: true },
  "Poly Keys Electric Glow": { model: "tine", pan: [4, 0.3], chorus: 0.3, reverb: 0.3, poly: true },
  // new Spec 4 pianos
  "Concert Grand": { model: "grand", release: 0.4, reverb: 0.28, fresh: true },
  "Ballad Grand Hall": { model: "grand", release: 0.6, reverb: 0.5, fresh: true },
  "Dark Studio Grand": { model: "grand", cutoff: 3500, reverb: 0.18, fresh: true },
  "Bright Pop Grand": { model: "bright", reverb: 0.18, fresh: true },
  "Felt Piano": { model: "felt", cutoff: 6000, release: 0.45, reverb: 0.35, fresh: true },
  "Lo-Fi Felt Keys": { model: "felt", cutoff: 2600, crush: 0.08, reverb: 0.3, fresh: true },
  "Upright Parlor Piano": { model: "upright", reverb: 0.2, fresh: true },
  "Honky-Tonk Saloon Piano": { model: "honky", reverb: 0.15, fresh: true },
  "Suitcase Tine EP": { model: "tine", pan: [5, 0.55], reverb: 0.2, fresh: true },
  "Stage Tine EP": { model: "tine", chorus: 0.1, reverb: 0.15, fresh: true },
  "Reed EP Bark": { model: "reed", trem: [5, 0.08], reverb: 0.12, fresh: true },
  "Music Box Toy Piano": { model: "toy", reverb: 0.45, delay: 0.15, fresh: true },
  // new Poly Synth pianos
  "Poly Synth Concert Grand": { model: "grand", release: 0.4, reverb: 0.3, poly: true, fresh: true },
  "Poly Synth Felt Piano": { model: "felt", cutoff: 5000, reverb: 0.4, poly: true, fresh: true },
  "Poly Synth Upright Piano": { model: "upright", reverb: 0.22, poly: true, fresh: true },
  "Poly Synth Honky-Tonk Piano": { model: "honky", reverb: 0.18, poly: true, fresh: true },
  "Poly Synth Suitcase EP": { model: "tine", pan: [4.2, 0.5], chorus: 0.15, reverb: 0.22, poly: true, fresh: true },
  "Poly Synth Reed EP": { model: "reed", trem: [5.8, 0.14], reverb: 0.18, poly: true, fresh: true },
};

export function applyPiano(p: SynthPatch, c: PianoDesign) {
  p.oscillators = p.oscillators.map((o) => ({ ...o, on: false }));
  p.noise = 0;
  p.piano = { model: c.model, level: c.level ?? 1 };
  p.filterType = "lowpass";
  p.cutoff = c.cutoff ?? 16000;
  p.resonance = 0.7;
  p.keyTracking = 0;
  p.drive = 0;
  p.filter2 = undefined;
  p.filterEnv = { attack: 0.001, decay: 0.3, sustain: 1, release: 0.3, amount: 0 };
  p.amp = { attack: 0.001, decay: 1, sustain: 1, release: c.release ?? 0.32 };
  p.lfos = p.lfos.map((l, i) =>
    i === 0 && c.pan ? { ...l, on: true, destination: "pan", rate: c.pan[0], wave: "sine", amount: c.pan[1], sync: false }
      : i === 1 && c.trem ? { ...l, on: true, destination: "volume", rate: c.trem[0], wave: "sine", amount: c.trem[1], sync: false }
      : { ...l, on: false });
  p.unison = { voices: 1, detune: 0, width: 0 };
  p.glide = 0;
  p.voiceMode = "poly";
  p.analog = 0.05;
  p.velocitySens = 0.7;
  p.fx = { ...p.fx, distortion: 0, saturation: 0, chorus: c.chorus ?? 0, flanger: 0, phaser: 0, delay: c.delay ?? 0, delayFeedback: 0.3, reverb: c.reverb ?? 0.18, bitcrush: c.crush ?? 0 };
  p.arp = { ...p.arp, on: false };
  p.clean = true;
}
