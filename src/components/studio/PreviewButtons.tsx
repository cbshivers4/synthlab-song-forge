import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { usePreviewTrack } from "@/lib/synclab/use-preview-track";

type Props = {
  pv: ReturnType<typeof usePreviewTrack>;
  onPreview: () => void;
  onAdd: () => void;
  addLabel?: string;
  active?: boolean;
  size?: "sm" | "lg";
};

/** Preview-with-song / Stop / Add buttons shared by every generator. */
export function PreviewButtons({ pv, onPreview, onAdd, addLabel = "Add to project", active = pv.previewing, size = "lg" }: Props) {
  const cls = size === "lg" ? "min-h-12" : "min-h-9";
  return (
    <div className="flex flex-wrap gap-2">
      {active ? (
        <Button size={size} variant="destructive" className={cls} onClick={pv.stop}>
          <Square className="size-4 fill-current" /> Stop preview
        </Button>
      ) : (
        <Button size={size} variant="secondary" className={cls} onClick={onPreview} title="Plays it along with your song from the playhead">
          <Play className="size-4" /> Preview with song
        </Button>
      )}
      <Button size={size} className={cls} onClick={onAdd}>{addLabel}</Button>
    </div>
  );
}
