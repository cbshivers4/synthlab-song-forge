# Fix timeline recording meter

## Goal
Make the armed audio track’s timeline meter show the live microphone or interface input during recording, including when audible monitoring is off.

## Changes
- Add a dedicated live-input meter source to the shared level meter component.
- Switch an audio, vocal, or sampler track’s timeline meter to that live source while it is actively recording.
- Keep normal channel-output metering before and after recording, including clipping indication and reset.
- Preserve the existing monitor switch: it controls whether input is heard, not whether its level is visible.

## Verification
- Test an armed audio track with a simulated microphone.
- Confirm the meter rises during recording, falls after stopping, and the recorded clip is still created.
- Check the current build and browser console for errors.
