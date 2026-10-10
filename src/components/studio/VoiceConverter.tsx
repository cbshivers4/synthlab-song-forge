import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Square, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { GeneratedWaveform } from "./GeneratedWaveform";
import { useStudio } from "@/lib/synclab/store";
import { encodeWav } from "@/lib/synclab/bounce";
import { peaksOf } from "@/lib/synclab/stems";
import { openMic, preferredRecordingMime, releaseMic } from "@/lib/synclab/mic";
import { convertVoice, VOICE_PRESETS, type VoicePreset } from "@/lib/synclab/voice-convert";
import { retainMediaInBackground } from "@/lib/synclab/media-library";

type Source = { name: string; buffer: AudioBuffer; start: number };

async function decode(data: ArrayBuffer) {
  const ctx = new AudioContext();
  try { return await ctx.decodeAudioData(data); } finally { void ctx.close(); }
}

export function VoiceConverter() {
  const { tracks, addTrack, addClip } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [preset, setPreset] = useState<VoicePreset>("deep");
  const [semis, setSemis] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<{ url: string; data: Float32Array; sr: number } | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); if (recRef.current?.state === "recording") recRef.current.stop(); }, []);

  const clips = useMemo(() => tracks.flatMap((t) => (t.clips ?? []).filter((c) => c.url).map((c) => ({ track: t.name, clip: c }))), [tracks]);

  const take = async (name: string, data: ArrayBuffer, start = 0) => {
    setBusy("Reading audio…");
    try { setSource({ name, buffer: await decode(data), start }); setPreview(null); }
    catch { toast.error("Couldn't read that audio"); }
    finally { setBusy(null); }
  };

  const record = async () => {
    if (recording) { recRef.current?.stop(); return; }
    const r = await openMic(undefined, "voice-convert");
    if (!("stream" in r)) { toast.error("Microphone unavailable", { description: r.error }); return; }
    const mime = preferredRecordingMime();
    const rec = new MediaRecorder(r.stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      releaseMic(r.stream);
      setRecording(false);
      await take("MY VOICE", await new Blob(chunks, { type: rec.mimeType }).arrayBuffer());
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const convert = async () => {
    if (!source) return;
    if (source.buffer.duration > 180) { toast("Keep it under 3 minutes", { description: "Long files can freeze the page." }); return; }
    setBusy("Converting…");
    await new Promise((r) => setTimeout(r, 30));
    try {
      const data = await convertVoice(source.buffer, preset, semis);
      const sr = source.buffer.sampleRate;
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(encodeWav({ left: data, right: data, sampleRate: sr })), data, sr });
    } catch { toast.error("Couldn't convert that audio"); }
    finally { setBusy(null); }
  };

  const listen = () => {
    if (!preview) return;
    audioRef.current?.pause();
    const a = new Audio(preview.url);
    audioRef.current = a;
    void a.play();
  };

  const pv = usePreviewTrack();
  const presetLabel = VOICE_PRESETS.find((p) => p.id === preset)!.label;
  const build = (name: string) => {
    if (!preview || !source) return "";
    const duration = preview.data.length / preview.sr;
    const id = addTrack("audio", name, undefined, { keepPanel: true });
    addClip(id, { id: `voice-${Date.now()}`, name: `${source.name} (${presetLabel})`, url: preview.url, peaks: peaksOf(preview.data), duration, start: source.start, offset: 0, length: duration });
    return id;
  };
  const previewWithSong = () => { if (!preview || !source) return; audioRef.current?.pause(); pv.start((n) => build(n(`VOICE · ${presetLabel.toUpperCase()}`))); };
  const addToTimeline = () => {
    if (!preview || !source) return;
    const name = `VOICE · ${presetLabel.toUpperCase()}`;
    if (!pv.keep(name)) build(name);
    toast.success("Converted voice added to a new track");
    setPreview(null);
  };

  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">CONVERT VOICE</h2>
        <p className="text-xs text-muted-foreground">
          Change how a vocal sounds with pitch and tone effects, processed on your device. This is not AI voice cloning — it can't make you sound like a specific singer.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant={recording ? "destructive" : "secondary"} className="min-h-12" onClick={() => void record()} disabled={!!busy}>
          {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />} {recording ? "Stop recording" : "Record voice"}
        </Button>
        <Button variant="secondary" className="min-h-12" onClick={() => inputRef.current?.click()} disabled={!!busy || recording}>
          <Upload className="size-4" /> Load a file
        </Button>
        <input ref={inputRef} type="file" accept="audio/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { retainMediaInBackground(f, f.name); await take(f.name.replace(/\.[^.]+$/, ""), await f.arrayBuffer()); } }} />
        {clips.length > 0 && (
          <select className="min-h-12 max-w-full rounded-md border border-border bg-surface-2 px-3 text-sm" defaultValue="" disabled={!!busy || recording}
            aria-label="Use a clip from the timeline"
            onChange={async (e) => { const c = clips[Number(e.target.value)]; if (c?.clip.url) await take(c.clip.name, await (await fetch(c.clip.url)).arrayBuffer(), c.clip.start ?? 0); }}>
            <option value="" disabled>…or use a timeline clip</option>
            {clips.map((c, i) => <option key={c.clip.id} value={i}>{c.track} — {c.clip.name}</option>)}
          </select>
        )}
      </div>

      {source && <p className="font-mono text-xs text-primary">{source.name} · {source.buffer.duration.toFixed(1)}s</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VOICE_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => { setPreset(p.id); setPreview(null); }} title={p.hint}
            className={`min-h-12 rounded-md border p-2 text-left ${preset === p.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="block text-[10px] leading-tight text-muted-foreground">{p.hint}</span>
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <label className="flex items-center gap-3 text-sm">
          Pitch <input type="range" min={-12} max={12} step={1} value={semis} onChange={(e) => { setSemis(Number(e.target.value)); setPreview(null); }} className="flex-1" />
          <span className="w-16 font-mono text-xs">{semis > 0 ? "+" : ""}{semis} st</span>
        </label>
      )}

      {preview && <GeneratedWaveform data={preview.data} label="Converted voice waveform" />}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="min-h-12" disabled={!source || !!busy || recording} onClick={() => void convert()}>
          <Wand2 className="size-4" /> {busy ?? "Convert"}
        </Button>
        {preview && <>
          <Button size="lg" variant="secondary" className="min-h-12" onClick={listen}><Play className="size-4" /> Listen alone</Button>
          <PreviewButtons pv={pv} onPreview={previewWithSong} onAdd={addToTimeline} />
        </>}
      </div>
    </section>
  );
}
