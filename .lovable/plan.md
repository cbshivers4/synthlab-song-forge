# Owned Reference Track Analyzer

## What will be added
- Add a Reference Analyzer inside the studio for audio files the user owns.
- Let users choose or drop an audio file, then analyze it locally without uploading or copying streaming audio.
- Show estimated tempo, musical key, duration, peak level, average loudness, and a compact waveform.
- Add playback controls and a clear/remove action so the reference can be auditioned without adding it to the project timeline.
- Make the analyzer reachable from desktop tools, search, menus, and the mobile More sheet.

## Technical details
- Use browser audio decoding and offline signal analysis only; no Spotify audio import or protected-media access.
- Estimate tempo from onset energy and key from chroma/pitch-class energy, labeling both as estimates.
- Keep analysis in memory on the device and revoke temporary media URLs when replaced or closed.
- Reuse existing buttons, panels, semantic colors, mobile touch targets, and studio layout patterns.

## Verification
- Test owned WAV/MP3 loading, analysis results, playback, clearing, and invalid-file feedback.
- Check desktop and phone layouts, TypeScript, project tests, and preview errors.
