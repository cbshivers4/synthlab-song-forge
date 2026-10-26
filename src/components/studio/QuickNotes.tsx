import { useEffect, useRef, useState } from "react";
import { Check, NotebookPen, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const PROJECT = "__project__";

/**
 * One shared, project-aware notes pad. Project notes live in the session (projectNotes);
 * track notes reuse each track's memo — the same data the mixer and timeline note buttons edit.
 * Opens over any tool without leaving it, and autosaves as you type.
 */
export function QuickNotes({ className, label }: { className?: string; label?: boolean }) {
  const { tracks, selectedId, projectNotes, setProjectNotes, updateTrack } = useStudio();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(PROJECT);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"saved" | "typing">("saved");
  const timer = useRef<number | null>(null);
  const pending = useRef<{ target: string; text: string } | null>(null);

  const stored = (id: string) => (id === PROJECT ? projectNotes : tracks.find((t) => t.id === id)?.memo ?? "");

  const commit = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    if (p.target === PROJECT) setProjectNotes(p.text);
    else if (tracks.some((t) => t.id === p.target)) updateTrack(p.target, { memo: p.text });
    setStatus("saved");
  };

  // Load the chosen note whenever the panel opens or the target changes (flushing first, so nothing is lost).
  useEffect(() => {
    if (open) setDraft(stored(target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  useEffect(() => () => commit(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (text: string) => {
    setDraft(text);
    setStatus("typing");
    pending.current = { target, text };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, 500);
  };

  const pick = (id: string) => {
    commit();
    setTarget(id);
  };

  const hasAny = projectNotes.trim() || tracks.some((t) => (t.memo ?? "").trim());

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) commit();
        else if (selectedId && target === PROJECT && !projectNotes.trim() && tracks.some((t) => t.id === selectedId && t.memo)) setTarget(selectedId);
        setOpen(v);
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size={label ? "sm" : "icon"}
          className={cn(isMobile ? (label ? "h-11" : "size-11") : label ? "h-7" : "size-8", hasAny && "border-primary/60 text-primary", label && "gap-1.5 font-mono text-[10px] uppercase", className)}
          aria-label="Open project notes"
          title="Notes"
        >
          <NotebookPen className="size-4" />
          {label && "Notes"}
        </Button>
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("flex flex-col gap-3", isMobile ? "h-[75dvh]" : "w-[min(92vw,420px)] sm:max-w-md")}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <NotebookPen className="size-4 text-primary" /> Notes
          </SheetTitle>
          <SheetDescription>Ideas, lyrics, arrangement, mix and mastering reminders — saved with this project.</SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-2">
          <select
            aria-label="Notes for"
            value={target}
            onChange={(e) => pick(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value={PROJECT}>Whole project{projectNotes.trim() ? " •" : ""}</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                Track · {t.name}{(t.memo ?? "").trim() ? " •" : ""}
              </option>
            ))}
          </select>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground" aria-live="polite">
            {status === "saved" ? <><Check className="size-3 text-primary" /> Saved</> : "Saving…"}
          </span>
        </div>
        <Textarea
          aria-label="Note text"
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={commit}
          placeholder={target === PROJECT ? "Song ideas, lyrics, arrangement plan, mastering reminders…" : "Mic, tuning, sound design, what to fix next…"}
          className="min-h-0 flex-1 resize-none text-sm"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            disabled={!draft}
            onClick={() => {
              pending.current = { target, text: "" };
              setDraft("");
              commit();
            }}
          >
            <Trash2 className="size-3.5" /> Clear this note
          </Button>
          <Button
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => {
              pending.current = { target, text: draft.trim() };
              commit();
              setOpen(false);
              toast.success("Note saved", { description: "Save the project to keep it after closing." });
            }}
          >
            <Save className="size-3.5" /> Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
