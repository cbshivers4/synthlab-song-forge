# Drum performance controls and creative-tool themes

## Build
- Expand each drum pad with distortion, compression, glitch, mutation, velocity, pitch, decay, chance, flam, and retrigger controls.
- Make the sound controls affect drum playback and make the step controls editable for individual hits.
- Add eight pattern slots per drum track, with clear switching and safe copy/reset behavior so patterns remain part of the saved project.
- Add distinct selectable color themes to Vocal Forge, Stem Separator, Voice Remover, AI Co-Producer, and Hum to Beat using the existing semantic color system.
- Keep all existing drum kits, sound presets, recording, mobile sizing, and project save/recovery behavior intact.

## Technical details
- Extend drum-pad and drum-track state with backward-compatible optional values.
- Schedule flam and retrigger as real additional hits; apply chance before triggering; use velocity, pitch, decay, distortion, compression, glitch, and mutation in the audio path.
- Store eight complete sequencer snapshots on the drum track and route edits to the active slot.
- Add reusable scoped theme tokens/classes rather than hardcoded component colors.

## Verify
- Check all controls at desktop and phone sizes.
- Confirm pattern slots switch independently and survive project state changes.
- Confirm drum effects and repeats produce audible scheduling changes.
- Confirm each creative tool theme changes its full panel without harming contrast.
- Confirm the preview builds cleanly and the main studio opens.
