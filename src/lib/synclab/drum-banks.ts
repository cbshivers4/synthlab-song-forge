import type { DrumPad, Track } from './types';

export const DRUM_BANK_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** One-time reset requested for legacy prefilled banks; A is never changed. */
export function initializeDrumBanks(track: Pick<Track, 'pads' | 'drumPatterns' | 'activeDrumPattern' | 'drumBanksVersion'>) {
  if (track.drumBanksVersion === 1) return undefined;
  const active = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const bankA = structuredClone(active === 0 ? track.pads ?? [] : track.drumPatterns?.[0] ?? []);
  const drumPatterns = [bankA, ...Array.from({ length: 7 }, () => [] as DrumPad[])];
  return { drumPatterns, pads: active === 0 ? bankA : [], drumBanksVersion: 1 };
}

/** Bank recall preserves user-created banks; a never-used bank has no pads. */
export function recallDrumBank(track: Pick<Track, 'pads' | 'drumPatterns' | 'activeDrumPattern' | 'steps'>, next: number) {
  const active = Math.max(0, Math.min(7, track.activeDrumPattern ?? 0));
  const destination = Math.max(0, Math.min(7, next));
  const drumPatterns = structuredClone(track.drumPatterns ?? []);
  drumPatterns[active] = structuredClone(track.pads ?? []);
  const pads = (drumPatterns[destination] ?? []).map(pad => ({ ...pad, steps: Array.from({ length: track.steps }, (_, i) => pad.steps[i] ?? 0) }));
  drumPatterns[destination] = structuredClone(pads);
  return { pads, drumPatterns, activeDrumPattern: destination };
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