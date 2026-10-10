import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Split, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { encodeWav } from "@/lib/synclab/bounce";
import { isStereo, peaksOf, separateStem, STEMS, type StemId } from "@/lib/synclab/stems";
import { retainMediaInBackground } from "@/lib/synclab/media-library";
import { GeneratedWaveform } from "./GeneratedWaveform";

type Source = { name: string; buffer: AudioBuffer; start: number };

export function StemSplitter() {
  const { tracks, addTrack, addClip } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [picked, setPicked] = useState<Record<StemId, boolean>>({ vocal: true, instrumental: true, bass: true, mids: false, highs: false });
  const [busy, setBusy] = useState<string | null>(null);

  const clips = useMemo(
    () => tracks.flatMap((t) => (t.clips ?? []).filter((c) => c.url).map((c) => ({ track: t.name, clip: c }))),
    [tracks],
  );

  const decode = async (data: ArrayBuffer) => {
    const ctx = new AudioContext();
    try { return await ctx.decodeAudioData(data); } finally { void ctx.close(); }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    retainMediaInBackground(file, file.name);
    setBusy("Reading file…");
    try {
      setSource({ name: file.name.replace(/\.[^.]+$/, ""), buffer: await decode(await file.arrayBuffer()), start: 0 });
    } catch {
      toast.error("Couldn't read that audio file");
    } finally { setBusy(null); }
  };

  const loadClip = async (idx: number) => {
    const item = clips[idx];
    if (!item?.clip.url) return;
    setBusy("Reading clip…");
    try {
      const buf = await decode(await (await fetch(item.clip.url)).arrayBuffer());
      setSource({ name: item.clip.name, buffer: buf, start: item.clip.start ?? 0 });
    } catch {
      toast.error("Couldn't read that clip");
    } finally { setBusy(null); }
  };

  type Result = { id: StemId; label: string; url: string; peaks: number[]; duration: number; added: boolean };
  const [results, setResults] = useState<Result[]>([]);
  const [playingId, setPlayingId] = useState<StemId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAudio = () => { audioRef.current?.pause(); audioRef.current = null; setPlayingId(null); };
  useEffect(() => () => stopAudio(), []);

  const run = async () => {
    if (!source) return;
    const ids = STEMS.filter((s) => picked[s.id]).map((s) => s.id);
    if (!ids.length) { toast("Pick at least one stem"); return; }
    if (ids.includes("instrumental") && !isStereo(source.buffer)) {
      toast("Vocal remove skipped", { description: "This audio is mono, so there's no centre to cancel." });
    }
    stopAudio();
    const out: Result[] = [];
    for (const id of ids) {
      if (id === "instrumental" && !isStereo(source.buffer)) continue;
      const label = STEMS.find((s) => s.id === id)!.label;
      setBusy(`Separating ${label}…`);
      try {
        const { left, right } = await separateStem(source.buffer, id);
        const sr = source.buffer.sampleRate;
        out.push({ id, label, url: URL.createObjectURL(encodeWav({ left, right, sampleRate: sr })), peaks: peaksOf(left), duration: left.length / sr, added: false });
      } catch {
        toast.error(`Couldn't make ${label}`);
      }
    }
    setResults(out);
    setBusy(null);
    if (out.length) toast.success("Stems separated", { description: "Play each one, then add the ones you want to the timeline." });
  };

  const togglePlay = (r: Result) => {
    if (playingId === r.id) { stopAudio(); return; }
    stopAudio();
    const a = new Audio(r.url);
    a.onended = () => setPlayingId(null);
    audioRef.current = a; setPlayingId(r.id);
    void a.play().catch(() => { setPlayingId(null); toast.error("Couldn't play this stem"); });
  };

  const addToTimeline = (r: Result) => {
    if (!source || r.added) return;
    const trackId = addTrack("audio", `${r.label.toUpperCase()} · ${source.name}`.slice(0, 40), undefined, { keepPanel: true });
    addClip(trackId, { id: `stem-${r.id}-${Date.now()}`, name: `${source.name} (${r.label})`, url: r.url, peaks: r.peaks, duration: r.duration, start: source.start, offset: 0, length: r.duration });
    setResults((rs) => rs.map((x) => (x.id === r.id ? { ...x, added: true } : x)));
    toast.success(`${r.label} added to the timeline`);
  };

  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">SEPARATE STEMS</h2>
        <p className="text-xs text-muted-foreground">
          Splits a song into simple parts using stereo and frequency filters on your device. This is not AI separation — expect
          some bleed between parts. Centre-panned vocals in a stereo mix give the best vocal remove.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="min-h-12" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          <Upload className="size-4" /> Load a song
        </Button>
        <input ref={inputRef} type="file" accept="audio/*" hidden onChange={(e) => void loadFile(e.target.files?.[0])} />
        {clips.length > 0 && (
          <select
            className="min-h-12 max-w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            defaultValue=""
            disabled={!!busy}
            onChange={(e) => e.target.value !== "" && void loadClip(Number(e.target.value))}
            aria-label="Use a clip from the timeline"
          >
            <option value="" disabled>…or use a timeline clip</option>
            {clips.map((c, i) => <option key={c.clip.id} value={i}>{c.track} — {c.clip.name}</option>)}
          </select>
        )}
      </div>

      {source && (
        <p className="font-mono text-xs text-primary">
          {source.name} · {source.buffer.duration.toFixed(1)}s · {isStereo(source.buffer) ? "stereo" : "mono"}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {STEMS.map((s) => (
          <label key={s.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3 ${picked[s.id] ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="checkbox" className="mt-1 size-4" checked={picked[s.id]} onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))} />
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <Button size="lg" className="min-h-12" disabled={!source || !!busy} onClick={() => void run()}>
        <Split className="size-4" /> {busy ?? "Separate"}
      </Button>

      {results.length > 0 && (
        <div className="space-y-2" aria-label="Separated stems">
          {results.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 p-2">
              <GeneratedWaveform peaks={r.peaks} label={`${r.label} waveform`} />
              <span className="min-w-24 flex-1 text-sm font-medium">{r.label} <span className="font-mono text-xs text-muted-foreground">{r.duration.toFixed(1)}s</span></span>
              <Button variant="secondary" className="min-h-11" onClick={() => togglePlay(r)} aria-label={`${playingId === r.id ? "Stop" : "Play"} ${r.label}`}>
                {playingId === r.id ? <Square className="size-4 fill-current" /> : <Play className="size-4" />} {playingId === r.id ? "Stop" : "Play"}
              </Button>
              <Button className="min-h-11" disabled={r.added} onClick={() => addToTimeline(r)} aria-label={`Add ${r.label} to timeline`}>
                <Plus className="size-4" /> {r.added ? "Added" : "Add to timeline"}
              </Button>
            </div>
          ))}
          <Button variant="outline" className="min-h-11" disabled={results.every((r) => r.added)} onClick={() => results.forEach(addToTimeline)}>Add all to timeline</Button>
        </div>
      )}
    </section>
  );
}
