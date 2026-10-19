import type { Track } from './types';

/** The razor must edit the same representation that the arrangement displays. */
export function timelineUsesWaveform(track: Pick<Track, 'kind' | 'clips' | 'printedAudio'>): boolean {
  if (!track.clips?.length) return false;
  if (track.kind === 'instrument' || track.kind === 'midi' || track.kind === 'sampler' || track.kind === 'drum') {
    return !!track.printedAudio;
  }
  return true;
}