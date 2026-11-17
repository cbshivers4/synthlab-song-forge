import { useEffect, useRef } from "react";
import { ArrowRightToLine, ClipboardMinus, ClipboardPaste, Copy, X } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { selectedClip } from "@/lib/synclab/workflow";

/** Small pop-up that appears where a box/drag selection ends: copy, cut or paste the picked tracks
 *  without hunting for the bar above the timeline. Uses the same store actions as WorkflowBar. */
export function SelectionMenu({ at, onClose }: { at: { x: number; y: number }; onClose: () => void }) {
  const { selected, selectedIds, copyTracks, cutTracks, pasteTrack, copyClip, cutClip, pasteClip, clipClipboardName, clipboardName, clearTimelineSelection, transport } = useStudio();
  const ref = useRef<HTMLDivElement>(null);
  const picked = selectedIds.length > 1 ? selectedIds : selected ? [selected.id] : [];
  const clip = picked.length < 2 ? selectedClip(selected) : undefined;
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); } };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true); };
  }, [onClose]);
  if (!picked.length) return null;
  const label = picked.length > 1 ? `${picked.length} tracks` : clip?.name ?? selected?.name ?? "Track";
  const run = (fn: () => void) => () => { fn(); onClose(); };
  const copy = run(() => { if (clip && selected) copyClip(selected.id, clip.id); else copyTracks(picked); });
  const cut = run(() => { if (clip && selected) cutClip(selected.id, clip.id); else cutTracks(picked); });
  const paste = run(() => { if (clipClipboardName) pasteClip(false, selected?.id); else pasteTrack(selected?.id); });
  const pasteAtEnd = run(() => { if (clipClipboardName) pasteClip(true, selected?.id); else pasteTrack(selected?.id, undefined, true); });
  const canPaste = Boolean(clipClipboardName || clipboardName);
  const left = Math.max(8, Math.min(at.x + 6, window.innerWidth - 216));
  const top = Math.max(8, Math.min(at.y + 6, window.innerHeight - 200));
  const item = "flex w-full items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40";
  return (
    <div ref={ref} role="menu" aria-label="Selection actions" data-keep-timeline-selection
      className="app-menu fixed z-[60] w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      style={{ left, top }} onContextMenu={(e) => e.preventDefault()}>
      <div className="truncate px-2.5 pb-1 pt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label} selected</div>
      <button type="button" role="menuitem" autoFocus className={item} onClick={copy}><Copy className="size-3.5" />Copy<span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘C</span></button>
      <button type="button" role="menuitem" className={item} onClick={cut}><ClipboardMinus className="size-3.5" />Cut<span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘X</span></button>
      <button type="button" role="menuitem" className={item} disabled={!canPaste} onClick={paste}><ClipboardPaste className="size-3.5" />{transport.playing ? "Paste at next bar" : "Paste at playhead"}<span className="ml-auto font-mono text-[10px] text-muted-foreground">⌘V</span></button>
      <button type="button" role="menuitem" className={item} disabled={!canPaste} onClick={pasteAtEnd}><ArrowRightToLine className="size-3.5" />Paste at end of track</button>
      <div className="my-1 h-px bg-border" />
      <button type="button" role="menuitem" className={item} onClick={run(clearTimelineSelection)}><X className="size-3.5" />Unselect</button>
    </div>
  );
}
