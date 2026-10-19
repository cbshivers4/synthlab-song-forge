export const TOUCH_SCALES: Record<string, readonly number[]> = { 'Minor pentatonic': [0, 3, 5, 7, 10], 'Major pentatonic': [0, 2, 4, 7, 9], Major: [0, 2, 4, 5, 7, 9, 11], Minor: [0, 2, 3, 5, 7, 8, 10], Dorian: [0, 2, 3, 5, 7, 9, 10], Blues: [0, 3, 5, 6, 7, 10], Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
export const TOUCH_SOUNDS = ['Cybotron Lead', 'Sub Bass', 'FM Bell', 'Soft Flute', 'Kalimba', 'Metro Pluck', 'Warehouse Pad', 'Vocoder Bot'];
export function touchPitch(x: number, root: number, octave: number, scale: string, octaves = 2) {
  const notes = TOUCH_SCALES[scale] ?? TOUCH_SCALES['Minor'] ?? [0];
  const degree = Math.round(Math.max(0, Math.min(1, x)) * notes.length * octaves);
  return Math.min(127, (octave + 1) * 12 + root + Math.floor(degree / notes.length) * 12 + (notes[degree % notes.length] ?? 0));
}
export const touchCutoff = (y: number) => 180 * Math.pow(80, Math.max(0, Math.min(1, y)));

/** One recorded hit inside a lane loop. `step` is a 16th-note index inside the loop. */
export interface TouchLoopNote { step: number; pitch: number; length: number; vel: number }
export type TouchLoops = Record<string, TouchLoopNote[]>;

export interface TouchLane {
  id: string;
  label: string;
  /** Display color for the lane's notes on the pad. */
  color: string;
  /** Tonal lanes play this sound; the drums lane plays drum voices instead. */
  sound: string;
  octave: number;
  drums?: readonly string[];
}

/** iKaossilator-style lanes: drums, bass, chords, melody and stabs/arps. */
export const TOUCH_LANES: readonly TouchLane[] = [
  { id: 'drums', label: 'DRUMS', color: '#f97316', sound: 'TR-909', octave: 2, drums: ['kick', 'snare', 'hat', 'clap', 'tom'] },
  { id: 'bass', label: 'BASS', color: '#22d3ee', sound: 'Sub Bass', octave: 2 },
  { id: 'poly', label: 'POLY LOOPS', color: '#a78bfa', sound: 'Warehouse Pad', octave: 3 },
  { id: 'melody', label: 'MELODY', color: '#4ade80', sound: 'Soft Flute', octave: 4 },
  { id: 'stabs', label: 'STABS / ARP', color: '#f472b6', sound: 'Metro Pluck', octave: 3 },
];
export const TOUCH_LOOP_STEPS = 32;
export const laneById = (id: string) => TOUCH_LANES.find((l) => l.id === id) ?? TOUCH_LANES[1]!;

/** Flatten every lane's loop into timeline notes starting at `offset` steps. */
export function loopsToNotes(loops: TouchLoops, offset: number, stamp: number) {
  const out: { id: string; step: number; length: number; pitch: number; velocity: number }[] = [];
  for (const lane of TOUCH_LANES) {
    for (const n of loops[lane.id] ?? []) {
      const pitch = lane.drums ? 36 + Math.max(0, lane.drums.indexOf(lane.drums[Math.min(lane.drums.length - 1, Math.round(n.pitch))] ?? 'kick')) : n.pitch;
      out.push({ id: `touch-${lane.id}-${stamp}-${out.length}`, step: offset + n.step, length: Math.max(0.25, n.length), pitch, velocity: n.vel });
    }
  }
  return out;
}
