export const VIDEO_PAD_KEYS = "1234qwerasdfzxcv";
export const VIDEO_PAD_BASE_NOTE = 60;
export type VideoPadMidiNote = { pitch: number; channel: number } | null;
export function assignVideoPadNote(
  notes: VideoPadMidiNote[],
  index: number,
  note: Exclude<VideoPadMidiNote, null>,
): VideoPadMidiNote[] {
  return Array.from({ length: 16 }, (_, i) =>
    i === index
      ? note
      : notes[i]?.pitch === note.pitch && notes[i]?.channel === note.channel
        ? null
        : (notes[i] ?? null),
  );
}

export function videoPadForNote(note: number, count: number): number | null {
  const index = note - VIDEO_PAD_BASE_NOTE;
  return Number.isInteger(index) && index >= 0 && index < Math.min(16, count) ? index : null;
}
