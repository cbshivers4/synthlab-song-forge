import type { Track } from './types';

/** Resolve by saved pad identity, never display order or the selected instrument. */
export function learnedDrumPad(tracks: Track[], target: { id: string; param: string }) {
  if (!target.param.startsWith('drum-trigger:')) return null;
  const track = tracks.find(t => t.id === target.id && t.kind === 'drum');
  const pad = track?.pads?.find(p => p.id === target.param.slice('drum-trigger:'.length));
  return track && pad ? { track, pad } : null;
}