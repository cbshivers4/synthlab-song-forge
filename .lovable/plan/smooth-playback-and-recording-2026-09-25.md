# Smooth playback and recording

## Goal
Make transport playback, previews, microphone recording, and tool switching cooperate reliably across desktop and mobile browsers without claiming hardware-perfect performance.

## Changes
- Strengthen the shared audio engine so it resumes safely after device/browser suspension, clamps late scheduled events, tracks active voices, and fades/stops them cleanly instead of clicking or leaking across tools.
- Make transport start from the current playhead, prevent duplicate starts, stop already-scheduled voices when playback stops or jumps, and resync cleanly after a background-tab or main-thread stall.
- Replace timer-driven Bass Generator and pad-sequencer playback with audio-clock look-ahead scheduling for steadier timing.
- Give every preview tool its own isolated preview channel and ensure it stops when closed, replaced, or when another preview starts.
- Serialize microphone start/stop operations, reuse the selected input where appropriate, prevent two tools from opening competing recorders, and always release streams on cancellation, errors, tool changes, and component removal.
- Harden recording finalization so rapid Stop/Record taps cannot lose a take or leave the interface in the wrong state.
- Add regression tests for scheduler timing, recording lifecycle, stream cleanup, and overlapping preview isolation.
- Verify the core flow in the live preview at desktop and phone sizes; document that real interface latency still depends on browser, device drivers, buffer size, and hardware testing.

## Technical details
- Keep one browser `AudioContext` and one microphone ownership coordinator.
- Use `AudioContext.currentTime` with a short look-ahead window; UI animation follows the audio clock rather than driving sound.
- Use short gain ramps before disconnecting active audio nodes to avoid clicks.
- Handle `visibilitychange`, `pageshow`, audio-context state changes, and device removal without burst-playing missed notes.
- Keep existing controls and project behavior intact; this is stability work, not a redesign.
