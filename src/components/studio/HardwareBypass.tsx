import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";

export function BypassButton({
  bypassed,
  onToggle,
  name,
  disabled = false,
}: {
  bypassed: boolean;
  onToggle: () => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={bypassed ? "default" : "outline"}
      className="h-11 shrink-0 gap-1.5 px-2 font-mono text-[10px]"
      disabled={disabled}
      aria-label={`Bypass ${name}`}
      aria-pressed={bypassed}
      title={bypassed ? "Restore device sound" : "Bypass device"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Power className="size-3.5" aria-hidden="true" />
      BYPASS
    </Button>
  );
}

export function HardwareBypass({ track, name }: { track?: Track | null; name?: string }) {
  const { updateTrack } = useStudio();
  return (
    <BypassButton
      name={name ?? track?.name ?? "instrument"}
      bypassed={track?.deviceBypassed ?? false}
      disabled={!track}
      onToggle={() => {
        if (track) updateTrack(track.id, { deviceBypassed: !track.deviceBypassed });
      }}
    />
  );
}
