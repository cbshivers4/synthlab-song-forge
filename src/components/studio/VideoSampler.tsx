import { useEffect, useRef, useState } from "react";
import { Circle, Plus, Scissors, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { detectSampleChops } from "@/lib/synclab/sample-chops";
import { encodeWav } from "@/lib/synclab/bounce";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";

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

  const release = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { release(); window.clearTimeout(stopTimer.current); }, []);

  const chopAll = (buf: AudioBuffer, sens: number) => {
    const fractions = detectSampleChops([buf.getChannelData(0)], buf.sampleRate, 0, 1, sens);
    setChops(fractions.map((f) => f * buf.duration));
  };

  const loadBlob = async (blob: Blob) => {
    setError(null);
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
    v.currentTime = a; void v.play(); setActive(i);
    stopTimer.current = window.setTimeout(() => { v.pause(); setActive(null); }, Math.max(50, (b - a) * 1000));
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
    const left = buffer.getChannelData(0).slice(s, e);
    const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice(s, e);
    return { left, right, sampleRate: buffer.sampleRate };
  };
  const toProject = async (i?: number) => {
    if (!buffer) return;
    const [a, b] = i == null ? [0, buffer.duration] : range(i);
    const cap = slice(a, b); if (!cap) return;
    const name = i == null ? "Video audio" : `Video chop ${i + 1}`;
    const audio = await getEngine().loadSampleFile(encodeWav(cap), name);
    const id = addTrack("audio", name, undefined, { keepPanel: true });
    addClip(id, { ...audio, id: uid(), name, start: transport.step, offset: 0, length: audio.duration });
    toast.success(`${name} added at the playhead`);
  };

  return <section className="space-y-3" aria-label="Video sampler">
    <div className="overflow-hidden rounded border border-border bg-background">
      <video ref={video} src={url ?? undefined} playsInline className="aspect-video w-full bg-background" controls={!filming && !!url} aria-label="Video sample" />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="h-11" disabled={filming} onClick={() => file.current?.click()}><Upload />Load video</Button>
      <input ref={file} hidden type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadBlob(f); e.target.value = ""; }} />
      <Button variant={filming ? "destructive" : "outline"} className="h-11" onClick={() => void film()}>{filming ? <Square /> : <Circle className="text-destructive" />}{filming ? "Stop filming" : "Record video"}</Button>
      <Button variant="outline" className="h-11" disabled={!buffer} onClick={() => void toProject()}><Plus />Audio to project</Button>
    </div>
    {buffer && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">Chop sensitivity<input type="range" min={0} max={1} step={0.05} value={sensitivity} className="accent-primary" onChange={(e) => setSensitivity(Number(e.target.value))} /></label>
      <Button variant="secondary" className="h-9" onClick={() => chopAll(buffer, sensitivity)}><Scissors />Auto-chop</Button>
      <Button variant="outline" className="h-9" onClick={() => { const t = video.current?.currentTime ?? 0; setChops((c) => [...new Set([...c, t])].sort((x, y) => x - y).slice(0, 16)); }}>Chop at video position</Button>
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
    <p className="text-[11px] text-muted-foreground">Chops are found from the video's real audio attacks. Pads play the video and its sound together; "To track" prints the chop's audio to the timeline. Video itself is not exported with the song.</p>
  </section>;
}
