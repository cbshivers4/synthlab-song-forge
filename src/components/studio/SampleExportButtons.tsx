import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { useState } from "react";
import { Download, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { encodeWav, type Capture } from "@/lib/synclab/bounce";
import { uid } from "@/lib/synclab/presets";
import { saveCaptureToDevice } from "@/lib/synclab/sample-export";
import { useStudio } from "@/lib/synclab/store";

/** Shared "Add to timeline" and "Save to device" actions for sampler, pad sampler and video sampler audio. */
export function SampleExportButtons({ getCapture, name, timeline = true, className = "h-9 gap-1.5 sm:h-7" }: {
  getCapture: () => Promise<Capture | null> | Capture | null; name: string; timeline?: boolean; className?: string;
}) {
  const { addTrack, addClip, transport } = useStudio();
  const [busy, setBusy] = useState(false);
  const run = async (fn: (cap: Capture) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const cap = await getCapture();
      if (!cap) throw new Error("Load a sample first.");
      await fn(cap);
    } catch (e) {
      toast.error("Couldn't use that sample", { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  };
  const label = name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 18) || "SAMPLE";
  return <>
    {timeline && <Button size="sm" variant="ghost" className={className} disabled={busy} onClick={() => void run(async (cap) => {
      const audio = await getEngine().loadSampleFile(encodeWav(cap), label);
      const id = addTrack("audio", label, undefined, { keepPanel: true });
      addClip(id, { ...audio, id: uid(), name: label, start: getPlayStep(), offset: 0, length: audio.duration, gain: 1 });
      toast.success(`${label} added to the timeline`, { description: "On a new audio track at the playhead" });
    })}><ListPlus className="size-3.5" /> Add to timeline</Button>}
    <Button size="sm" variant="ghost" className={className} disabled={busy} onClick={() => void run(async (cap) => {
      const how = await saveCaptureToDevice(cap, name);
      if (how === "downloaded") toast.success("Sample saved", { description: "WAV file downloaded to your computer" });
      if (how === "shared") toast.success("Sample shared", { description: "Choose Save to Files to keep it on your phone" });
    })}><Download className="size-3.5" /> Save to device</Button>
  </>;
}
