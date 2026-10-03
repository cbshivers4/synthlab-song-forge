import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Cloud, Download, FolderOpen, HardDrive, Play, Plus, Save, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getPadBank } from "@/lib/synclab/pad-session";
import { uid } from "@/lib/synclab/presets";
import { getLocalFolders } from "@/lib/synclab/local-files";
import type { DrumPad, MidiNote, SynthPatch } from "@/lib/synclab/types";
import {
  KIND_LABEL, blobFromUrl, deleteFromLibrary, downloadLibraryItem, libraryAudio, listLibrary, onLibraryChange, saveToLibrary,
  type LibraryItem, type LibraryKind, type LibraryLocation,
} from "@/lib/synclab/library";

const KINDS: LibraryKind[] = ["sample", "synth", "drum", "notes"];
let previewAudio: HTMLAudioElement | null = null;

/** My Library: save samples, synth sounds, drum kits and notes into named folders, on the cloud or this computer. */
export function LibraryPanel() {
  const { tracks, selectedId, addTrack, updateTrack, setNotes, addClip, transport } = useStudio();
  const selected = tracks.find((t) => t.id === selectedId) ?? null;
  const [location, setLocation] = useState<LibraryLocation>("cloud");
  const [kind, setKind] = useState<LibraryKind>("sample");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const refresh = () => {
    listLibrary(location).then((l) => { setItems(l); setError(null); }).catch((e) => { setItems([]); setError(e instanceof Error ? e.message : "Could not load the library."); });
  };
  useEffect(refresh, [location]);
  useEffect(() => onLibraryChange(refresh), [location]);

  const ofKind = items.filter((i) => i.kind === kind);
  const folders = useMemo(() => {
    const m = new Map<string, LibraryItem[]>();
    for (const i of ofKind) m.set(i.folder, [...(m.get(i.folder) ?? []), i]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [ofKind]);
  const allFolders = [...new Set(items.map((i) => i.folder))];

  // what can be saved for the current kind
  const pads = getPadBank();
  const sampleSources = [
    ...Object.entries(pads).filter(([, p]) => p?.url).map(([i, p]) => ({ id: `pad:${i}`, label: `Pad ${Number(i) + 1}: ${p.name}` })),
    ...getLocalFolders().flatMap((f) => f.files.map((x) => ({ id: `file:${x.id}`, label: `${f.name}/${x.path}` }))),
    ...(selected?.clips ?? []).filter((c) => c.url).map((c) => ({ id: `clip:${c.id}`, label: `Clip: ${c.name}` })),
  ];

  const save = async () => {
    setBusy(true);
    try {
      let data: unknown = {};
      let audio: Blob | null = null;
      let fallbackName = "";
      if (kind === "sample") {
        const [type, id] = [source.split(":")[0], source.slice(source.indexOf(":") + 1)];
        if (!source) throw new Error("Pick a pad, file or clip to save.");
        if (type === "pad") {
          const p = pads[Number(id)];
          if (!p) throw new Error("That pad is empty.");
          audio = await blobFromUrl(p.url);
          fallbackName = p.name;
          data = { duration: p.duration, peaks: p.peaks };
        } else if (type === "file") {
          const f = getLocalFolders().flatMap((x) => x.files).find((x) => x.id === id);
          if (!f) throw new Error("That file is no longer open.");
          audio = f.file;
          fallbackName = f.name.replace(/\.[^.]+$/, "");
        } else {
          const c = selected?.clips?.find((x) => x.id === id);
          if (!c?.url) throw new Error("That clip has no audio.");
          audio = await blobFromUrl(c.url);
          fallbackName = c.name;
          data = { duration: c.duration, peaks: c.peaks };
        }
      } else if (kind === "synth") {
        if (!selected?.patch) throw new Error("Select an instrument track to save its synth sound.");
        data = selected.patch;
        fallbackName = selected.patch.name ?? selected.name;
      } else if (kind === "drum") {
        if (!selected?.pads) throw new Error("Select a drum machine track to save its drum sounds.");
        data = selected.pads;
        fallbackName = `${selected.name} kit`;
      } else {
        if (!selected?.notes?.length) throw new Error("Select a track with notes to save them.");
        data = selected.notes;
        fallbackName = `${selected.name} notes`;
      }
      await saveToLibrary({ kind, folder: folder || "Unsorted", name: name || fallbackName, data, audio, location });
      setOpen((o) => ({ ...o, [folder || "Unsorted"]: true }));
      setName("");
      toast.success(`Saved to ${location === "cloud" ? "the cloud" : "this computer"}`, { description: `${KIND_LABEL[kind]} › ${folder || "Unsorted"}` });
    } catch (e) {
      toast.error("Could not save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const load = async (item: LibraryItem) => {
    try {
      if (item.kind === "sample") {
        const blob = await libraryAudio(item);
        if (!blob) throw new Error("This sample has no audio.");
        const engine = getEngine();
        await engine.init();
        const nm = item.name.toUpperCase().slice(0, 18);
        const loaded = await engine.loadSampleFile(new File([blob], item.name, { type: blob.type }), nm);
        const target = selected?.kind === "audio" ? selected.id : addTrack("audio", nm);
        addClip(target, { id: uid(), name: nm, peaks: loaded.peaks, duration: loaded.duration, url: loaded.url, start: transport.step, offset: 0, length: loaded.duration, gain: 1 });
        toast.success(`${item.name} on the timeline`, { description: "Placed at the playhead" });
      } else if (item.kind === "synth") {
        const target = selected?.kind === "instrument" ? selected.id : addTrack("instrument", item.name);
        updateTrack(target, { patch: structuredClone(item.data as SynthPatch) });
        toast.success(`Synth sound "${item.name}" loaded`);
      } else if (item.kind === "drum") {
        const target = selected?.kind === "drum" ? selected.id : addTrack("drum", item.name);
        updateTrack(target, { pads: structuredClone(item.data as DrumPad[]) });
        toast.success(`Drum kit "${item.name}" loaded`);
      } else {
        const target = selected && (selected.kind === "instrument" || selected.kind === "midi") ? selected.id : addTrack("instrument", item.name);
        setNotes(target, (item.data as MidiNote[]).map((n) => ({ ...n, id: uid() })));
        toast.success(`Notes "${item.name}" loaded`, { description: "They replace the notes on that track." });
      }
    } catch (e) {
      toast.error("Could not load", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const preview = async (item: LibraryItem) => {
    previewAudio?.pause();
    if (playing === item.id) { setPlaying(null); return; }
    try {
      const blob = await libraryAudio(item);
      if (!blob) return;
      previewAudio = new Audio(URL.createObjectURL(blob));
      previewAudio.onended = () => setPlaying(null);
      await previewAudio.play();
      setPlaying(item.id);
    } catch {
      toast.error("Can't play that sample here.");
    }
  };

  const target = kind === "sample" ? "" : kind === "synth" ? "instrument" : kind === "drum" ? "drum machine" : "instrument/MIDI";

  return (
    <div className="space-y-2 px-2 py-1.5">
      <div className="grid grid-cols-2 gap-1">
        {(["cloud", "device"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLocation(l)} className={`flex items-center justify-center gap-1 rounded-sm border px-2 py-1 font-mono text-[10px] ${location === l ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
            {l === "cloud" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />} {l === "cloud" ? "CLOUD" : "THIS COMPUTER"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setSource(""); }} className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{KIND_LABEL[k].toUpperCase()}</button>
        ))}
      </div>

      <div className="space-y-1 rounded-sm border border-border p-1.5">
        <p className="font-mono text-[9px] text-muted-foreground">
          {kind === "sample" ? "SAVE A PAD, COMPUTER FILE OR CLIP" : `SAVE FROM THE SELECTED ${target.toUpperCase()} TRACK${selected ? ` (${selected.name})` : ""}`}
        </p>
        {kind === "sample" && (
          <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-sm border border-border bg-background px-1 py-1 font-mono text-[10px]">
            <option value="">Choose a sound…</option>
            {sampleSources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <input list="library-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder (new or existing)" className="w-full rounded-sm border border-border bg-background px-1.5 py-1 font-mono text-[10px]" />
        <datalist id="library-folders">{allFolders.map((f) => <option key={f} value={f} />)}</datalist>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full rounded-sm border border-border bg-background px-1.5 py-1 font-mono text-[10px]" />
        <button type="button" disabled={busy} onClick={() => void save()} className="flex w-full items-center justify-center gap-1 rounded-sm bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground disabled:opacity-50">
          <Save className="size-3" /> {busy ? "SAVING…" : `SAVE TO ${location === "cloud" ? "CLOUD" : "THIS COMPUTER"}`}
        </button>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {!error && folders.length === 0 && <p className="text-[10px] text-muted-foreground">No saved {KIND_LABEL[kind].toLowerCase()} here yet.</p>}
      {folders.map(([f, list]) => (
        <div key={f}>
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [f]: !o[f] }))} className="flex w-full items-center gap-1.5 py-1 text-left font-mono text-[11px] hover:bg-primary/10">
            {open[f] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <FolderOpen className="size-3 text-primary" /><span className="flex-1 truncate">{f}</span>
            <span className="text-[9px] text-muted-foreground">{list.length}</span>
          </button>
          {open[f] && (
            <div className="ml-3 border-l border-border/70">
              {list.map((i) => (
                <div key={i.id} className="group flex items-center gap-1 px-2 py-1 hover:bg-primary/10">
                  {i.kind === "sample" && (
                    <button type="button" aria-label={`Preview ${i.name}`} onClick={() => void preview(i)} className="grid size-5 place-items-center rounded-sm border border-border text-primary">
                      {playing === i.id ? <Square className="size-2.5 fill-current" /> : <Play className="size-2.5 fill-current" />}
                    </button>
                  )}
                  <span className="flex-1 truncate font-mono text-[11px]">{i.name}</span>
                  <button type="button" aria-label={`Load ${i.name}`} title="Load into the studio" onClick={() => void load(i)} className="text-muted-foreground hover:text-primary"><Plus className="size-3" /></button>
                  <button type="button" aria-label={`Download ${i.name}`} title="Download a copy to this computer" onClick={() => void downloadLibraryItem(i)} className="text-muted-foreground hover:text-primary"><Download className="size-3" /></button>
                  <button type="button" aria-label={`Delete ${i.name}`} onClick={() => { if (confirm(`Delete "${i.name}"?`)) void deleteFromLibrary(i).catch(() => toast.error("Could not delete")); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
