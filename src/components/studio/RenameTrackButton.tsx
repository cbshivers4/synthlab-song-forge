import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { NameEditDialog } from "./NameEditDialog";

/**
 * Visible "rename" control for a channel: opens the shared NameEditDialog so typing
 * works on desktop and on the sideways phone canvas. The same Track.name is shown
 * in the timeline track header and on the mixer channel, so renaming here updates both.
 */
export function RenameTrackButton({ track, className, children }: { track: Track; className?: string; children?: ReactNode }) {
  const { updateTrack } = useStudio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(track.name);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    // Dialog events bubble through the React tree; keep them away from row/strip tap handlers.
    <span className="contents" onPointerDown={stop} onClick={stop} onDoubleClick={stop} onKeyDown={stop}>
      <button
        type="button"
        aria-label={`Rename ${track.name}`}
        title="Rename this instrument / channel"
        onClick={() => { setName(track.name); setOpen(true); }}
        className={cn("inline-flex shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-md hover:bg-accent", className)}
      >
        <Pencil className="size-3.5 shrink-0" />
        {children}
      </button>
      <NameEditDialog
        open={open}
        title="Rename channel"
        label="Instrument / channel name"
        value={name}
        onChange={setName}
        onClose={() => setOpen(false)}
        onSave={() => { updateTrack(track.id, { name: name.trim().toUpperCase() }); setOpen(false); }}
      />
    </span>
  );
}
