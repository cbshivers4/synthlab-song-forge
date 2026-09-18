# Mobile Studio, Login, and Recording Repair

## Changes
- Redesign the welcome and sign-in screen as a clean professional console: compact branding, clear account choices, large touch targets, and a single-column phone layout.
- Add a visible sign-out control to the session-selection screen so users can leave their account before opening the studio.
- Replace the desktop-only phone navigation with touch-friendly access to the full menu set, transport, tools, and timeline track actions while preserving the desktop workstation layout.
- Make the lower editor usable as a phone workspace so the mixer, pad sampler, keyboard, and other devices can be opened, scrolled, and controlled without clipped content.
- Let users record directly into an empty sample pad, choose a phone-compatible recording format, and expose a dedicated record-to-pad action instead of opening the file picker first.
- Make the keyboard’s root, scale, scale lock, and chord controls prominent and horizontally scrollable on small screens.
- Replace the Hum to Beat placeholder with a real recorder that detects rhythmic peaks locally, previews the detected pattern, and sends it to an editable drum track.

## Verification
- Test at phone and desktop sizes: authentication screen, sign-out, every top menu, timeline track menu, panel navigation, pad recording flow, chord/scale controls, and Hum to Beat.
- Confirm microphone failures explain blocked permissions and offer opening the app in its own tab when needed.
- Confirm the preview builds cleanly with no runtime or console errors.

## Technical details
- Keep all existing desktop controls and project behavior; add responsive layouts rather than replacing working tools.
- Use the existing audio engine, microphone helper, project state, and design tokens. Rhythm detection runs in-browser from recorded audio; no fake server completion message.
- Preserve the existing login methods and confirmation behavior while updating presentation and touch ergonomics.
