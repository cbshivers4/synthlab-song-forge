import { TOUCH_LANES, TOUCH_SCALES, type TouchLoops, type TouchLoopNote } from './touch-synth';

interface GenrePattern {
  genre: string; names: [string, string]; scale: string;
  kick: number[]; snare: number[]; hats: number[]; bass: number[]; riff: number[];
  chords: number[]; stabs: number[];
}

// Original two-bar MIDI compositions, not commercial song recordings or factory loops.
const patterns: GenrePattern[] = [
  { genre: 'Detroit Techno', names: ['Motor City Drive', 'Afterhours Circuit'], scale: 'Minor', kick: [0,4,8,12], snare: [4,12], hats: [2,6,10,14], bass: [0,3,6,8,11,14], riff: [0,4,2,6,4,1], chords: [0,8], stabs: [2,7,10,15] },
  { genre: 'House', names: ['Warehouse Soul', 'Sunday Floor'], scale: 'Dorian', kick: [0,4,8,12], snare: [4,12], hats: [2,6,10,14,15], bass: [0,2,7,8,10,15], riff: [0,2,4,5,4,2], chords: [0,6,10], stabs: [2,6,10,14] },
  { genre: 'Deep House', names: ['Midnight Velvet', 'Low Light Lounge'], scale: 'Minor', kick: [0,4,8,12], snare: [4,12], hats: [2,6,14], bass: [0,6,8,14], riff: [0,4,2,1], chords: [0,10], stabs: [3,11] },
  { genre: 'Hip-Hop', names: ['Boom Bap Avenue', 'Headnod Session'], scale: 'Minor pentatonic', kick: [0,7,10], snare: [4,12], hats: [0,2,4,6,8,10,12,14], bass: [0,7,10,14], riff: [0,2,3,1], chords: [0,8], stabs: [6,14] },
  { genre: 'Trap', names: ['808 Nightfall', 'Diamond Bounce'], scale: 'Minor', kick: [0,6,11,14], snare: [8], hats: [0,2,4,6,7,8,10,12,13,14,15], bass: [0,6,11,14], riff: [0,0,4,6], chords: [0], stabs: [3,7,11,15] },
  { genre: 'R&B', names: ['Silk & Soul', 'Late Night Letters'], scale: 'Major pentatonic', kick: [0,7,10], snare: [4,12], hats: [0,3,6,8,11,14], bass: [0,5,8,13], riff: [0,2,4,3], chords: [0,6], stabs: [7,15] },
  { genre: 'Funk', names: ['Pocket Machine', 'Electric Strut'], scale: 'Dorian', kick: [0,3,8,10], snare: [4,12], hats: [0,2,4,6,8,10,12,14], bass: [0,2,3,6,8,10,11,14], riff: [0,4,0,6,2,4,1,0], chords: [0,8], stabs: [3,6,11,14] },
  { genre: 'Jazz', names: ['Blue Note Walk', 'Moonlit Quartet'], scale: 'Dorian', kick: [0,10], snare: [6,14], hats: [0,3,4,7,8,11,12,15], bass: [0,4,8,12], riff: [0,2,4,6], chords: [0,8], stabs: [7,15] },
  { genre: 'Latin', names: ['Conga Street', 'Tropical Nights'], scale: 'Major', kick: [0,6,8,14], snare: [4,10,12], hats: [0,2,3,6,8,10,11,14], bass: [0,3,6,8,11,14], riff: [0,4,2,0,5,4], chords: [0,6,10], stabs: [0,3,6,10,12] },
  { genre: 'Reggaeton', names: ['Dembow Heat', 'Neon Coast'], scale: 'Minor', kick: [0,8], snare: [3,6,11,14], hats: [0,2,4,6,8,10,12,14], bass: [0,6,8,14], riff: [0,2,4,1], chords: [0,8], stabs: [3,6,11,14] },
  { genre: 'Afrobeats', names: ['Sunrise Groove', 'Palm Rhythm'], scale: 'Major pentatonic', kick: [0,6,10], snare: [4,12], hats: [0,3,6,8,11,14], bass: [0,3,6,10,14], riff: [0,2,4,3,1], chords: [0,6,12], stabs: [2,7,10,15] },
  { genre: 'Drum & Bass', names: ['Jungle Transit', 'Liquid Skyline'], scale: 'Minor', kick: [0,10], snare: [4,12], hats: [0,2,4,6,8,10,12,14,15], bass: [0,5,8,10,15], riff: [0,0,4,2,6], chords: [0,8], stabs: [3,9,14] },
  { genre: 'Dub', names: ['Echo Yard', 'Submarine Skank'], scale: 'Minor pentatonic', kick: [0,8,11], snare: [8], hats: [2,6,10,14], bass: [0,3,6,11], riff: [0,0,3,1], chords: [0], stabs: [4,12] },
  { genre: 'Synthwave', names: ['Night Highway', 'Retro Horizon'], scale: 'Minor', kick: [0,8], snare: [4,12], hats: [0,2,4,6,8,10,12,14], bass: [0,2,4,6,8,10,12,14], riff: [0,0,4,4,2,2,6,6], chords: [0,8], stabs: [0,2,4,6,8,10,12,14] },
  { genre: 'Ambient', names: ['Orbit Drift', 'Quiet Constellation'], scale: 'Major pentatonic', kick: [0], snare: [12], hats: [6,14], bass: [0,12], riff: [0,3], chords: [0], stabs: [7,15] },
  { genre: 'Rock', names: ['Garage Sparks', 'Arena Pulse'], scale: 'Blues', kick: [0,6,8,10], snare: [4,12], hats: [0,2,4,6,8,10,12,14], bass: [0,4,6,8,12,14], riff: [0,0,3,0,4,3], chords: [0,8], stabs: [0,6,8,14] },
];

export const TOUCH_LOOP_LIBRARY = patterns.flatMap((pattern, genreIndex) => pattern.names.map((name, variation) => ({
  id: `${genreIndex}-${variation}`, name, genre: pattern.genre, scale: pattern.scale, variation, pattern,
})));
export const TOUCH_LOOP_GENRES = patterns.map(p => p.genre);
export type TouchLoopPreset = typeof TOUCH_LOOP_LIBRARY[number];

export function genreLoops(preset: TouchLoopPreset, root: number, scale = preset.scale): TouchLoops {
  const degrees = TOUCH_SCALES[scale] ?? TOUCH_SCALES['Minor'] ?? [0];
  const pitch = (degree: number, octave: number) => (octave + 1) * 12 + root + Math.floor(degree / degrees.length) * 12 + (degrees[degree % degrees.length] ?? 0);
  const loops: TouchLoops = Object.fromEntries(TOUCH_LANES.map(l => [l.id, []]));
  const add = (lane: string, step: number, notePitch: number, length: number, vel: number) => {
    loops[lane]?.push({ step, pitch: notePitch, length: Math.min(length, 32 - step), vel });
  };
  for (let bar = 0; bar < 2; bar++) {
    const offset = bar * 16;
    const p = preset.pattern;
    const shift = preset.variation ? 2 + bar : bar;
    p.kick.forEach(step => add('drums', offset + step, 0, .5, .92));
    p.snare.forEach(step => add('drums', offset + step, preset.variation ? 3 : 1, .5, .82));
    p.hats.forEach((step, i) => add('drums', offset + step, 2, .25, i % 2 ? .46 : .64));
    if (preset.variation) add('drums', offset + 15, 4, .5, .65);
    p.bass.forEach((step, i) => add('bass', offset + step, pitch(p.riff[(i + shift) % p.riff.length] ?? 0, 2), 1.5, .85));
    p.chords.forEach((step, i) => {
      const degree = (i * 2 + shift) % degrees.length;
      [0,2,4].forEach(tone => add('poly', offset + step, pitch(degree + tone, 3), Math.min(7, 16 - step), .54));
    });
    p.riff.forEach((degree, i) => add('melody', offset + Math.floor(i * 16 / p.riff.length), pitch((degree + shift) % degrees.length, 4), preset.variation ? 1 : 2, .66));
    p.stabs.forEach((step, i) => add('stabs', offset + step, pitch((p.riff[(i + shift) % p.riff.length] ?? 0) + degrees.length, 3), .75, .62));
  }
  return loops;
}

/** Replace only the explicit load target, retaining all other recorded lanes. */
export function loadGenreLoops(current: TouchLoops, incoming: TouchLoops, laneId?: string): TouchLoops {
  const copy = (notes: TouchLoopNote[]) => notes.map(n => ({ ...n }));
  return laneId ? { ...current, [laneId]: copy(incoming[laneId] ?? []) }
    : Object.fromEntries(TOUCH_LANES.map(l => [l.id, copy(incoming[l.id] ?? [])]));
}