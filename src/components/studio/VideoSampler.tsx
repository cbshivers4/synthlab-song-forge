import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Plus, Scissors, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { detectSampleChops } from "@/lib/synclab/sample-chops";
import { encodeWav } from "@/lib/synclab/bounce";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import { wsolaStretch } from "@/lib/synclab/stretch";
import { retainMediaInBackground, takeLibraryVideo } from "@/lib/synclab/media-library";

import { WaveformView } from "./WaveformView";

const PAD_KEYS = "1234qwerasdfzxcv";

/** Video sampler: load or film a clip, chop its audio at real attacks, trigger chops as pads (video + sound), and print chops to the timeline. */
export function VideoSampler() {
  const { addTrack, addClip, transport } = useStudio();
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<number>(0);
  const [url, setUrl] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [chops, setChops] = useState<number[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [filming, setFilming] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState(0);
  const [manualSlice, setManualSlice] = useState(false);
  const [stretchOn, setStretchOn] = useState(false);
  const [sourceBpm, setSourceBpm] = useState(120);
  const [targetBpm, setTargetBpm] = useState(() => Math.round(getEngine().tempo || 120));
  /** Playback speed for pads and printed chops; video seconds stay the reference for seeks and cuts. */
  const speed = stretchOn ? Math.max(0.5, Math.min(2, targetBpm / sourceBpm)) : 1;
  useEffect(() => {
    const v = video.current; if (!v) return;
    v.preservesPitch = true; v.playbackRate = speed;
  }, [speed, url]);
  const peaks = useMemo(() => {
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const bins = Math.min(1024, buffer.length);
    return Array.from({ length: bins }, (_, i) => {
      let peak = 0;
      const start = Math.floor(i * buffer.length / bins);
      const end = Math.floor((i + 1) * buffer.length / bins);
      for (const channel of channels) for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
      return peak;
    });
  }, [buffer]);
  const addChop = (time: number) => {
    if (!buffer) return;
    const at = Math.max(0, Math.min(buffer.duration - 0.01, time));
    if (chops.some((c) => Math.abs(c - at) < 0.01)) return;
    if (chops.length >= 16) { toast.info("All 16 chop pads are filled"); return; }
    setChops((current) => [...current, at].sort((a, b) => a - b));
  };
  const seek = (time: number) => {
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    if (video.current) video.current.currentTime = time;
    setActive(null); setPosition(time);
  };

  const release = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { release(); window.clearTimeout(stopTimer.current); }, []);

  const chopAll = (buf: AudioBuffer, sens: number) => {
    const fractions = detectSampleChops([buf.getChannelData(0)], buf.sampleRate, 0, 1, sens);
    setChops(fractions.map((f) => f * buf.duration));
  };

  const loadBlob = async (blob: Blob) => {
    if (blob instanceof File) retainMediaInBackground(blob, blob.name);
    setError(null);
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    setBuffer(null); setChops([]); setPosition(0); setActive(null);
    const next = URL.createObjectURL(blob);
    setUrl((old) => { if (old) URL.revokeObjectURL(old); return next; });
    try {
      const ctx = getEngine().init();
      const buf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      setBuffer(buf); chopAll(buf, sensitivity);
    } catch {
      setBuffer(null); setChops([]);
      setError("This video has no audio this browser can decode. Try an MP4 or WebM with sound.");
    }
  };

  useEffect(() => {
    const saved = takeLibraryVideo();
    if (saved) void loadBlob(saved.blob);
  }, []);

  const film = async () => {
    if (filming) { recorder.current?.stop(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; video.current.muted = true; void video.current.play(); }
      const rec = new MediaRecorder(s); const parts: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      rec.onstop = () => {
        setFilming(false); release();
        if (video.current) { video.current.srcObject = null; video.current.muted = false; }
        void loadBlob(new Blob(parts, { type: rec.mimeType || "video/webm" }));
      };
      recorder.current = rec; rec.start(); setFilming(true);
    } catch { setError("Camera or microphone access was blocked."); release(); }
  };

  const range = (i: number) => [chops[i] ?? 0, chops[i + 1] ?? buffer?.duration ?? 0] as const;
  const trigger = (i: number) => {
    const v = video.current; if (!v || !url) return;
    const [a, b] = range(i);
    window.clearTimeout(stopTimer.current);
    v.preservesPitch = true; v.playbackRate = speed;
    v.currentTime = a; void v.play(); setActive(i);
    stopTimer.current = window.setTimeout(() => { v.pause(); setActive(null); }, Math.max(50, (b - a) / speed * 1000));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const i = PAD_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && i < chops.length) trigger(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slice = (from: number, to: number) => {
    if (!buffer) return null;
    const s = Math.floor(from * buffer.sampleRate), e = Math.floor(to * buffer.sampleRate);
    let left: Float32Array = buffer.getChannelData(0).slice(s, e);
    let right: Float32Array = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice(s, e);
    if (speed !== 1 && left.length > 4096) { left = wsolaStretch(left, speed); right = wsolaStretch(right, speed); }
    return { left, right, sampleRate: buffer.sampleRate };
  };
  const toProject = async (i?: number) => {
    if (!buffer) return;
    const [a, b] = i == null ? [0, buffer.duration] : range(i);
    const cap = slice(a, b); if (!cap) return;
    const base = i == null ? "Video audio" : `Video chop ${i + 1}`;
    const name = speed !== 1 ? `${base} ${targetBpm} BPM` : base;
    const audio = await getEngine().loadSampleFile(encodeWav(cap), name);
    const id = addTrack("audio", name, undefined, { keepPanel: true });
    addClip(id, { ...audio, id: uid(), name, start: transport.step, offset: 0, length: audio.duration });
    toast.success(`${name} added at the playhead`);
  };

  return <section className="space-y-3" aria-label="Video sampler">
    <div className="overflow-hidden rounded border border-border bg-background">
      <video ref={video} src={url ?? undefined} playsInline className="aspect-video max-h-48 w-full bg-background object-contain sm:max-h-64" controls={!filming && !!url} aria-label="Video sample" onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)} onSeeked={(e) => setPosition(e.currentTarget.currentTime)} onEnded={() => setActive(null)} />
    </div>
    {buffer && <div className="sticky top-0 z-30 space-y-1 [@media(max-height:600px)]:static border-b border-border bg-background py-2" aria-label="Video audio waveform editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">Video audio · {position.toFixed(2)} / {buffer.duration.toFixed(2)}s</span>
        <Button variant={manualSlice ? "default" : "outline"} className="h-9" aria-pressed={manualSlice} onClick={() => setManualSlice((value) => !value)}><Scissors />Manual slice</Button>
      </div>
      <div className="relative h-28 min-h-28 w-full overflow-hidden rounded border border-border bg-surface-2 touch-pan-y" aria-label="Video chop waveform" onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        const time = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)) * buffer.duration;
        seek(time); if (manualSlice) addChop(time);
      }}>
        <WaveformView peaks={peaks} label="Video audio waveform" />
        {chops.map((time, i) => <Button key={`${time}-${i}`} variant="ghost" className="absolute inset-y-0 h-full w-6 -translate-x-1/2 rounded-none border-l-2 border-primary p-0 text-primary" style={{ left: `${time / buffer.duration * 100}%` }} aria-label={`Seek to video chop ${i + 1}`} title={`Chop ${i + 1} · ${time.toFixed(2)}s`} onClick={() => seek(time)}><span className="absolute top-0 bg-background px-1 font-mono text-[10px]">{i + 1}</span></Button>)}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-destructive" style={{ left: `${Math.min(100, position / buffer.duration * 100)}%` }} aria-hidden="true" />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">{[0, 0.25, 0.5, 0.75, 1].map((fraction) => <span key={fraction}>{(buffer.duration * fraction).toFixed(2)}s</span>)}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1" aria-label="Video time stretch">
        <Button variant={stretchOn ? "default" : "outline"} className="h-9" aria-pressed={stretchOn} onClick={() => setStretchOn((v) => !v)}>Time stretch {stretchOn ? "on" : "off"}</Button>
        <label className="flex items-center gap-1">Video BPM<input type="number" min={40} max={240} value={sourceBpm} aria-label="Video source BPM" className="h-9 w-16 rounded border border-border bg-surface-2 px-1 font-mono text-foreground" onChange={(e) => setSourceBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))} /></label>
        <label className="flex items-center gap-1">Target<input type="number" min={40} max={240} value={targetBpm} aria-label="Video target BPM" className="h-9 w-16 rounded border border-border bg-surface-2 px-1 font-mono text-foreground" onChange={(e) => setTargetBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))} /></label>
        <Button variant="ghost" className="h-9 px-2" onClick={() => setTargetBpm(Math.round(getEngine().tempo || 120))}>Song tempo</Button>
        <span className="font-mono">{Math.round(speed * 100)}% · {(buffer.duration / speed).toFixed(2)}s, pitch kept</span>
      </div>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="h-11" disabled={filming} onClick={() => file.current?.click()}><Upload />Load video</Button>
      <input ref={file} hidden type="file" accept="video/*" aria-label="Load video sample" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadBlob(f); e.target.value = ""; }} />
      <Button variant={filming ? "destructive" : "outline"} className="h-11" onClick={() => void film()}>{filming ? <Square /> : <Circle className="text-destructive" />}{filming ? "Stop filming" : "Record video"}</Button>
      <Button variant="outline" className="h-11" disabled={!buffer} onClick={() => void toProject()}><Plus />Audio to project</Button>
    </div>
    {buffer && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">Chop sensitivity<input type="range" min={0} max={1} step={0.05} value={sensitivity} className="accent-primary" onChange={(e) => setSensitivity(Number(e.target.value))} /></label>
      <Button variant="secondary" className="h-9" onClick={() => chopAll(buffer, sensitivity)}><Scissors />Auto-chop</Button>
      <Button variant="outline" className="h-9" onClick={() => addChop(video.current?.currentTime ?? 0)}>Chop at video position</Button>
      <span>{chops.length} chops · {buffer.duration.toFixed(1)}s</span>
    </div>}
    {chops.length > 0 && <div className="grid grid-cols-4 gap-2">
      {chops.map((t, i) => <div key={`${t}-${i}`} className="flex flex-col gap-1">
        <Button variant={active === i ? "default" : "secondary"} className="h-16 flex-col text-xs" onPointerDown={() => trigger(i)} aria-label={`Play video chop ${i + 1}`}>
          <span className="font-mono text-sm">{i + 1}</span><span className="font-mono text-[10px] opacity-70">{t.toFixed(2)}s · {PAD_KEYS[i]?.toUpperCase()}</span>
        </Button>
        <Button variant="ghost" className="h-7 text-[10px]" onClick={() => void toProject(i)}><Plus className="size-3" />To track</Button>
      </div>)}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-[11px] text-muted-foreground">Chops are found from the video's real audio attacks. Pads play the video and its sound together; "To track" prints the chop's audio to the timeline. Time stretch keeps pitch, plays pads at the new speed and prints stretched audio (50%–200%). Video itself is not exported with the song.</p>
  </section>;
}
