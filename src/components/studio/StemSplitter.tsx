import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Split, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { encodeWav } from "@/lib/synclab/bounce";
import { isStereo, MAX_STEM_SECONDS, peaksOf, separateStems, STEMS, type StemId } from "@/lib/synclab/stems";
import { retainMediaInBackground } from "@/lib/synclab/media-library";
import { GeneratedWaveform } from "./GeneratedWaveform";
import { useServerFn } from "@tanstack/react-start";
import { cancelStemSplitFn, checkStemSplitFn, fetchStemFn, startStemSplitFn } from "@/utils/stem-split.functions";
import { AiUsesLeft, announceAiUse } from "./AiUsesLeft";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

const MAX_AI_BYTES = 40 * 1024 * 1024;
const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64: string, type: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type });
};
/** Demucs stem names for each SYNCLAB stem; instrumental is drums + bass + other summed. */
const AI_PARTS: Record<StemId, string[]> = { vocals: ["vocals"], drums: ["drums"], bass: ["bass"], music: ["other"], instrumental: ["drums", "bass", "other"] };

type Source = { name: string; buffer: AudioBuffer; start: number; blob: Blob };

export function StemSplitter() {
  const skin = useSkin("stemsplit");
  const skinDrop = useImageDrop("stemsplit");
  const skinned = !!(skin.image || skin.color);
  const { tracks, addTrack, addClip } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [picked, setPicked] = useState<Record<StemId, boolean>>({ vocals: true, drums: false, bass: false, music: false, instrumental: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [mode, setMode] = useState<"ai" | "device">("ai");
  const startAi = useServerFn(startStemSplitFn);
  const checkAi = useServerFn(checkStemSplitFn);
  const fetchAi = useServerFn(fetchStemFn);
  const cancelAi = useServerFn(cancelStemSplitFn);
  const cancelRef = useRef(false);

  const clips = useMemo(
    () => tracks.flatMap((t) => (t.clips ?? []).filter((c) => c.url).map((c) => ({ track: t.name, clip: c }))),
    [tracks],
  );

  const decode = async (data: ArrayBuffer) => {
    const ctx = new AudioContext();
    try { return await decodeAudioFile(ctx, data); } finally { void ctx.close(); }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    retainMediaInBackground(file, file.name);
    setBusy("Reading file…");
    try {
      setSource({ name: file.name.replace(/\.[^.]+$/, ""), buffer: await decode(await file.arrayBuffer()), start: 0, blob: file });
    } catch {
      toast.error("Couldn't read that audio file");
    } finally { setBusy(null); }
  };

  const loadClip = async (idx: number) => {
    const item = clips[idx];
    if (!item?.clip.url) return;
    setBusy("Reading clip…");
    try {
      const blob = await (await fetch(item.clip.url)).blob();
      const buf = await decode(await blob.arrayBuffer());
      setSource({ name: item.clip.name, buffer: buf, start: item.clip.start ?? 0, blob });
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

  const run = async (useMode: "ai" | "device" = mode) => {
    if (!source) return;
    const ids = STEMS.filter((s) => picked[s.id]).map((s) => s.id);
    if (!ids.length) { toast("Pick at least one stem"); return; }
    if (source.buffer.duration > MAX_STEM_SECONDS) { toast("Song too long", { description: "Separate up to 6 minutes at a time." }); return; }
    if (useMode === "ai") { await runAi(ids); return; }
    if (!isStereo(source.buffer) && (picked.vocals || picked.instrumental)) {
      toast("This audio is mono", { description: "Vocals are found by their centre position in a stereo mix, so a mono file will leave them mixed with other sounds." });
    }
    stopAudio();
    results.forEach((r) => { if (!r.added) URL.revokeObjectURL(r.url); });
    setResults([]);
    setBusy("Separating…");
    setProgress(0);
    try {
      const parts = await separateStems(source.buffer, ids, (p) => setProgress(p));
      const sr = source.buffer.sampleRate;
      const out: Result[] = [];
      for (const id of ids) {
        const part = parts[id];
        if (!part) continue;
        const label = STEMS.find((s) => s.id === id)!.label;
        const { left, right } = part;
        const peaks = peaksOf(left, 512).map((v, i) => Math.max(v, Math.abs(right[Math.floor((i * right.length) / 512)] ?? 0)));
        out.push({ id, label, url: URL.createObjectURL(encodeWav({ left, right, sampleRate: sr })), peaks, duration: left.length / sr, added: false });
      }
      setResults(out);
      if (out.length) toast.success("Stems separated", { description: "Play each one, then add the ones you want to the timeline." });
    } catch (e) {
      toast.error("Couldn't separate this song", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const runAi = async (ids: StemId[]) => {
    if (!source) return;
    if (source.blob.size > MAX_AI_BYTES) { toast("File too large for AI separation", { description: "Use a file under 40 MB (an MP3 works best), or switch to On-device." }); return; }
    stopAudio();
    results.forEach((r) => { if (!r.added) URL.revokeObjectURL(r.url); });
    setResults([]);
    cancelRef.current = false;
    setProgress(null);
    try {
      setBusy("Uploading…");
      const started = await startAi({ data: { audio: await toBase64(source.blob), name: `${source.name}.${source.blob.type.includes("wav") ? "wav" : "mp3"}`, mime: source.blob.type || "audio/mpeg" } });
      announceAiUse();
      if (!started.ok) throw new Error(started.error);
      setBusy("Separating with AI…");
      let stems: Record<string, string> | null = null;
      const deadline = Date.now() + 15 * 60_000;
      while (!stems) {
        await new Promise((r) => setTimeout(r, 4000));
        if (cancelRef.current) { void cancelAi({ data: { id: started.id } }).catch(() => {}); toast("Separation stopped"); return; }
        if (Date.now() > deadline) { void cancelAi({ data: { id: started.id } }).catch(() => {}); throw new Error("The separator took longer than 15 minutes, so it was stopped. Try a shorter song or an MP3."); }
        const res = await checkAi({ data: { id: started.id } });
        if (!res.ok) throw new Error(res.error);
        if (res.status.state === "failed") throw new Error(res.status.error);
        if (res.status.state === "done") stems = res.status.stems;
      }
      setBusy("Downloading stems…");
      const need = [...new Set(ids.flatMap((id) => AI_PARTS[id]))];
      const parts: Record<string, { blob: Blob; buffer: AudioBuffer }> = {};
      for (const name of need) {
        const url = stems[name];
        if (!url) continue;
        const got = await fetchAi({ data: { url } });
        if (!got.ok) throw new Error(got.error);
        const blob = fromBase64(got.mp3, "audio/mpeg");
        parts[name] = { blob, buffer: await decode(await blob.arrayBuffer()) };
      }
      const out: Result[] = [];
      for (const id of ids) {
        const label = STEMS.find((s) => s.id === id)!.label;
        const use = AI_PARTS[id].map((n) => parts[n]).filter((p): p is { blob: Blob; buffer: AudioBuffer } => !!p);
        if (!use.length) continue;
        const sr = use[0]!.buffer.sampleRate;
        const len = Math.max(...use.map((p) => p.buffer.length));
        const left = new Float32Array(len), right = new Float32Array(len);
        for (const p of use) {
          const l = p.buffer.getChannelData(0), r = p.buffer.numberOfChannels > 1 ? p.buffer.getChannelData(1) : l;
          for (let i = 0; i < l.length; i++) { left[i] = left[i]! + l[i]!; right[i] = right[i]! + r[i]!; }
        }
        const peaks = peaksOf(left, 512).map((v, i) => Math.max(v, Math.abs(right[Math.floor((i * right.length) / 512)] ?? 0)));
        const blob = use.length === 1 ? use[0]!.blob : encodeWav({ left, right, sampleRate: sr });
        out.push({ id, label, url: URL.createObjectURL(blob), peaks, duration: len / sr, added: false });
      }
      setResults(out);
      if (out.length) toast.success("Stems separated with AI", { description: "Play each one, then add the ones you want to the timeline." });
      else toast.error("The separator returned no stems");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const serviceDown = /credit|billing|402|busy|429|unavailable/i.test(msg);
      const description = /unauthor|401|jwt|session/i.test(msg) ? "Sign in to use AI stem separation." : serviceDown ? `${msg} Your AI use was given back. You can separate on this device for free instead.` : msg;
      toast.error("Couldn't separate this song", {
        ...(description ? { description } : {}),
        ...(serviceDown ? { duration: 15000, action: { label: "Separate on this device", onClick: () => { setMode("device"); void run("device"); } } } : {}),
      });
    } finally {
      setBusy(null);
      setProgress(null);
    }
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
    <section className={`space-y-4 rounded-md border border-border bg-surface-1 p-4${skinned ? " studio-wallpaper" : ""}`} data-skin-panel="stemsplit" style={skinBackground(skin)} {...skinDrop}>
      <SkinControls skinKey="stemsplit" image />
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">SEPARATE STEMS</h2>
        <p className="text-xs text-muted-foreground">
          {mode === "ai"
            ? "AI separation (Demucs) splits a song into clean Vocals, Drums, Bass and Music. Your song is uploaded to Replicate for processing, which costs a few cents per song on the connected Replicate account. A 3-minute song takes about 1–2 minutes."
            : "On-device separation analyses the sound spectrum: hits go to Drums, centre sounds in the voice range go to Vocals, low notes go to Bass. Free and private, but expect bleed between parts."}
        </p>
        {mode === "ai" && <AiUsesLeft />}
      </header>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Separation method">
        {([["ai", "AI — clean stems"], ["device", "On-device — free"]] as const).map(([id, label]) => (
          <Button key={id} role="radio" aria-checked={mode === id} variant={mode === id ? "default" : "outline"} className="min-h-11" disabled={!!busy} onClick={() => setMode(id)}>{label}</Button>
        ))}
      </div>

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

      <div className="flex flex-wrap items-center gap-2" aria-label="Get just one part">
        <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">JUST ONE:</span>
        {STEMS.map((s) => {
          const only = STEMS.every((o) => picked[o.id] === (o.id === s.id));
          return (
            <Button key={s.id} size="sm" className="min-h-11" variant={only ? "default" : "outline"} aria-pressed={only} disabled={!!busy}
              onClick={() => setPicked({ vocals: false, drums: false, bass: false, music: false, instrumental: false, [s.id]: true })}>
              Just {s.id === "instrumental" ? "the instrumental" : s.label.toLowerCase()}
            </Button>
          );
        })}
      </div>

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
        <Split className="size-4" /> {busy ? `${busy}${progress !== null ? ` ${Math.round(progress * 100)}%` : ""}` : "Separate"}
      </Button>
      {busy?.startsWith("Separating with AI") && (
        <Button variant="outline" className="ml-2 min-h-12" onClick={() => { cancelRef.current = true; }}>Stop</Button>
      )}
      {progress !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Separation progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

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
