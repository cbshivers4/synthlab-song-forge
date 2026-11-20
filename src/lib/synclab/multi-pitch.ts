/**
 * Multi pitch: one sound spread across 16 pads, either one pitch per pad (SPREAD, like the
 * MPC's 16 Levels) or one chord per pad (CHORD). Pure helpers shared by the Sampler,
 * Pad Sampler and Video Sampler so every pad, key and recorded note agrees on its pitches.
 */

export type MultiPitchMode = "off" | "spread" | "chord";
export type MultiPitchScale = "chromatic" | "major" | "minor" | "pentatonic" | "minor-pentatonic";
export type MultiPitchChord =
  "diatonic" | "major" | "minor" | "power" | "sus4" | "maj7" | "min7" | "dom7" | "octaves";

export interface MultiPitchSettings {
  mode: MultiPitchMode;
  /** which sound the pads play: a pad number, chop number, or -1 for the whole sample */
  source: number;
  /** pad (0-15) that plays the sound at its original pitch */
  rootPad: number;
  scale: MultiPitchScale;
  chord: MultiPitchChord;
}

export const MULTI_PITCH_PADS = 16;
/** Pitches stay inside four octaves either way so the sample never becomes a click or a drone. */
export const MULTI_PITCH_LIMIT = 48;

export const DEFAULT_MULTI_PITCH: MultiPitchSettings = {
  mode: "off",
  source: 0,
  rootPad: 0,
  scale: "chromatic",
  chord: "diatonic",
};

export const SCALES: Record<MultiPitchScale, { label: string; steps: number[] }> = {
  chromatic: { label: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { label: "Major pentatonic", steps: [0, 2, 4, 7, 9] },
  "minor-pentatonic": { label: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
};

export const CHORDS: Record<
  MultiPitchChord,
  { label: string; short: string; intervals: number[] }
> = {
  diatonic: { label: "In key (scale chords)", short: "", intervals: [] },
  major: { label: "Major", short: "", intervals: [0, 4, 7] },
  minor: { label: "Minor", short: "m", intervals: [0, 3, 7] },
  power: { label: "Power (5th + octave)", short: "5", intervals: [0, 7, 12] },
  sus4: { label: "Sus 4", short: "sus4", intervals: [0, 5, 7] },
  maj7: { label: "Major 7", short: "maj7", intervals: [0, 4, 7, 11] },
  min7: { label: "Minor 7", short: "m7", intervals: [0, 3, 7, 10] },
  dom7: { label: "Dominant 7", short: "7", intervals: [0, 4, 7, 10] },
  octaves: { label: "Octaves", short: "8va", intervals: [0, 12] },
};

const clampPitch = (n: number) => Math.max(-MULTI_PITCH_LIMIT, Math.min(MULTI_PITCH_LIMIT, n));

/** Semitones for a scale degree; negative degrees walk down into lower octaves. */
export function scaleStep(degree: number, scale: MultiPitchScale): number {
  const steps = SCALES[scale].steps;
  const octave = Math.floor(degree / steps.length);
  const index = degree - octave * steps.length;
  return octave * 12 + (steps[index] ?? 0);
}

/** Semitone offset of a pad in SPREAD mode: the root pad is 0, each pad after it climbs the scale. */
export function padOffset(pad: number, settings: Pick<MultiPitchSettings, "rootPad" | "scale">) {
  return clampPitch(scaleStep(pad - settings.rootPad, settings.scale));
}

/** Chord tones (semitones from the original pitch) built on `root`. */
export function chordAt(root: number, scale: MultiPitchScale, chord: MultiPitchChord): number[] {
  if (chord === "diatonic") {
    const steps = SCALES[scale].steps;
    // A chromatic scale has no key, and a key with fewer than 7 notes stacks unevenly: use major triads.
    if (steps.length !== 7) return CHORDS.major.intervals.map((i) => clampPitch(root + i));
    const octave = Math.floor(root / 12);
    const within = root - octave * 12;
    const index = steps.indexOf(within);
    if (index < 0) return CHORDS.major.intervals.map((i) => clampPitch(root + i));
    const degree = octave * steps.length + index;
    return [0, 2, 4].map((d) => clampPitch(scaleStep(degree + d, scale)));
  }
  return CHORDS[chord].intervals.map((i) => clampPitch(root + i));
}

/** Every pitch a pad plays: one in SPREAD, the whole chord in CHORD, none when off. */
export function padPitches(pad: number, settings: MultiPitchSettings): number[] {
  if (settings.mode === "off") return [];
  const root = padOffset(pad, settings);
  return settings.mode === "chord" ? chordAt(root, settings.scale, settings.chord) : [root];
}

/**
 * Pitches for a played note `rel` semitones from the sampler's root note. Keys and recorded
 * notes carry the pad's root pitch, so CHORD mode rebuilds the same chord on playback.
 */
export function notePitches(rel: number, settings: MultiPitchSettings): number[] {
  if (settings.mode === "off") return [rel];
  return settings.mode === "chord"
    ? chordAt(rel, settings.scale, settings.chord)
    : [clampPitch(rel)];
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "+3", "0", "-5" */
export const semitoneLabel = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Chord name for a pad, e.g. "Am" when the original sound is C and the pad is 9 semitones up. */
export function chordName(pitches: number[], rootNote = 60): string {
  if (!pitches.length) return "";
  const root = pitches[0] as number;
  const name = NAMES[(((rootNote + root) % 12) + 12) % 12] ?? "";
  const third = pitches[1] !== undefined ? (pitches[1] as number) - root : null;
  const fifth = pitches[2] !== undefined ? (pitches[2] as number) - root : null;
  if (pitches.length === 2 && third === 12) return `${name} 8va`;
  if (third === 7 && fifth === 12) return `${name}5`;
  if (third === 5) return `${name}sus4`;
  const minor = third === 3;
  const dim = minor && fifth === 6;
  const seventh = pitches[3] !== undefined ? (pitches[3] as number) - root : null;
  if (seventh === 11) return `${name}maj7`;
  if (seventh === 10) return `${name}${minor ? "m7" : "7"}`;
  return `${name}${dim ? "dim" : minor ? "m" : ""}`;
}

/** Voice keys for a pad's notes, so pressing again or releasing stops exactly that pad's voices. */
export const multiPitchVoiceKeys = (base: string, count = 4) =>
  Array.from({ length: count }, (_, i) => `${base}~${i}`);

/** Keeps a saved or edited setting inside its valid range. */
export function normalizeMultiPitch(
  value: Partial<MultiPitchSettings> | undefined,
): MultiPitchSettings {
  const v = { ...DEFAULT_MULTI_PITCH, ...(value ?? {}) };
  return {
    mode: v.mode === "spread" || v.mode === "chord" ? v.mode : "off",
    source: Number.isInteger(v.source) && v.source >= -1 ? v.source : 0,
    rootPad:
      Number.isInteger(v.rootPad) && v.rootPad >= 0 && v.rootPad < MULTI_PITCH_PADS ? v.rootPad : 0,
    scale: v.scale in SCALES ? v.scale : "chromatic",
    chord: v.chord in CHORDS ? v.chord : "diatonic",
  };
}
