# Timeline automation and creative devices

## What I’ll build

1. **Expand timeline automation**
   - Keep the existing drawable lanes and add filter cutoff, resonance, transient attack, transient sustain, and automatable device parameters.
   - Show proper units and parameter ranges instead of treating every lane as a generic 0–100% curve.
   - Keep point drawing, dragging, deletion, READ/OFF, undo, and playback automation working.

2. **Step Filter device**
   - Create an original SYNCLAB step-filter with 16/32 steps, low/high/band-pass modes, cutoff and resonance sequences, rate, smoothing, swing, depth, and mix.
   - Provide a visual step editor and real synchronized audio processing.

3. **Resonator device**
   - Add a multi-band tuned resonator with root note, scale-aware intervals, decay, damping, spread, and wet/dry mix.
   - Include an interactive frequency display and real audio processing.

4. **Scale and chord device**
   - Add a MIDI note processor with root, scale, chord voicings, inversion, range, note filtering, and chord generation.
   - Apply it to incoming/on-screen MIDI and recorded notes, with clear bypass behavior.

5. **Transient effects**
   - Add a transient shaper with attack, sustain, sensitivity, clip protection, output, and mix.
   - Include a live envelope/transient display and expose attack/sustain to timeline automation.

## Ground rules

- These will be original SYNCLAB devices inspired by the requested workflows, not copies of branded products.
- Controls will perform real browser audio/MIDI processing; unavailable native plug-in behavior will not be simulated.
- Existing tracks, effects, automation, mixer controls, and project compatibility will be preserved.

## Verification

- Check type safety and the live build.
- Test adding every device, opening its display, changing controls, drawing automation, playback, bypass, and removal.
