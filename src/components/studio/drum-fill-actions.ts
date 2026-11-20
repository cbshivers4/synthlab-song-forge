import { toast } from "sonner";
import { getEngine } from "@/lib/synclab/audio-engine";
import {
  cycleRoll,
  mutatePad,
  mutateSummary,
  toggleFlam,
  type DrumRegion,
} from "@/lib/synclab/drum-fills";
import { loopRegion } from "@/lib/synclab/recording-region";
import { stepSeconds, stepsPerBar } from "@/lib/synclab/timebase";
import type { DrumPad, Track, Transport } from "@/lib/synclab/types";

type Ctx = {
  track: Track;
  transport: Transport;
  updatePad: (trackId: string, padId: string, patch: Partial<DrumPad>) => void;
  updateTrack: (trackId: string, patch: Partial<Track>) => void;
};

/** Short audition so a press is heard straight away, even while stopped. Never recorded. */
function audition(c: Ctx, pad: DrumPad, kind: "flam" | "roll", size = 1) {
  if (c.transport.playing) return;
  const engine = getEngine();
  const ctx = engine.init();
  const t = ctx.currentTime + 0.02;
  if (kind === "flam") {
    engine.playDrum(c.track.id, pad, 0.9, t);
    engine.playDrum(c.track.id, pad, 0.9 * 0.55, t + 0.012 + 0.5 * 0.035);
    return;
  }
  const step = stepSeconds(c.transport.bpm);
  for (let h = 0; h < size; h++)
    engine.playDrum(c.track.id, pad, 0.9 * Math.pow(0.88, h), t + (h * step) / size);
}

const region = (c: Ctx): DrumRegion => (c.transport.loop ? loopRegion(c.transport) : undefined);
const noHits = (pad: DrumPad) =>
  toast(`${pad.name} has no hits yet`, {
    description: "Put some hits on this drum first, then press it again.",
  });

/** Flam on/off for every hit of this drum (inside the loop when Loop is on). */
export function flamPad(c: Ctx, pad: DrumPad) {
  const r = toggleFlam(pad, region(c));
  if (!r) {
    noHits(pad);
    return;
  }
  c.updatePad(c.track.id, pad.id, r.patch);
  if (r.on) audition(c, pad, "flam");
  toast.success(r.on ? `Flam on — ${pad.name}` : `Flam off — ${pad.name}`, {
    description: r.on
      ? `${r.hits} hit${r.hits === 1 ? "" : "s"} now play a quick double stroke. Fine-tune each one with the FLAM knob.`
      : "Back to single strokes.",
  });
}

/** Roll: 2 → 3 → 4 hits per step, then off. */
export function rollPad(c: Ctx, pad: DrumPad) {
  const r = cycleRoll(pad, region(c));
  if (!r) {
    noHits(pad);
    return;
  }
  c.updatePad(c.track.id, pad.id, r.patch);
  if (r.size > 1) audition(c, pad, "roll", r.size);
  toast.success(r.size > 1 ? `Roll ×${r.size} — ${pad.name}` : `Roll off — ${pad.name}`, {
    description:
      r.size > 1
        ? `Each of ${r.hits} hit${r.hits === 1 ? "" : "s"} rolls ${r.size} times. Press again for a faster roll.`
        : "Back to single hits.",
  });
}

/** Mutate: a few musical changes to this drum's pattern; MUTATE knob sets how many. Undo puts it back. */
export function mutateDrumPad(c: Ctx, pad: DrumPad) {
  const reg = region(c);
  const r = mutatePad(pad, pad.mutation ?? 0.2, reg, Math.random, stepsPerBar());
  if (!r) {
    toast("Nothing to change inside the loop");
    return;
  }
  if (reg) c.updateTrack(c.track.id, { patternRegion: reg });
  c.updatePad(c.track.id, pad.id, r.patch);
  toast.success(`Mutated ${pad.name}`, {
    description: `${mutateSummary(r)}. Press again for more, or Undo to go back.`,
  });
}
