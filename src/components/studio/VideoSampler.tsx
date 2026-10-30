import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { SampleExportButtons } from "./SampleExportButtons";
import { BypassButton } from "./HardwareBypass";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Grid3x3, Piano, Plus, Save, Scissors, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { detectSampleChops } from "@/lib/synclab/sample-chops";
import { encodeWav } from "@/lib/synclab/bounce";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import { wsolaStretch } from "@/lib/synclab/stretch";
import { retainMediaInBackground, takeLibraryVideo, type VideoKit } from "@/lib/synclab/media-library";
import { saveToLibrary } from "@/lib/synclab/library";
import { loadVideoSession, saveVideoSession } from "@/lib/synclab/autosave-media";
import { moveVideoChop, snapVideoTime } from "@/lib/synclab/video-chops";
import { VIDEO_PAD_KEYS, videoPadForNote, assignVideoPadNote, type VideoPadMidiNote } from "@/lib/synclab/video-pad-map";
import { claimMidiNotes, midiSupported } from "@/lib/synclab/midi";

import { WaveformView } from "./WaveformView";
import { Keyboard } from "./Keyboard";

const PAD_KEYS = VIDEO_PAD_KEYS;

/** Video sampler: load or film a clip, chop its audio at real attacks, trigger chops as pads (video + sound), and print chops to the timeline. */
export function VideoSampler() {
  const { addTrack, addClip, transport, loadSample, updateSampler, select, setPanel, midiInputId, midiInputs, enableMidi, setMidiInput } = useStudio();
  const [midiNotes, setMidiNotes] = useState<VideoPadMidiNote[]>([]);
  const [learnPad, setLearnPad] = useState<number | null>(null);
  const consumedNotes = useRef(new Set<string>());
  const blobRef = useRef<{ blob: Blob; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const [videoHeight, setVideoHeight] = useState(220);
  useEffect(() => { const v = Number(localStorage.getItem("synclab.videoHeight")); if (v >= 120 && v <= 720) setVideoHeight(v); }, []);
  const setVideoSize = (h: number) => { setVideoHeight(h); localStorage.setItem("synclab.videoHeight", String(h)); };
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
  const [noteGrid, setNoteGrid] = useState(0);
  const [chopCount, setChopCount] = useState(4);
  const waveform = useRef<HTMLDivElement>(null);
  const dragChop = useRef<{ index: number; pointer: number } | null>(null);
  const [stretchOn, setStretchOn] = useState(false);
  const [sourceBpm, setSourceBpm] = useState(120);
  const [targetBpm, setTargetBpm] = useState(() => Math.round(getEngine().tempo || 120));
  const [showKeyboard, setShowKeyboard] = useState(true);
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
  const padPeaks = useMemo(() => {
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return chops.map((time, i) => {
      const start = Math.floor(time * buffer.sampleRate);
      const end = Math.floor((chops[i + 1] ?? buffer.duration) * buffer.sampleRate);
      return Array.from({ length: 96 }, (_, bin) => {
        let peak = 0;
        const a = start + Math.floor(bin * (end - start) / 96);
        const b = start + Math.floor((bin + 1) * (end - start) / 96);
        for (const channel of channels) for (let j = a; j < b; j++) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
        return peak;
      });
    });
  }, [buffer, chops]);
  const gridLines = useMemo(() => {
    if (!buffer || !noteGrid) return [];
    const interval = 240 / sourceBpm / noteGrid;
    // Bound drawing density for long videos while keeping the real snapping interval.
    const stride = Math.max(1, Math.ceil(buffer.duration / interval / 128));
    return Array.from({ length: Math.ceil(buffer.duration / interval / stride) }, (_, i) => i * stride * interval);
  }, [buffer, sourceBpm, noteGrid]);
  const waveformTime = (clientX: number, clientY: number) => {
    const waveEl = waveform.current;
    if (!waveEl || !buffer) return 0;
    const bounds = canvasRect(waveEl);
    return Math.max(0, Math.min(buffer.duration - 0.01, snapVideoTime((canvasPoint(clientX, clientY).x - bounds.left) / bounds.width * buffer.duration, sourceBpm, noteGrid)));
  };
  const editChop = (i: number, time: number) => {
    if (!buffer) return;
    seek(time);
    setChops((current) => moveVideoChop(current, i, time, buffer.duration));
  };
  const addChop = (time: number) => {
    if (!buffer) return;
    const at = Math.max(0, Math.min(buffer.duration - 0.01, snapVideoTime(time, sourceBpm, noteGrid)));
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

  const loadBlob = async (blob: Blob, name = blob instanceof File ? blob.name : "Video", kit?: VideoKit) => {
    if (blob instanceof File) retainMediaInBackground(blob, blob.name);
    blobRef.current = { blob, name };
    setError(null);
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    setBuffer(null); setChops([]); setPosition(0); setActive(null);
    const next = URL.createObjectURL(blob);
    setUrl((old) => { if (old) URL.revokeObjectURL(old); return next; });
    try {
      const ctx = getEngine().init();
      const buf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      setBuffer(buf);
      if (kit) {
        setChops(kit.chops.filter((c) => Number.isFinite(c) && c >= 0 && c < buf.duration).sort((a, b) => a - b).slice(0, 16));
        setSourceBpm(kit.sourceBpm); setTargetBpm(kit.targetBpm); setStretchOn(kit.stretchOn);
        setNoteGrid(kit.noteGrid ?? 0); setChopCount(kit.chopCount ?? 4);
        setSensitivity(kit.sensitivity ?? 0.5); setManualSlice(kit.manualSlice ?? false);
        setMidiNotes(kit.midiNotes ?? []); setLearnPad(null);
      } else { setNoteGrid(0); setMidiNotes([]); setLearnPad(null); chopAll(buf, sensitivity); }
    } catch {
      setBuffer(null); setChops([]);
      setError("This video has no audio this browser can decode. Try an MP4 or WebM with sound.");
    }
  };

  useEffect(() => {
    const saved = takeLibraryVideo();
    if (saved) { void loadBlob(saved.blob, saved.name, saved.kit); return; }
    void loadVideoSession().then((v) => { if (v && !blobRef.current) { void loadBlob(v.blob, v.name, v); toast.info(`Restored ${v.name} and its chops`); } });
  }, []);
  // Auto save the open video and chops so an accidental close keeps them.
  useEffect(() => {
    const cur = blobRef.current; if (!cur || !buffer) return;
    const persist = () => void saveVideoSession({ ...cur, chops, sourceBpm, targetBpm, stretchOn, noteGrid, chopCount, sensitivity, manualSlice, midiNotes });
    const id = window.setTimeout(persist, 500);
    const onHide = () => { if (document.visibilityState === "hidden") persist(); };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.clearTimeout(id); persist(); window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", onHide); };
  }, [buffer, chops, sourceBpm, targetBpm, stretchOn, noteGrid, chopCount, sensitivity, manualSlice, midiNotes]);

  const kitName = () => (blobRef.current?.name ?? "Video").replace(/\.[^.]+$/, "");
  const saveKit = async () => {
    const cur = blobRef.current; if (!cur) return;
    setSaving(true);
    try {
      await saveToLibrary({ kind: "sample", location: "cloud", folder: "Video kits", name: `${kitName()} · ${chops.length} chops`, audio: cur.blob,
        data: { mediaType: "video", mimeType: cur.blob.type || "video/mp4", filename: cur.name, videoKit: { chops, sourceBpm, targetBpm, stretchOn, noteGrid, chopCount, sensitivity, manualSlice, midiNotes } } });
      toast.success("Video and chops saved to your library", { description: "My Library › Video kits — opens on phone and desktop" });
    } catch (e) { toast.error("Could not save the video", { description: e instanceof Error ? e.message : "Sign in and try again." }); }
    finally { setSaving(false); }
  };
  /** Hands the video's audio and chops to a Sampler track so every sampler control (trim, ADSR, filter, banks, choke, keyboard, stretch) applies. */
  const openInSampler = async () => {
    if (!buffer) return;
    const cap = slice(0, buffer.duration); if (!cap) return;
    const name = kitName().toUpperCase().slice(0, 16) || "VIDEO";
    const id = addTrack("sampler", name, undefined, { keepPanel: true });
    await loadSample(id, new File([encodeWav(cap)], `${name}.wav`, { type: "audio/wav" }));
    updateSampler(id, { slices: chops.map((c) => c / buffer.duration), sampleBpm: stretchOn ? targetBpm : sourceBpm });
    select(id); setPanel("sampler");
  };
  const evenChops = (n: number) => { if (buffer) { seek(0); setChopCount(n); setChops(Array.from({ length: n }, (_, i) => i * buffer.duration / n)); } };
  const removeChop = (i: number) => { seek(position); setChops((c) => c.filter((_, j) => j !== i)); setMidiNotes((notes) => notes.filter((_, j) => j !== i)); setLearnPad(null); };

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
        if (video.current) { video.current.srcObject = null; }
        void loadBlob(new Blob(parts, { type: rec.mimeType || "video/webm" }));
      };
      recorder.current = rec; rec.start(); setFilming(true);
    } catch { setError("Camera or microphone access was blocked."); release(); }
  };

  const range = (i: number) => [chops[i] ?? 0, chops[i + 1] ?? buffer?.duration ?? 0] as const;
  const trigger = (i: number) => {
    const v = video.current; if (!v || !url || filming || i < 0 || i >= chops.length) return;
    const [a, b] = range(i);
    window.clearTimeout(stopTimer.current);
    v.preservesPitch = true; v.playbackRate = speed;
    v.currentTime = a; void v.play(); setActive(i);
    stopTimer.current = window.setTimeout(() => { v.pause(); setActive(null); }, Math.max(50, (b - a) / speed * 1000));
  };

  const learnNote = (index: number, pitch: number, channel: number) => {
    setMidiNotes((notes) => assignVideoPadNote(notes, index, { pitch, channel }));
    setLearnPad(null);
    toast.success(`Pad ${index + 1} · MIDI note ${pitch}, channel ${channel + 1}`);
  };
  useEffect(() => claimMidiNotes((msg) => {
    if (msg.type !== "on" && msg.type !== "off") return false;
    const key = `${msg.channel}:${msg.pitch}`;
    if (msg.type === "off") return consumedNotes.current.delete(key);
    if (filming || !chops.length) return false;
    if (learnPad !== null && learnPad < chops.length) {
      consumedNotes.current.add(key); learnNote(learnPad, msg.pitch, msg.channel); return true;
    }
    const index = midiNotes.findIndex((note, i) => i < chops.length && note?.pitch === msg.pitch && note.channel === msg.channel);
    if (index < 0) return false;
    consumedNotes.current.add(key); trigger(index); return true;
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.isContentEditable || (e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const i = PAD_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && i < chops.length && !filming) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat) trigger(i);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
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
    addClip(id, { ...audio, id: uid(), name, start: getPlayStep(), offset: 0, length: audio.duration });
    toast.success(`${name} added at the playhead`);
  };

  return <section className="space-y-3" aria-label="Video sampler">
    <div className="flex items-center justify-between gap-2"><span className="label-xs">SYNCLAB · VIDEO SAMPLER</span><BypassButton name="Video Sampler" bypassed={bypassed} onToggle={() => setBypassed(value => !value)} /></div>
    <div className="overflow-hidden rounded border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Video size">
        <span className="font-mono text-[10px] text-muted-foreground">VIDEO SIZE</span>
        {([["S", 160], ["M", 260], ["L", 380], ["XL", 520]] as const).map(([l, h]) => <Button key={l} size="sm" variant={videoHeight === h ? "default" : "outline"} className="h-9 min-w-10" aria-label={`Video size ${l}`} onClick={() => setVideoSize(h)}>{l}</Button>)}
        <input type="range" min={120} max={720} step={10} value={videoHeight} onChange={(e) => setVideoSize(Number(e.target.value))} aria-label="Video height" className="min-w-24 flex-1" />
        <Button size="sm" variant="outline" className="h-9" onClick={() => void video.current?.requestFullscreen?.().catch(() => toast.error("Full screen isn't available here"))}>Full screen</Button>
      </div>
      <video ref={video} src={url ?? undefined} muted={bypassed || filming} playsInline style={{ height: `${videoHeight}px` }} className="w-full bg-background object-contain" controls={!filming && !!url} aria-label="Video sample" onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)} onSeeked={(e) => setPosition(e.currentTarget.currentTime)} onEnded={() => setActive(null)} />
    </div>
    {buffer && <div className="space-y-1 border-b border-border bg-background py-2" aria-label="Video audio waveform editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">Video audio · {position.toFixed(2)} / {buffer.duration.toFixed(2)}s</span>
        <Button variant={manualSlice ? "default" : "outline"} className="h-9" aria-pressed={manualSlice} onClick={() => setManualSlice((value) => !value)}><Scissors />Manual slice</Button>
      </div>
      <div ref={waveform} className="relative h-36 min-h-36 w-full overflow-hidden rounded border border-border bg-surface-2 touch-pan-y" aria-label="Video chop waveform" onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        const time = waveformTime(e.clientX, e.clientY);
        seek(time); if (manualSlice) addChop(time);
      }}>
        <WaveformView peaks={peaks} label="Video audio waveform" />
        {gridLines.map((time) => <div key={time} className="pointer-events-none absolute inset-y-0 border-l border-border" style={{ left: `${time / buffer.duration * 100}%` }} aria-hidden="true" />)}
        {chops.map((time, i) => <Button key={i} variant="ghost" className="absolute inset-y-0 z-10 h-full w-9 -translate-x-1/2 touch-none rounded-none p-0 text-destructive hover:bg-transparent" style={{ left: `${time / buffer.duration * 100}%` }} aria-label={`Edit video chop ${i + 1}`} title={`Chop ${i + 1} · ${time.toFixed(2)}s`} onPointerDown={(e) => {
          e.stopPropagation(); e.preventDefault();
          dragChop.current = { index: i, pointer: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId); seek(time);
        }} onPointerMove={(e) => {
          if (dragChop.current?.pointer === e.pointerId && dragChop.current.index === i) editChop(i, waveformTime(e.clientX, e.clientY));
        }} onPointerUp={() => { dragChop.current = null; }} onPointerCancel={() => { dragChop.current = null; }} onLostPointerCapture={() => { dragChop.current = null; }} onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault(); const delta = noteGrid ? 240 / sourceBpm / noteGrid : 0.01;
          editChop(i, time + (e.key === "ArrowLeft" ? -delta : delta));
        }} onClick={() => seek(time)}><span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-destructive" /><span className="pointer-events-none absolute top-0 bg-destructive px-1 font-mono text-xs text-destructive-foreground">{i + 1}</span></Button>)}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: `${Math.min(100, position / buffer.duration * 100)}%` }} aria-hidden="true" />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">{[0, 0.25, 0.5, 0.75, 1].map((fraction) => <span key={fraction}>{(buffer.duration * fraction).toFixed(2)}s</span>)}</div>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Note grid<select aria-label="Video note grid" value={noteGrid} className="h-10 rounded border border-border bg-surface-2 px-2 text-foreground" onChange={(e) => setNoteGrid(Number(e.target.value))}><option value={0}>Off</option>{[1, 2, 4, 8, 16, 32, 64].map((n) => <option key={n} value={n}>1/{n}</option>)}</select></label>
        <span className="text-xs text-muted-foreground">Chops</span>
        <div className="flex gap-1" role="group" aria-label="Video chop counts">{[4, 8, 12, 16].map((n) => <Button key={n} variant={chopCount === n ? "secondary" : "outline"} className="h-10 min-w-10 px-2 font-mono" aria-label={`Make ${n} video chops`} onClick={() => evenChops(n)}>{n}</Button>)}</div>
      </div>
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
      <Button variant="outline" className="h-11" disabled={!buffer} onClick={() => void toProject()}><Plus />Add to timeline</Button>
      <SampleExportButtons timeline={false} className="h-11 gap-1.5" name={kitName()} getCapture={() => buffer ? slice(0, buffer.duration) : null} />
      <Button variant="outline" className="h-11" disabled={!buffer || saving} onClick={() => void saveKit()}><Save />{saving ? "Saving…" : "Save video & chops"}</Button>
      <Button variant="secondary" className="h-11" disabled={!buffer} onClick={() => void openInSampler()} title="Opens the audio and chops in the full Sampler: trim, envelope, filter, chop banks, choke, keyboard and stretch">Open in Sampler</Button>
    </div>
    {buffer && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">Chop sensitivity<input type="range" min={0} max={1} step={0.05} value={sensitivity} className="accent-primary" onChange={(e) => setSensitivity(Number(e.target.value))} /></label>
      <Button variant="secondary" className="h-9" onClick={() => chopAll(buffer, sensitivity)}><Scissors />Auto-chop</Button>
      <Button variant="outline" className="h-9" onClick={() => addChop(video.current?.currentTime ?? 0)}>Chop at video position</Button>
      <label className="flex items-center gap-1"><Grid3x3 className="size-4" /><select aria-label="Even chops" className="h-9 rounded border border-border bg-background px-2 text-foreground" value="" onChange={(e) => { if (e.target.value) evenChops(Number(e.target.value)); }}><option value="">Even chops</option>{[2, 4, 8, 12, 16].map((n) => <option key={n} value={n}>{n} equal</option>)}</select></label>
      <Button variant="ghost" className="h-9" disabled={!chops.length} onClick={() => setChops([])}>Clear chops</Button>
      <span>{chops.length} chops · {buffer.duration.toFixed(1)}s</span>
    </div>}
    {chops.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Video chop pads">
      {chops.map((t, i) => <div key={i} className="flex min-w-0 flex-col gap-1">
        <Button variant="secondary" data-active={active === i} data-pad-color={i % 4} aria-pressed={active === i} disabled={filming} className="video-chop-pad h-36 min-w-0 flex-col gap-2 border px-3 py-2 text-xs" onClick={() => trigger(i)} aria-label={`Play video chop ${i + 1}`}>
          <span className="flex w-full justify-between font-mono text-sm"><span>{i + 1}</span><span>{PAD_KEYS[i]?.toUpperCase()} · {['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C','C♯','D','D♯'][i]}{i < 12 ? '4' : '5'}</span></span>
          <span className="pointer-events-none block h-16 w-full overflow-hidden"><WaveformView color="var(--display-wave)" grid={false} className="!h-full !w-full" peaks={padPeaks[i] ?? []} label={`Video chop ${i + 1} waveform`} /></span>
          <span className="font-mono text-[10px]">{t.toFixed(2)}–{(chops[i + 1] ?? buffer?.duration ?? 0).toFixed(2)}s</span>
        </Button>
        <div className="flex items-center gap-1">
          <Button variant={learnPad === i ? "default" : "outline"} className="h-10 min-w-0 flex-1 px-1 text-xs" aria-label={`MIDI Learn video pad ${i + 1}`} aria-pressed={learnPad === i} disabled={filming} onClick={() => {
            if (learnPad === i) { setLearnPad(null); return; }
            setLearnPad(i); if (!midiInputId) enableMidi();
          }}>{learnPad === i ? "Press a key…" : midiNotes[i] ? `MIDI ${midiNotes[i]?.pitch} · CH ${(midiNotes[i]?.channel ?? 0) + 1}` : "MIDI Learn"}</Button>
          {midiNotes[i] && <Button variant="ghost" size="icon" className="size-10" aria-label={`Clear video pad ${i + 1} MIDI mapping`} onClick={() => setMidiNotes((notes) => notes.map((note, j) => j === i ? null : note))}><Trash2 className="size-3" /></Button>}
        </div>
        <label className="flex items-center justify-between gap-1 text-xs text-muted-foreground">Start<input type="number" min={chops[i - 1] == null ? 0 : (chops[i - 1] ?? 0) + 0.01} max={(chops[i + 1] ?? buffer?.duration ?? 0) - 0.01} step={0.01} value={Number(t.toFixed(3))} aria-label={`Video chop ${i + 1} start seconds`} className="h-9 w-20 rounded border border-border bg-surface-2 px-1 font-mono text-foreground" onChange={(e) => { const value = e.currentTarget.valueAsNumber; if (Number.isFinite(value)) editChop(i, snapVideoTime(value, sourceBpm, noteGrid)); }} /></label>
        <div className="flex"><Button variant="ghost" className="h-10 flex-1 px-1 text-xs" onClick={() => void toProject(i)}><Plus className="size-3" />To track</Button><Button variant="ghost" className="h-10 w-10 p-0" aria-label={`Delete video chop ${i + 1}`} onClick={() => removeChop(i)}><Trash2 className="size-4" /></Button></div>
      </div>)}
    </div>}
    {chops.length > 0 && <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="h-10" onClick={() => enableMidi()}>Connect MIDI keyboard</Button>
      <select aria-label="Video MIDI input" className="h-10 max-w-full rounded border border-border bg-surface px-2 text-xs text-foreground" value={midiInputId ?? ""} onChange={(e) => setMidiInput(e.target.value || null)}><option value="">None</option><option value="all">All devices</option>{midiInputs.map((input) => <option key={input.id} value={input.id}>{input.name}</option>)}</select>
      {!midiSupported() && <span className="text-xs text-muted-foreground">Hardware MIDI needs a supported browser, such as Chrome or Edge.</span>}
    </div>}
    {chops.length > 0 && <Button variant={showKeyboard ? "secondary" : "outline"} aria-pressed={showKeyboard} onClick={() => setShowKeyboard((value) => !value)}><Piano className="size-4" />{showKeyboard ? "Hide keyboard" : "Show keyboard"}</Button>}
    {chops.length > 0 && showKeyboard && <section aria-label="Video sampler keyboard" className="min-w-0 border-t border-border pt-3"><Keyboard skinKey="video-keyboard" disabled={filming} mappedPads={{ count: chops.length, active, keys: PAD_KEYS }} onPlay={(note) => { if (learnPad !== null) { learnNote(learnPad, note, 0); return; } const index = videoPadForNote(note, chops.length); if (index !== null) trigger(index); }} /></section>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-[11px] text-muted-foreground">Video itself is not exported with the song. Audio decoding and pitch-preserving video playback depend on browser codec support. Account saving requires sign-in.</p>
  </section>;
}
