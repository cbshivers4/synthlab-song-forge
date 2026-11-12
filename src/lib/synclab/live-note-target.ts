/**
 * Which channel a live note (MIDI keyboard, computer keys, pitch wheel) plays.
 *
 * The instrument you are looking at wins: when you pick a preset on the
 * selected synth, the keys you play must sound that synth, not some other
 * channel that happens to be armed higher up the track list. While recording,
 * notes go to a channel that is actually recording (the selected one first),
 * so takes always land where Record was armed.
 */
export interface LiveNoteTrack {
  id: string;
  armed?: boolean | undefined;
  recording?: boolean | undefined;
  midiChannel?: number | null | undefined;
}

export function liveNoteTarget<T extends LiveNoteTrack>(
  tracks: readonly T[],
  selectedId: string | null | undefined,
  opts: {
    /** Channel can take live notes (instrument / midi / sampler, or a synth patch). */
    playable: (t: T) => boolean;
    /** Transport is recording. */
    recording?: boolean;
    /** 1-16 MIDI channel of the incoming message; tracks set to another channel never hear it. */
    channel?: number;
    /** Fall back to the first playable channel when nothing is selected or armed. */
    anyFallback?: boolean;
  },
): T | undefined {
  const { playable, recording = false, channel, anyFallback = false } = opts;
  const hears = (t: T) => channel == null || t.midiChannel == null || t.midiChannel === channel;
  const ok = (t: T) => playable(t) && hears(t);
  // A channel set to this exact MIDI channel always owns it.
  if (channel != null) {
    const owner = tracks.find((t) => playable(t) && t.midiChannel === channel);
    if (owner) return owner;
  }
  const selected = tracks.find((t) => t.id === selectedId && ok(t));
  if (recording) {
    if (selected?.recording) return selected;
    const rec = tracks.find((t) => t.recording && ok(t));
    if (rec) return rec;
  }
  if (selected) return selected;
  const armed = tracks.find((t) => t.armed && ok(t));
  if (armed) return armed;
  return anyFallback ? tracks.find(ok) : undefined;
}
