import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/synclab/store";
import { ClockTempo, onMidiRealtime } from "@/lib/synclab/midi-clock";

/**
 * Follows an external MIDI clock when "Follow MIDI clock" is on: Start plays from the top,
 * Continue resumes, Stop pauses, and the incoming pulses set the song tempo (whole BPM).
 * Renders nothing; mounted once inside the studio.
 */
export function MidiClockFollow() {
  const { transport, setTransport, togglePlay } = useStudio();
  const latest = useRef({ transport, setTransport, togglePlay });
  latest.current = { transport, setTransport, togglePlay };

  useEffect(() => {
    const tempo = new ClockTempo();
    let lastSet = 0;
    return onMidiRealtime((kind, ms) => {
      const { transport: tp, setTransport: set, togglePlay: toggle } = latest.current;
      if (kind === "clock") {
        const bpm = tempo.pulse(ms);
        if (bpm && ms - lastSet > 500) {
          const rounded = Math.max(20, Math.min(300, Math.round(bpm)));
          if (rounded !== tp.bpm) {
            set({ bpm: rounded });
            lastSet = ms;
          }
        }
        return;
      }
      if (kind === "start") {
        tempo.reset();
        set({ step: 0 });
        if (!tp.playing) toggle();
      } else if (kind === "continue") {
        if (!tp.playing) toggle();
      } else if (kind === "stop") {
        if (tp.playing) toggle();
      }
    });
  }, []);
  return null;
}
