/**
 * MPC-style pad tools shared by the Sampler, Pad Sampler and Video Sampler: the per-pad sound
 * settings (tune, fine, level, pan, envelopes, filter, velocity, poly/mono, mute), Note Repeat
 * timing with swing, and pattern swing. Pure math lives here so it is tested once and every
 * sampler plays the same way.
 */

export type PadFilterType = "off" | "lowpass" | "highpass" | "bandpass" | "notch";

/** Sound settings a pad (or a chop) can carry on top of its sample and trim. */
export interface PadSound {
  gain: number;
  /** coarse tune in semitones */
  pitch: number;
  /** fine tune in cents (−100…100) */
  fine?: number | undefined;
  /** −1 left … 1 right */
  pan?: number | undefined;
  reverse: boolean;
  loop: boolean;
  /** true = plays to the end (one-shot); false = note-on, stops when you let go */
  oneShot: boolean;
  attack: number;
  decay?: number | undefined;
  sustain?: number | undefined;
  release: number;
  fadeIn?: number | undefined;
  fadeOut?: number | undefined;
  filterType?: PadFilterType | undefined;
  cutoff?: number | undefined;
  resonance?: number | undefined;
  /** filter envelope depth in octaves (−4…4): the cutoff starts this far away and sweeps back */
  filterEnv?: number | undefined;
  filterDecay?: number | undefined;
  /** pitch envelope depth in semitones (−24…24): the note starts this far away and glides back */
  pitchEnv?: number | undefined;
  pitchDecay?: number | undefined;
  /** how much velocity changes the level: 0 = every hit full, 1 = fully dynamic */
  velSens?: number | undefined;
  /** how much velocity opens the filter, in octaves at full velocity (0…4) */
  velFilter?: number | undefined;
  /** 0 = no group; pads in the same group cut each other off */
  choke: number;
  /** poly lets repeated hits ring over each other; mono (default) cuts the last hit */
  poly?: boolean | undefined;
  /** pad mute: the pad stays loaded but makes no sound */
  mute?: boolean | undefined;
  /** BPM the sample was played at, for Follow song tempo */
  sampleBpm?: number | undefined;
  /** follow the song tempo by repitching (speed and pitch together) */
  syncToBpm?: boolean | undefined;
}

export const DEFAULT_PAD_SOUND: PadSound = {
  gain: 1,
  pitch: 0,
  fine: 0,
  pan: 0,
  reverse: false,
  loop: false,
  oneShot: true,
  attack: 0.002,
  decay: 0,
  sustain: 1,
  release: 0.08,
  fadeIn: 0,
  fadeOut: 0,
  filterType: "off",
  cutoff: 18000,
  resonance: 0.7,
  filterEnv: 0,
  filterDecay: 0.3,
  pitchEnv: 0,
  pitchDecay: 0.15,
  velSens: 1,
  velFilter: 0,
  choke: 0,
  poly: false,
  mute: false,
  sampleBpm: 120,
  syncToBpm: false,
};

/** Value ranges for every pad knob — the UI and MIDI-learned controllers share them. */
export const PAD_SOUND_RANGES = {
  gain: [0, 2, 0.01],
  pitch: [-24, 24, 1],
  fine: [-100, 100, 1],
  pan: [-1, 1, 0.01],
  attack: [0, 2, 0.001],
  decay: [0, 3, 0.005],
  sustain: [0, 1, 0.01],
  release: [0.005, 4, 0.005],
  fadeIn: [0, 2, 0.005],
  fadeOut: [0, 2, 0.005],
  resonance: [0.1, 20, 0.1],
  filterEnv: [-4, 4, 0.05],
  filterDecay: [0.01, 3, 0.01],
  pitchEnv: [-24, 24, 0.5],
  pitchDecay: [0.01, 2, 0.01],
  velSens: [0, 1, 0.01],
  velFilter: [0, 4, 0.05],
  choke: [0, 8, 1],
  sampleBpm: [40, 240, 1],
} as const satisfies Record<string, readonly [number, number, number]>;

export type PadSoundRangeKey = keyof typeof PAD_SOUND_RANGES;

/** Semitones the engine plays: coarse tune plus fine cents. */
export const padTune = (s: Pick<PadSound, "pitch" | "fine">) =>
  (s.pitch || 0) + (s.fine ?? 0) / 100;

/** Level for a hit: velocity sensitivity 0 plays every hit at full level. */
export function velocityLevel(velocity: number, sens = 1) {
  const v = Math.max(0, Math.min(1, velocity));
  const k = Math.max(0, Math.min(1, sens));
  return 1 - k + k * v;
}

/** Filter cutoff for a hit: velocity opens it by up to `velFilter` octaves, capped at 20 kHz. */
export function velocityCutoff(cutoff: number, velocity: number, velFilter = 0) {
  const v = Math.max(0, Math.min(1, velocity));
  return Math.max(20, Math.min(20000, cutoff * Math.pow(2, Math.max(0, velFilter) * v)));
}

/** What one Sampler chop can change on top of the whole sample (MPC per-pad edit). */
export interface ChopSound {
  pitch?: number | undefined;
  fine?: number | undefined;
  gain?: number | undefined;
  pan?: number | undefined;
  reverse?: boolean | undefined;
  mute?: boolean | undefined;
}

/**
 * Sample settings for one chop: tune adds to the sample's tune, level multiplies, pan and reverse
 * replace. Returns null for a muted chop.
 */
export function applyChopSound<
  T extends {
    gain: number;
    pitch: number;
    reverse: boolean;
    fine?: number | undefined;
    pan?: number | undefined;
  },
>(base: T, chop: ChopSound | undefined): T | null {
  if (!chop) return base;
  if (chop.mute) return null;
  return {
    ...base,
    pitch: base.pitch + (chop.pitch ?? 0),
    fine: (base.fine ?? 0) + (chop.fine ?? 0),
    gain: Math.max(0, Math.min(2, base.gain * (chop.gain ?? 1))),
    pan: chop.pan ?? base.pan ?? 0,
    reverse: chop.reverse ?? base.reverse,
  };
}

/**
 * Keeps each chop's own sound when the chops change: moving markers (same number of chops) keeps
 * them by number; adding or removing chops keeps the ones whose start point is still there.
 */
export function reconcileChopSounds(
  before: number[] | undefined,
  after: number[] | undefined,
  sounds: Record<number, ChopSound> | undefined,
): Record<number, ChopSound> | undefined {
  if (!sounds || !Object.keys(sounds).length) return sounds;
  const a = before ?? [];
  const b = after ?? [];
  if (a.length === b.length) return sounds;
  const out: Record<number, ChopSound> = {};
  for (const [key, sound] of Object.entries(sounds)) {
    const start = a[Number(key)];
    if (start === undefined) continue;
    const at = b.findIndex((x) => Math.abs(x - start) < 1e-4);
    if (at >= 0) out[at] = sound;
  }
  return out;
}

/* ───────────── Note Repeat ───────────── */

export const REPEAT_RATES = [
  { id: "1/4", label: "1/4", beats: 1 },
  { id: "1/4T", label: "1/4T", beats: 2 / 3 },
  { id: "1/8", label: "1/8", beats: 1 / 2 },
  { id: "1/8T", label: "1/8T", beats: 1 / 3 },
  { id: "1/16", label: "1/16", beats: 1 / 4 },
  { id: "1/16T", label: "1/16T", beats: 1 / 6 },
  { id: "1/32", label: "1/32", beats: 1 / 8 },
  { id: "1/32T", label: "1/32T", beats: 1 / 12 },
] as const;

export type RepeatRateId = (typeof REPEAT_RATES)[number]["id"];

export interface NoteRepeatSettings {
  on: boolean;
  rate: RepeatRateId;
  /** MPC swing: 50 = straight, up to 75 = heavy shuffle */
  swing: number;
}

export const DEFAULT_NOTE_REPEAT: NoteRepeatSettings = { on: false, rate: "1/16", swing: 50 };

export const clampSwing = (swing: number) =>
  Math.max(50, Math.min(75, Number.isFinite(swing) ? swing : 50));

/** Seconds between repeats at a tempo. */
export function repeatInterval(rate: RepeatRateId, bpm: number) {
  const beats = REPEAT_RATES.find((r) => r.id === rate)?.beats ?? 0.25;
  return (60 / Math.max(20, bpm || 120)) * beats;
}

/**
 * Time (seconds from the first hit) of repeat hit `k`. Hits come in pairs: the first of each
 * pair sits on the grid and the second is pushed later by swing, the way an MPC swings 16ths.
 */
export function repeatOffset(k: number, interval: number, swing = 50) {
  const pair = Math.floor(k / 2);
  const second = k % 2 === 1;
  return pair * 2 * interval + (second ? 2 * interval * (clampSwing(swing) / 100) : 0);
}

/** Start time of pattern step `step` with swing (odd steps are delayed). */
export function swungStepTime(step: number, stepDuration: number, swing = 50) {
  return repeatOffset(step, stepDuration, swing);
}

/**
 * Note Repeat: while a pad is held it keeps re-triggering on the audio clock at the chosen
 * rate and swing. `fire` receives the exact audio time of each hit (the first one is now).
 */
export function createNoteRepeater(opts: {
  now: () => number;
  bpm: () => number;
  settings: () => NoteRepeatSettings;
  fire: (id: string, when: number, velocity: number) => void;
  lookAhead?: number;
}) {
  const held = new Map<string, { anchor: number; k: number; velocity: number; interval: number }>();
  let timer: ReturnType<typeof setInterval> | null = null;
  // Hits are queued just in time (well under one repeat), so letting go never leaves extra
  // hits queued and a mono pad's next hit can't cut off one that hasn't started yet.
  const lookAheadFor = (interval: number) => Math.min(opts.lookAhead ?? 0.035, interval * 0.6);
  const pump = () => {
    const now = opts.now();
    const s = opts.settings();
    for (const [id, h] of held) {
      const interval = repeatInterval(s.rate, opts.bpm());
      if (interval !== h.interval) {
        // Tempo or rate changed: carry on from the next hit at the new spacing.
        const nextAt = h.anchor + repeatOffset(h.k, h.interval, s.swing);
        h.anchor = nextAt - repeatOffset(h.k % 2, interval, s.swing);
        h.k = h.k % 2;
        h.interval = interval;
      }
      let at = h.anchor + repeatOffset(h.k, h.interval, s.swing);
      // After a long stall, skip missed hits along the grid instead of firing them all at once.
      while (at < now - 0.05) {
        h.k++;
        at = h.anchor + repeatOffset(h.k, h.interval, s.swing);
      }
      while (at < now + lookAheadFor(h.interval)) {
        opts.fire(id, at, h.velocity);
        h.k++;
        at = h.anchor + repeatOffset(h.k, h.interval, s.swing);
      }
    }
  };
  return {
    /** Starts repeating `id` (fires the first hit immediately). */
    press(id: string, velocity = 1) {
      const now = opts.now();
      const interval = repeatInterval(opts.settings().rate, opts.bpm());
      held.set(id, { anchor: now, k: 0, velocity, interval });
      pump();
      if (!timer) timer = setInterval(pump, 10);
    },
    release(id: string) {
      held.delete(id);
      if (!held.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    releaseAll() {
      held.clear();
      if (timer) clearInterval(timer);
      timer = null;
    },
    isHeld: (id: string) => held.has(id),
  };
}

/** Keeps a saved pad sound inside valid ranges (old projects simply get the defaults). */
export function normalizePadSound<T extends Partial<PadSound>>(value: T): T & PadSound {
  const v = { ...DEFAULT_PAD_SOUND, ...value } as T & PadSound;
  for (const [key, [min, max]] of Object.entries(PAD_SOUND_RANGES)) {
    const k = key as PadSoundRangeKey;
    const n = v[k];
    if (typeof n === "number")
      (v as unknown as Record<string, unknown>)[k] = Number.isFinite(n)
        ? Math.max(min, Math.min(max, n))
        : DEFAULT_PAD_SOUND[k];
  }
  return v;
}
