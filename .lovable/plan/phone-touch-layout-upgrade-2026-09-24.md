# Phone touch-layout upgrade

## What will change
- Replace the six cramped bottom tabs with a thumb-friendly five-tab layout; keep Record as the larger center action and move secondary tools into More.
- Increase all phone touch targets to at least 48px, strengthen labels/icons, and add safe spacing around screen edges and phone home indicators.
- Make Create and More open as full-height, scrollable phone tool drawers with large two-column choices that never clip.
- Reduce desktop-only chrome on phones so the timeline and active tool receive more usable height.
- Add phone-wide sizing rules for buttons, fields, sliders, tabs, dialogs, and tool panels while preserving desktop and tablet layouts.
- Keep wide editors usable through intentional internal scrolling rather than shrinking controls until they are hard to tap.

## Verification
- Test the welcome/sign-in screen and the working studio at a narrow phone viewport.
- Check for horizontal page overflow, clipped navigation, inaccessible controls, and touch targets below 48px.
- Verify Create, Record, Sounds, Mix, More, and the phone beat maker remain functional.
- Confirm the current build remains error-free.

## Technical details
- Changes stay in the phone navigation, workspace shell, and mobile-only global styles.
- Existing project state, audio behavior, desktop layout, and tablet layout remain unchanged.
