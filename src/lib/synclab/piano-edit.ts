import type { MidiNote } from './types';
import { capturedNote } from './recording-region';
import { uid } from './presets';

export function pastePianoNotes(source: MidiNote[], at: number, bounds: [number, number]): MidiNote[] {
  if (!source.length) return [];
  const origin = Math.min(...source.map(n => n.step));
  return source.flatMap(n => {
    const note = capturedNote({ ...n, id: uid(), step: n.step - origin + at }, bounds);
    return note ? [note] : [];
  });
}

export function movePianoNotes(notes: MidiNote[], ids: string[], steps: number, semitones: number, bounds: [number, number]): MidiNote[] {
  const selected = notes.filter(n => ids.includes(n.id));
  if (!selected.length) return notes;
  const delta = Math.max(bounds[0] - Math.min(...selected.map(n => n.step)), Math.min(steps, bounds[1] - Math.max(...selected.map(n => n.step + n.length))));
  const pitchDelta = Math.max(-Math.min(...selected.map(n => n.pitch)), Math.min(semitones, 127 - Math.max(...selected.map(n => n.pitch))));
  return notes.map(n => ids.includes(n.id) ? { ...n, step: n.step + delta, pitch: n.pitch + pitchDelta } : n);
}