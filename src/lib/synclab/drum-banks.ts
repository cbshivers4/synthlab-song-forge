import type { DrumPad, DrumSequence, Track } from './types';

export const DRUM_BANK_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const DRUM_PATTERN_LABELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
type SequenceTrack = Pick<Track, 'pads' | 'steps' | 'patternRegion' | 'activeDrumPattern' | 'activeDrumSequence' | 'drumSequences'>;
const slot = (value = 0) => Math.max(0, Math.min(7, value));

function captureSequence(track: SequenceTrack): DrumSequence {
  return structuredClone({ steps: track.steps, patternRegion: track.patternRegion, hits: Object.fromEntries((track.pads ?? []).map(pad => [pad.id, {
    steps: pad.steps, probability: pad.probability, stepPitch: pad.stepPitch,
    stepDecay: pad.stepDecay, flam: pad.flam, retrig: pad.retrig, glitch: pad.glitch,
  }])) });
}

function saveSequence(track: SequenceTrack) {
  const sequences = structuredClone(track.drumSequences ?? []);
  const bank = slot(track.activeDrumPattern);
  const patterns = sequences[bank] ?? Array.from({ length: 8 }, () => undefined);
  patterns[slot(track.activeDrumSequence)] = captureSequence(track);
  sequences[bank] = patterns;
  return sequences;
}

function applySequence(pads: DrumPad[], steps: number, sequence?: DrumSequence) {
  return pads.map(pad => {
    const hits = sequence?.hits[pad.id];
    return { ...pad, steps: Array.from({ length: steps }, (_, i) => hits?.steps[i] ?? 0),
      probability: hits?.probability, stepPitch: hits?.stepPitch, stepDecay: hits?.stepDecay,
      flam: hits?.flam, retrig: hits?.retrig, glitch: hits?.glitch };
  });
}

/** Recall rhythms without replacing a single sound, pad ID or sample reference. */
export function recallDrumSequence(track: SequenceTrack, next: number, copy = false) {
  const drumSequences = saveSequence(track);
  const bank = slot(track.activeDrumPattern);
  const destination = slot(next);
  if (copy) {
    const patterns = drumSequences[bank];
    if (patterns) patterns[destination] = captureSequence(track);
  }
  const sequence = drumSequences[bank]?.[destination];
  const steps = sequence?.steps ?? track.steps;
  return { drumSequences, activeDrumSequence: destination, steps,
    patternRegion: sequence?.patternRegion, pads: applySequence(track.pads ?? [], steps, sequence) };
}

/** One-time reset requested for legacy prefilled banks; A is never changed. */
export function initializeDrumBanks(track: Pick<Track, 'pads' | 'drumPatterns' | 'activeDrumPattern' | 'drumBanksVersion'>) {
  if (track.drumBanksVersion === 1) return undefined;
  const active = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const bankA = structuredClone(active === 0 ? track.pads ?? [] : track.drumPatterns?.[0] ?? []);
  const drumPatterns = [bankA, ...Array.from({ length: 7 }, () => [] as DrumPad[])];
  return { drumPatterns, pads: active === 0 ? bankA : [], drumBanksVersion: 1 };
}

/** Bank recall preserves user-created banks; a never-used bank has no pads. */
export function recallDrumBank(track: Pick<Track, 'pads' | 'drumPatterns' | 'activeDrumPattern' | 'steps'> & Partial<SequenceTrack>, next: number) {
  const active = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const destination = Math.max(0, Math.min(7, next));
  const drumPatterns = structuredClone(track.drumPatterns ?? []);
  drumPatterns[active] = structuredClone(track.pads ?? []);
  let pads = (drumPatterns[destination] ?? []).map(pad => ({ ...pad, steps: Array.from({ length: track.steps }, (_, i) => pad.steps[i] ?? 0) }));
  const drumSequences = saveSequence(track);
  // Legacy bank hits become Pattern 1 once; unused patterns never clone them.
  if (!drumSequences[destination]?.[0]) {
    const patterns = drumSequences[destination] ?? Array.from({ length: 8 }, () => undefined);
    patterns[0] = captureSequence({ ...track, pads });
    drumSequences[destination] = patterns;
  }
  const sequence = drumSequences[destination]?.[slot(track.activeDrumSequence)];
  const steps = sequence?.steps ?? track.steps;
  pads = applySequence(pads, steps, sequence);
  drumPatterns[destination] = structuredClone(pads);
  return { pads, drumPatterns, activeDrumPattern: destination, drumSequences, steps, patternRegion: sequence?.patternRegion };
}

export function appendDrumPad(track: Pick<Track, 'pads' | 'steps'>, id: string, sound: Partial<DrumPad> = {}): DrumPad[] {
  return [...(track.pads ?? []), {
    name: `PAD ${(track.pads?.length ?? 0) + 1}`, kind: 'perc', volume: 0.8, pan: 0,
    pitch: 0, decay: 0.5, muted: false, solo: false, ...sound,
    id, steps: Array.from({ length: track.steps }, () => 0),
  }];
}

/** Delete only from the active bank, including its saved snapshot so recall cannot resurrect pads. */
export function removeDrumPads(track: Pick<Track, 'pads' | 'drumPatterns' | 'activeDrumPattern'>, ids: readonly string[]) {
  const removed = new Set(ids);
  const pads = (track.pads ?? []).filter(pad => !removed.has(pad.id));
  const drumPatterns = [...(track.drumPatterns ?? [])];
  drumPatterns[track.activeDrumPattern ?? 0] = structuredClone(pads);
  return { pads, drumPatterns };
}