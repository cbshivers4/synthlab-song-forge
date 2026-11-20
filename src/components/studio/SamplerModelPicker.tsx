import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { isPadSamplerTrack } from "@/lib/synclab/track-editor";

/**
 * The sampler models, picked the same way as the SYNTHS row in the synth editor: each opens its
 * channel, or adds one when the song has none yet.
 */
export function SamplerModelPicker({ current }: { current: "sampler" | "pads" }) {
  const { tracks, select, addTrack, setPanel } = useStudio();
  const samplers = tracks.filter((t) => t.kind === "sampler");
  const oneShot = samplers.find((t) => !isPadSamplerTrack(t));
  const pads = samplers.find((t) => isPadSamplerTrack(t));
  const models = [
    {
      id: "sampler" as const,
      label: "Sampler",
      existing: oneShot,
      open: () => {
        if (oneShot) {
          select(oneShot.id);
          setPanel("sampler");
        } else addTrack("sampler", "SAMPLER");
      },
    },
    {
      id: "pads" as const,
      label: "Pad Sampler",
      existing: pads,
      // the Pad Sampler creates its own channel on first use
      open: () => {
        if (pads) select(pads.id);
        setPanel("pads");
      },
    },
  ];
  return (
    <div
      className="sampler-model-picker flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Sampler models"
    >
      <span className="label-xs mr-1">SAMPLERS</span>
      {models.map((m) => {
        const active = current === m.id;
        return (
          <Button
            key={m.id}
            type="button"
            size="sm"
            variant={active ? "default" : "secondary"}
            className="min-h-10 gap-1.5 px-3"
            aria-pressed={active}
            title={m.existing ? `Open ${m.existing.name}` : `Add a ${m.label} channel to the song`}
            onClick={() => {
              if (!active) m.open();
            }}
          >
            {!m.existing && !active && <Plus className="size-4" aria-hidden="true" />}
            {m.label}
          </Button>
        );
      })}
    </div>
  );
}
