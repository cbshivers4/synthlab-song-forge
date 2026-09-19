# Show audio waveform in the mixer EQ

## Goal
Display each channel’s live audio waveform directly inside its mixer EQ screen.

## Changes
- Feed the channel’s existing live audio scope into the EQ display.
- Draw the waveform behind the low, mid, and high EQ curve and controls.
- Keep the EQ handles fully interactive and readable while audio is playing.
- Show a centered flat line when the channel is silent.

## Verification
- Open the mixer and play a channel with audio.
- Confirm the waveform moves inside that channel’s EQ screen.
- Confirm low, mid, and high controls still adjust the correct bands.
- Check the current build and browser console for errors.
