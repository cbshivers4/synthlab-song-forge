export const TOUCH_SCALES: Record<string, readonly number[]> = {
  'Minor pentatonic': [0, 3, 5, 7, 10], 'Major pentatonic': [0, 2, 4, 7, 9], Major: [0, 2, 4, 5, 7, 9, 11], Minor: [0, 2, 3, 5, 7, 8, 10], Dorian: [0, 2, 3, 5, 7, 9, 10], Blues: [0, 3, 5, 6, 7, 10], Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Phrygian: [0, 1, 3, 5, 7, 8, 10], Lydian: [0, 2, 4, 6, 7, 9, 11], Mixolydian: [0, 2, 4, 5, 7, 9, 10], Locrian: [0, 1, 3, 5, 6, 8, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'Melodic minor': [0, 2, 3, 5, 7, 9, 11], 'Major blues': [0, 2, 3, 4, 7, 9], Bebop: [0, 2, 4, 5, 7, 9, 10, 11],
  Diminished: [0, 2, 3, 5, 6, 8, 9, 11], 'Whole tone': [0, 2, 4, 6, 8, 10], Spanish: [0, 1, 4, 5, 7, 8, 10], Arabic: [0, 1, 4, 5, 7, 8, 11], Gypsy: [0, 2, 3, 6, 7, 8, 11],
  Egyptian: [0, 2, 5, 7, 10], Hirajoshi: [0, 2, 3, 7, 8], 'In sen': [0, 1, 5, 7, 10], Ryukyu: [0, 4, 5, 7, 11], Pelog: [0, 1, 3, 7, 8], 'Raga Bhairav': [0, 1, 4, 5, 7, 8, 11],
  'Major triad': [0, 4, 7], 'Minor triad': [0, 3, 7], Fifths: [0, 7], Octaves: [0],
};
/** Scale menu groups, so the long list reads like the hardware's scale chart. */
export const TOUCH_SCALE_GROUPS: readonly { label: string; scales: readonly string[] }[] = [
  { label: 'Pentatonic & blues', scales: ['Minor pentatonic', 'Major pentatonic', 'Blues', 'Major blues', 'Egyptian'] },
  { label: 'Modes', scales: ['Major', 'Minor', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Locrian'] },
  { label: 'Jazz & classical', scales: ['Harmonic minor', 'Melodic minor', 'Bebop', 'Diminished', 'Whole tone'] },
  { label: 'World', scales: ['Spanish', 'Arabic', 'Gypsy', 'Hirajoshi', 'In sen', 'Ryukyu', 'Pelog', 'Raga Bhairav'] },
  { label: 'Chords & intervals', scales: ['Major triad', 'Minor triad', 'Fifths', 'Octaves', 'Chromatic'] },
];
export const TOUCH_SOUNDS = ['Cybotron Lead', 'Sub Bass', 'FM Bell', 'Soft Flute', 'Kalimba', 'Metro Pluck', 'Warehouse Pad', 'Vocoder Bot'];
export function touchPitch(x: number, root: number, octave: number, scale: string, octaves = 2, degreeOffset = 0) {
  const notes = TOUCH_SCALES[scale] ?? TOUCH_SCALES['Minor'] ?? [0];
  const degree = Math.max(0, Math.round(Math.max(0, Math.min(1, x)) * notes.length * octaves) + degreeOffset);
  return Math.min(127, (octave + 1) * 12 + root + Math.floor(degree / notes.length) * 12 + (notes[degree % notes.length] ?? 0));
}
/** Where on the pad (0 left..1 right) a pitch sits; pitches off the scale land on the nearest lower degree. */
export function touchX(pitch: number, root: number, octave: number, scale: string, octaves = 2) {
  const count = (TOUCH_SCALES[scale]?.length ?? 7) * octaves;
  let best = 0;
  for (let i = 0; i <= count; i++) if (touchPitch(i / count, root, octave, scale, octaves) <= pitch) best = i;
  return best / count;
}
export const touchCutoff = (y: number) => 180 * Math.pow(80, Math.max(0, Math.min(1, y)));

/** One recorded hit inside a lane loop. `step` is a 16th-note index inside the loop. */
/** `tone` is the pad height (0..1) when the note was played, so the loop replays the same filter position. */
export interface TouchLoopNote { step: number; pitch: number; length: number; vel: number; tone?: number }
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
  { id: 'drums', label: 'DRUMS', color: '#f97316', sound: 'TR-909', octave: 2, drums: ['kick', 'snare', 'hat', 'clap', 'tom', 'openhat'] },
  { id: 'bass', label: 'BASS', color: '#22d3ee', sound: 'Sub Bass', octave: 2 },
  { id: 'poly', label: 'POLY LOOPS', color: '#a78bfa', sound: 'Warehouse Pad', octave: 3 },
  { id: 'melody', label: 'MELODY', color: '#4ade80', sound: 'Soft Flute', octave: 4 },
  { id: 'stabs', label: 'STABS / ARP', color: '#f472b6', sound: 'Metro Pluck', octave: 3 },
];
export const TOUCH_LOOP_STEPS = 32;
/** Loop lengths the sequencer offers, in bars of 16 steps. Old sets without a length stay 2 bars. */
export const TOUCH_LOOP_BARS = [1, 2, 4] as const;
export const loopStepsFor = (bars?: number) => (TOUCH_LOOP_BARS.includes(bars as 1) ? (bars as number) : 2) * 16;

/**
 * Changing loop length: shorter keeps every note (the extra ones just stop playing until you lengthen again);
 * longer repeats the bars you have into the new bars, replacing anything left there from before.
 */
export function resizeLoops(loops: TouchLoops, fromSteps: number, toSteps: number): TouchLoops {
  if (toSteps <= fromSteps) return loops;
  const out: TouchLoops = {};
  for (const [lane, notes] of Object.entries(loops)) {
    const kept = notes.filter((n) => n.step < fromSteps);
    const copies: TouchLoopNote[] = [];
    for (let start = fromSteps; start < toSteps; start += fromSteps) {
      for (const n of kept) if (n.step + start < toSteps) copies.push({ ...n, step: n.step + start, length: Math.min(n.length, toSteps - n.step - start) });
    }
    out[lane] = [...kept, ...copies];
  }
  return out;
}

/** One hit of a gate-arp pattern: scale-degree offsets from the touched note (several = a chord), length in steps. */
export interface TouchGateHit { deg: readonly number[]; len: number; vel: number }
export interface TouchGateArp { id: string; label: string; steps: readonly (TouchGateHit | null)[] }
const g = (deg: number[] = [0], len = 1, vel = .9): TouchGateHit => ({ deg, len, vel });
const _ = null;
/** Degree value meaning "one octave up" whatever the scale's size (5-note pentatonic or 7-note mode). */
export const GATE_OCTAVE = 100;
const O = GATE_OCTAVE;
/** Real scale-degree offset of a gate-arp degree for a scale with `scaleLength` notes. */
export const gateDegree = (d: number, scaleLength: number) => (d >= GATE_OCTAVE ? d - GATE_OCTAVE + scaleLength : d);
/** Holding a finger on the pad plays one of these rhythms, locked to the loop's 16th-note grid. "off" repeats at RATE. */
export const TOUCH_GATE_ARPS: readonly TouchGateArp[] = [
  { id: 'off', label: 'Off (repeat at RATE)', steps: [] },
  { id: 'gate8', label: 'Gate 1/8', steps: [g([0], 1.2), _] },
  { id: 'gate16', label: 'Gate 1/16', steps: [g([0], .6)] },
  { id: 'offbeat', label: 'Offbeat', steps: [_, _, g([0], 1.4), _] },
  { id: 'dotted', label: 'Dotted 8th', steps: [g([0], 2), _, _] },
  { id: 'gallop', label: 'Gallop', steps: [g([0], .7), _, g([0], .6, .7), g([0], .6, .8)] },
  { id: 'trance', label: 'Trance gate', steps: [g([0], .8), _, g([0], .8, .7), g([0], .8), _, g([0], .8, .7), g([0], .8), _, g([0], .8), _, g([0], .8, .7), g([0], .8), g([0], .8, .7), _, g([0], .8), _] },
  { id: 'stutter', label: 'Stutter', steps: [g([0], .4), g([0], .4, .7), g([0], .4, .8), g([0], .4, .6), _, _, g([0], .8), _] },
  { id: 'shuffle', label: 'Shuffle', steps: [g([0], 1.6), _, _, g([0], .8, .65)] },
  { id: 'up', label: 'Arp up', steps: [g([0], .8), g([2], .8, .75), g([4], .8, .8), g([O], .8, .7)] },
  { id: 'down', label: 'Arp down', steps: [g([O], .8), g([4], .8, .75), g([2], .8, .8), g([0], .8, .7)] },
  { id: 'updown', label: 'Arp up & down', steps: [g([0], .8), g([2], .8, .7), g([4], .8, .8), g([O], .8, .75), g([4], .8, .7), g([2], .8, .75)] },
  { id: 'octave', label: 'Octave bounce', steps: [g([0], .6), g([O], .6, .7)] },
  { id: 'broken', label: 'Broken chord', steps: [g([0], 1), _, g([4], .8, .7), g([2], .8, .75), _, g([O], .8, .8), g([4], .8, .7), _] },
  { id: 'acid', label: 'Acid run', steps: [g([0], .9, 1), g([0], .5, .6), g([O], .9, .85), g([0], .5, .6), g([2], 1.4, .9), _, g([4], .5, .7), g([O], .9, 1)] },
  { id: 'chord', label: 'Chord stabs', steps: [g([0, 2, 4], .7), _, _, g([0, 2, 4], .5, .7), _, _, g([0, 2, 4], 1.2, .85), _] },
  { id: 'chordpump', label: 'Chord pump', steps: [_, _, g([0, 2, 4], 1.2, .85), _] },
  { id: 'climb', label: 'Climb', steps: [g([0], .7), g([1], .7, .7), g([2], .7, .75), g([3], .7, .8), g([4], .7, .8), g([5], .7, .85), g([6], .7, .9), g([O], .7, 1)] },
];
export const gateArpById = (id?: string) => TOUCH_GATE_ARPS.find((a) => a.id === id) ?? TOUCH_GATE_ARPS[0]!;
/** The hit a gate arp plays on an absolute 16th step (patterns repeat), or null for a rest. */
export const gateArpHit = (arp: TouchGateArp, step: number) => (arp.steps.length ? arp.steps[((step % arp.steps.length) + arp.steps.length) % arp.steps.length] ?? null : null);
/** Drum indexes into the drums lane list. Saved loops store these indexes, so new drums are only ever appended. */
export const TOUCH_DRUM = { kick: 0, snare: 1, closedHat: 2, clap: 3, tom: 4, openHat: 5 } as const;
export const TOUCH_DRUM_LABELS: readonly string[] = ['KICK', 'SNARE', 'CLOSED HAT', 'CLAP', 'TOM', 'OPEN HAT'];

/**
 * Performance pad columns, left → right: each column plays only its own sound.
 * Column 2 is the hi-hat: bottom half closed, top half open. Cells are listed top first.
 */
export const TOUCH_DRUM_COLUMNS: readonly { label: string; color: string; cells: readonly number[] }[] = [
  { label: 'KICK', color: '#f97316', cells: [TOUCH_DRUM.kick] },
  { label: 'HI-HAT', color: '#facc15', cells: [TOUCH_DRUM.openHat, TOUCH_DRUM.closedHat] },
  { label: 'SNARE', color: '#38bdf8', cells: [TOUCH_DRUM.snare] },
  { label: 'CLAP', color: '#e879f9', cells: [TOUCH_DRUM.clap] },
];
const TOM_COLOR = '#4ade80';

/** Which drum a touch at x (0 left..1 right) and y (0 bottom..1 top) plays. */
export function touchDrumAt(x: number, y: number): number {
  const cols = TOUCH_DRUM_COLUMNS.length;
  const col = TOUCH_DRUM_COLUMNS[Math.max(0, Math.min(cols - 1, Math.floor(Math.max(0, Math.min(1, x)) * cols)))]!;
  if (col.cells.length === 1) return col.cells[0]!;
  const fromTop = 1 - Math.max(0, Math.min(1, y));
  return col.cells[Math.min(col.cells.length - 1, Math.floor(fromTop * col.cells.length))]!;
}

/** Display colour of a drum, matching its pad column. */
export const touchDrumColor = (drum: number) => TOUCH_DRUM_COLUMNS.find((c) => c.cells.includes(drum))?.color ?? TOM_COLOR;

export const laneById = (id: string) => TOUCH_LANES.find((l) => l.id === id) ?? { id: 'bass', label: 'BASS', color: '#22d3ee', sound: 'Sub Bass', octave: 2 };

/** Grid edits replace only an identical lane/step/pitch, leaving every other note intact. */
export function placeLoopNote(loops: TouchLoops, laneId: string, note: TouchLoopNote, steps = TOUCH_LOOP_STEPS): TouchLoops {
  const step = Math.max(0, Math.min(steps - 1, Math.round(note.step)));
  const next = { ...note, step, length: Math.max(.25, Math.min(note.length, steps - step)) };
  return { ...loops, [laneId]: [...(loops[laneId] ?? []).filter(n => n.step !== step || n.pitch !== note.pitch), next] };
}

export function eraseLoopNote(loops: TouchLoops, laneId: string, index: number): TouchLoops {
  return { ...loops, [laneId]: (loops[laneId] ?? []).filter((_, i) => i !== index) };
}

/** Notes in a lane that sit on one step, for the hold-to-erase button. */
export function eraseLoopStep(loops: TouchLoops, laneId: string, step: number): TouchLoops {
  const notes = loops[laneId] ?? [];
  const kept = notes.filter((n) => Math.round(n.step) !== step);
  return kept.length === notes.length ? loops : { ...loops, [laneId]: kept };
}

/** Flatten every lane's loop into timeline notes starting at `offset` steps. Muted parts and notes past the loop end are left out, so you get what you hear. */
export function loopsToNotes(loops: TouchLoops, offset: number, stamp: number, steps = Infinity, muted: Record<string, boolean> = {}) {
  const out: { id: string; step: number; length: number; pitch: number; velocity: number }[] = [];
  for (const lane of TOUCH_LANES) {
    if (muted[lane.id]) continue;
    for (const n of loops[lane.id] ?? []) {
      if (n.step >= steps) continue;
      const pitch = lane.drums ? 36 + Math.max(0, lane.drums.indexOf(lane.drums[Math.min(lane.drums.length - 1, Math.round(n.pitch))] ?? 'kick')) : n.pitch;
      out.push({ id: `touch-${lane.id}-${stamp}-${out.length}`, step: offset + n.step, length: Math.max(0.25, n.length), pitch, velocity: n.vel });
    }
  }
  return out;
}
