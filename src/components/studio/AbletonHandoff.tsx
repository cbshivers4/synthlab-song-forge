import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Music2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { parseMidiFile } from "@/lib/synclab/midi-file";
import { openExport } from "@/components/studio/ExportDialog";
import { toast } from "sonner";

export function AbletonHandoff({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addTrack, addClip, setNotes, select } = useStudio();
  const audioRef = useRef<HTMLInputElement>(null);
  const midiRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importStems = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true);
    let imported = 0;
    let failed = 0;
    try {
      const engine = getEngine();
      for (const file of Array.from(files)) {
        if (
          !/\.(wav|wave|aif|aiff|mp3|m4a|aac|ogg|flac|webm)$/i.test(file.name) &&
          !file.type.startsWith("audio/")
        ) {
          failed++;
          continue;
        }
        try {
          const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40);
          const loaded = await engine.loadSampleFile(file, name);
          const trackId = addTrack("audio", name);
          addClip(trackId, {
            id: crypto.randomUUID(),
            name,
            peaks: loaded.peaks,
            duration: loaded.duration,
            url: loaded.url,
            start: 0,
            offset: 0,
            length: loaded.duration,
            gain: 1,
          });
          select(trackId);
          imported++;
        } catch {
          failed++;
        }
      }
      if (imported) toast.success(`${imported} stem${imported === 1 ? "" : "s"} aligned at bar 1`);
      if (failed) toast.error(`${failed} file${failed === 1 ? "" : "s"} could not be decoded`);
    } finally {
      setBusy(false);
      if (audioRef.current) audioRef.current.value = "";
    }
  };

  const importMidi = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true);
    let count = 0;
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const parts = parseMidiFile(await file.arrayBuffer());
          if (!parts.length) throw new Error("Empty MIDI file");
          for (const part of parts) {
            const id = addTrack(
              "midi",
              part.name || file.name.replace(/\.[^.]+$/, ""),
              "Deep Keys",
            );
            setNotes(id, part.notes);
            select(id);
            count++;
          }
        } catch {
          failed++;
        }
      }
      if (count) toast.success(`${count} MIDI part${count === 1 ? "" : "s"} imported`);
      if (failed) toast.error(`${failed} MIDI file${failed === 1 ? "" : "s"} could not be read`);
    } finally {
      setBusy(false);
      if (midiRef.current) midiRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ableton Live handoff</DialogTitle>
          <DialogDescription>
            Exchange exported files with Ableton Live. Ableton itself runs separately on your
            computer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="space-y-2 border-b border-border pb-4">
            <h3 className="font-semibold">Bring audio into SYNCLAB</h3>
            <p className="text-muted-foreground">
              Export individual tracks from Ableton starting at bar 1, then choose them together.
              Each becomes its own aligned waveform track.
            </p>
            <input
              ref={audioRef}
              type="file"
              multiple
              accept="audio/*,.wav,.wave,.aif,.aiff,.mp3,.m4a,.aac,.ogg,.flac,.webm"
              className="hidden"
              aria-label="Choose Ableton audio stems"
              onChange={(e) => void importStems(e.target.files)}
            />
            <Button disabled={busy} onClick={() => audioRef.current?.click()}>
              <ArrowDownToLine className="size-4" /> {busy ? "Importing…" : "Import audio stems"}
            </Button>
          </div>
          <div className="space-y-2 border-b border-border pb-4">
            <h3 className="font-semibold">Bring MIDI into SYNCLAB</h3>
            <p className="text-muted-foreground">
              Export a standard MIDI file from Ableton to edit its notes here. Set the same tempo in
              both projects for alignment.
            </p>
            <input
              ref={midiRef}
              type="file"
              multiple
              accept=".mid,.midi,audio/midi"
              className="hidden"
              aria-label="Choose Ableton MIDI files"
              onChange={(e) => void importMidi(e.target.files)}
            />
            <Button variant="outline" disabled={busy} onClick={() => midiRef.current?.click()}>
              <Music2 className="size-4" /> Import MIDI
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Send a mix to Ableton</h3>
            <p className="text-muted-foreground">
              Record the SYNCLAB mix as a WAV, then import the saved file into Ableton. Use the same
              tempo in both projects.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                openExport();
              }}
            >
              <ArrowUpFromLine className="size-4" /> Export WAV mix
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ableton project files, devices, plugins, and live transport sync are not supported here.
            WAV stems and standard MIDI are exchanged as files.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
