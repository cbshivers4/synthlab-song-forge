import { useEffect, useState } from "react";
import { NotebookPen, Save, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Per-track notes — write anything about a channel (mic used, tuning, ideas)
 * and it is saved with the project, so it comes back when the song is opened.
 */
export function TrackNotes({
  track,
  children,
  className,
}: {
  track: Track;
  children?: React.ReactNode;
  className?: string;
}) {
  const { updateTrack } = useStudio();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(track.memo ?? "");

  useEffect(() => {
    if (open) setDraft(track.memo ?? "");
  }, [open, track.memo]);

  const save = () => {
    updateTrack(track.id, { memo: draft.trim() });
    setOpen(false);
    toast.success(draft.trim() ? "Note saved" : "Note cleared", { description: track.name });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title={
              track.memo ? `Note: ${track.memo.slice(0, 80)}` : `Write a note about ${track.name}`
            }
            aria-label={`Notes for ${track.name}`}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:text-foreground",
              track.memo && "border-primary/60 bg-primary/15 text-primary",
              className,
            )}
          >
            <NotebookPen className="size-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Notes · {track.name}</div>
        <Textarea
          autoFocus
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mic, tuning, key, what to fix next…"
          className="text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 gap-1.5 font-mono text-[10px] uppercase" onClick={save}>
            <Save className="size-3.5" /> Save
          </Button>
          {track.memo && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 font-mono text-[10px] uppercase text-muted-foreground"
              onClick={() => {
                setDraft("");
                updateTrack(track.id, { memo: "" });
                setOpen(false);
                toast("Note cleared", { description: track.name });
              }}
            >
              <Trash2 className="size-3.5" /> Clear
            </Button>
          )}
          <span className="ml-auto text-[9px] text-muted-foreground">⌘/Ctrl + Enter</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** All notes in the song, in one place. */
export function NotesPanel() {
  const { tracks, select, setPanel } = useStudio();
  const withNotes = tracks.filter((t) => (t.memo ?? "").trim());
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Every channel can hold its own note. Notes are saved with the project and come back when you
        open it again.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {tracks.map((t) => (
          <div key={t.id} className="rounded-sm border border-border bg-surface-2/50 p-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: t.color }} />
              <button
                className="font-display text-[11px] font-semibold tracking-widest hover:text-primary"
                onClick={() => {
                  select(t.id);
                  setPanel(null);
                }}
              >
                {t.name}
              </button>
              <TrackNotes track={t} className="ml-auto" />
            </div>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
              {(t.memo ?? "").trim() || "No note yet — press the pad icon to write one."}
            </p>
          </div>
        ))}
        {tracks.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Add a track first, then you can write notes on it.
          </p>
        )}
      </div>
      {tracks.length > 0 && (
        <p className="label-xs">
          {withNotes.length} of {tracks.length} channels have notes
        </p>
      )}
    </div>
  );
}
