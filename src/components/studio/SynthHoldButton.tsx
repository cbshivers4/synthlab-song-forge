import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canHold, toggleHold, useSynthHold } from "@/lib/synclab/synth-hold";
import type { Track } from "@/lib/synclab/types";

/** HOLD (latch): notes played on this synth keep sounding after the key is let go, until HOLD is switched off. */
export function SynthHoldButton({ track }: { track: Track }) {
  const on = useSynthHold(track.id);
  const usable = canHold(track);
  return (
    <Button
      type="button"
      variant={on ? "default" : "outline"}
      className="synth-hold-button h-11 shrink-0 gap-1.5 px-2 font-mono text-[10px]"
      data-on={on ? "true" : undefined}
      disabled={!usable}
      aria-label={`Hold notes on ${track.name}`}
      aria-pressed={on}
      title={on ? "HOLD is on: notes keep sounding after you let go. Click to let them go." : "HOLD: keep notes sounding after you let go of the keys"}
      onClick={(event) => { event.stopPropagation(); toggleHold(track.id); }}
    >
      <span className="synth-hold-led" aria-hidden="true" />
      <Hand className="size-3.5" aria-hidden="true" />HOLD
    </Button>
  );
}
