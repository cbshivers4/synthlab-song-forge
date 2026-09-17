# Record Color, Chords, and Scales

## Changes
- Give the main REC control a permanent red treatment, with a brighter pulsing state while recording.
- Add root-note and scale selectors to the instrument keyboard.
- Highlight notes that belong to the selected scale and offer an optional scale lock that redirects off-scale notes to the nearest valid note.
- Add playable chord buttons for common professional chord types, voiced from the selected root and current octave.
- Keep the existing octave slide, keyboard lock, velocity, and instrument audition behavior intact.

## Technical details
- Implement the music-theory note sets and chord intervals locally in the keyboard panel.
- Trigger chord tones together through the existing audio preview path, without adding fake playback states.
- Use existing visual tokens and controls; no backend changes.
- Verify the preview build and keyboard interaction after editing.
