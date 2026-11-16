import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getEngine } from "@/lib/synclab/audio-engine";
import { encodeMp3 } from "@/lib/synclab/bounce";
import { buildZip, downloadBlob } from "@/lib/synclab/zip";
import type { SavedPad } from "@/lib/synclab/pad-session";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

/** Encodes each pad's trimmed sample as MP3 and saves it (share sheet on phones, downloads on computers). */
async function savePads(list: { index: number; pad: SavedPad }[]) {
  const ctx = getEngine().init();
  const files: File[] = [];
  for (const { index, pad } of list) {
    const buf = await decodeAudioFile(ctx, await (await fetch(pad.url)).arrayBuffer());
    const a = Math.floor((pad.start ?? 0) * buf.length);
    const b = Math.max(a + 1, Math.floor((pad.end ?? 1) * buf.length));
    const left = buf.getChannelData(0).slice(a, b);
    const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice(a, b);
    const safe = `pad${index + 1}_${pad.name}`.replace(/[^\w-]+/g, "_");
    files.push(new File([encodeMp3({ left, right, sampleRate: buf.sampleRate }, 192)], `${safe}.mp3`, { type: "audio/mpeg" }));
  }
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files }) && nav.share) {
    try {
      await nav.share({ files, title: "SYNCLAB pad samples" });
      toast.success(`Shared ${files.length} pad sample${files.length === 1 ? "" : "s"} — choose Save to Files`);
      return;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }
  // Desktop: one MP3 downloads directly; several pads are bundled into a single ZIP
  // so the browser doesn't block a burst of downloads.
  if (files.length === 1) {
    downloadBlob(files[0]!, files[0]!.name);
    toast.success("Saved pad sample as MP3");
  } else {
    const entries: { name: string; data: Uint8Array }[] = [];
    for (const f of files) entries.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) });
    const zip = buildZip(entries);
    downloadBlob(zip, "synclab-pads.zip");
    toast.success(`Saved ${files.length} pad samples in synclab-pads.zip`);
  }
}

export function SavePadsDialog({ pads, selected }: { pads: Record<number, SavedPad>; selected: number }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const filled = Object.entries(pads).filter(([, p]) => p?.url).map(([i, p]) => ({ index: Number(i), pad: p })).sort((a, b) => a.index - b.index);

  const run = async (list: { index: number; pad: SavedPad }[]) => {
    if (!list.length) { toast.error("No recorded pads to save"); return; }
    setBusy(true);
    try { await savePads(list); setOpen(false); }
    catch { toast.error("Could not save the pad samples"); }
    finally { setBusy(false); }
  };
  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const bankName = (i: number) => `${"ABCD"[Math.floor(i / 16)] ?? ""}${(i % 16) + 1}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setPicked(new Set()); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-9 gap-1.5 sm:h-7"><Download className="size-3.5" /> Save pads</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Save pad samples (MP3)</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">On a phone, pick "Save to Files" in the share menu. On a computer the files download (several pads arrive as one ZIP).</p>
        <div className="grid gap-2">
          <Button disabled={busy || !pads[selected]?.url} className="h-12" onClick={() => void run(filled.filter((f) => f.index === selected))}>
            Save selected pad ({bankName(selected)})
          </Button>
          <Button disabled={busy || !filled.length} variant="secondary" className="h-12" onClick={() => void run(filled)}>
            Save all pads ({filled.length})
          </Button>
        </div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground">OR CHOOSE PADS</p>
        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto">
          {filled.map(({ index, pad }) => (
            <button key={index} type="button" aria-pressed={picked.has(index)} onClick={() => toggle(index)}
              className={`h-12 truncate rounded-md border px-1 font-mono text-[10px] ${picked.has(index) ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}>
              {bankName(index)}<br />{pad.name}
            </button>
          ))}
          {!filled.length && <p className="col-span-4 text-xs text-muted-foreground">Record or load a sample onto a pad first.</p>}
        </div>
        <Button disabled={busy || picked.size === 0} variant="outline" className="h-12" onClick={() => void run(filled.filter((f) => picked.has(f.index)))}>
          {busy ? "Saving…" : `Save ${picked.size} chosen pad${picked.size === 1 ? "" : "s"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
