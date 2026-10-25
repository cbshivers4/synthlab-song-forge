import { useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";

/** Native-keyboard naming surface counter-rotated within the shared phone canvas. */
export function NameEditDialog({ open, title, label, value, onChange, onClose, onSave, busy = false }: {
  open: boolean; title: string; label: string; value: string; onChange: (value: string) => void;
  onClose: () => void; onSave: () => void; busy?: boolean;
}) {
  const mobile = useIsMobile();
  useEffect(() => {
    if (!open || !mobile) return;
    const viewport = window.visualViewport;
    const sync = () => {
      // Native focus may scroll the clipped rotated body instead of a real scrollport.
      document.body.scrollLeft = 0;
      document.body.scrollTop = 0;
      const root = document.documentElement;
      root.style.setProperty("--name-editor-top", `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty("--name-editor-left", `${viewport?.offsetLeft ?? 0}px`);
      root.style.setProperty("--name-editor-width", `${viewport?.width ?? window.innerWidth}px`);
      root.style.setProperty("--name-editor-height", `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--name-editor-screen-width", `${window.innerWidth}px`);
    };
    sync();
    window.addEventListener("resize", sync);
    document.body.addEventListener("scroll", sync, { passive: true });
    const frame = requestAnimationFrame(sync);
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    return () => { cancelAnimationFrame(frame); document.body.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); viewport?.removeEventListener("resize", sync); viewport?.removeEventListener("scroll", sync); };
  }, [open, mobile]);
  return <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <DialogContent {...(mobile ? { overlayClassName: "name-editor-overlay" } : {})}
      className={mobile ? "name-editor-dialog translate-x-0 translate-y-0" : undefined} aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form className="grid min-w-0 gap-4" onSubmit={(e) => { e.preventDefault(); if (value.trim() && !busy) onSave(); }}>
        <div className="grid min-w-0 gap-2"><Label htmlFor="name-editor-input">{label}</Label>
          <Input id="name-editor-input" aria-label={label} autoFocus autoComplete="off" maxLength={80}
            className="h-12 min-w-0 text-base" value={value} onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()} disabled={busy} />
        </div>
        <DialogFooter className="flex-row justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !value.trim()}>{busy ? "Saving…" : "Save name"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}