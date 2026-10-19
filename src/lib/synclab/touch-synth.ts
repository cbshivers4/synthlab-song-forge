export const TOUCH_SCALES: Record<string, readonly number[]> = { 'Minor pentatonic': [0, 3, 5, 7, 10], 'Major pentatonic': [0, 2, 4, 7, 9], Major: [0, 2, 4, 5, 7, 9, 11], Minor: [0, 2, 3, 5, 7, 8, 10], Dorian: [0, 2, 3, 5, 7, 9, 10], Blues: [0, 3, 5, 6, 7, 10], Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
export const TOUCH_SOUNDS = ['Cybotron Lead', 'Sub Bass', 'FM Bell', 'Soft Flute', 'Kalimba', 'Metro Pluck', 'Warehouse Pad', 'Vocoder Bot'];
export function touchPitch(x: number, root: number, octave: number, scale: string, octaves = 2) {
  const notes = TOUCH_SCALES[scale] ?? TOUCH_SCALES.Minor ?? [0];
  const degree = Math.round(Math.max(0, Math.min(1, x)) * notes.length * octaves);
  return Math.min(127, (octave + 1) * 12 + root + Math.floor(degree / notes.length) * 12 + (notes[degree % notes.length] ?? 0));
}
export const touchCutoff = (y: number) => 180 * Math.pow(80, Math.max(0, Math.min(1, y)));
