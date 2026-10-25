import { WaveformZoom, waveformFraction, useWaveformDetail } from "./WaveformZoom";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AudioLines, Piano, Play, RotateCcw, Scissors, Square, Trash2, Upload } from "lucide-react";
import { Keyboard } from "./Keyboard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { toast } from "sonner";
import { getEngine } from "@/lib/synclab/audio-engine";
import { encodeMp3, encodeWav } from "@/lib/synclab/bounce";
import { uid } from "@/lib/synclab/presets";
import { wsolaStretch } from "@/lib/synclab/stretch";
import { WaveformView } from "@/components/studio/WaveformView";
import { MidiLearnButton } from "./MidiLearn";
import { MidiPadLearnBar, useMidiPads } from "./MidiPadLearn";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { getPadBank, setPadBank, type SavedPad } from "@/lib/synclab/pad-session";
import { detectSampleChops } from "@/lib/synclab/sample-chops";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const AUDIO_RE = /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i;
/** every chop gets its own colour so a sliced sample reads at a glance */
const chopColor = (i: number) => `hsl(${(187 + i * 27) % 360} 85% 56%)`;

function Row({ label, value, children, midiId, midiParam }: { label: string; value: string; children: React.ReactNode; midiId?: string; midiParam?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className="font-mono text-[10px] text-primary">{value}</span>
        {midiId && midiParam && <MidiLearnButton id={midiId} param={`sampler:${midiParam}`} label={`Sampler ${label}`} />}
      </div>
      {children}
    </div>
  );
}

/** Waveform with draggable trim handles and chop markers. */
function Waveform({ track, onSlice, drawSlice = false }: { track: Track; onSlice: (i: number) => void; drawSlice?: boolean }) {
  const { updateSampler } = useStudio();
  const s = track.sampler;
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | number | null>(null);
  const peaks = useWaveformDetail(s?.url ?? "", s?.peaks ?? []);
  if (!s) return null;
  const chops = s.slices ?? [];

  const fracAt = (clientX: number, clientY: number) => {
    const boxEl = ref.current;
    if (!boxEl) return 0;
    return waveformFraction(boxEl, clientX, clientY);
  };

  const move = (e: ReactPointerEvent) => {
    if (drag === null) return;
    const f = fracAt(e.clientX, e.clientY);
    if (drag === "start") updateSampler(track.id, { start: Math.min(f, s.end - 0.002) });
    else if (drag === "end") updateSampler(track.id, { end: Math.max(f, s.start + 0.002) });
    else {
      const next = chops.slice();
      next[drag] = Math.min(Math.max(f, s.start), s.end);
      updateSampler(track.id, { slices: next.slice().sort((a, b) => a - b) });
    }
  };

  return (
    <WaveformZoom duration={s.duration} label="Sample">
    <div
      ref={ref}
      className={`relative h-32 min-h-32 w-full overflow-hidden rounded border border-border bg-surface-2 sm:h-20 sm:min-h-20 ${drawSlice ? "touch-none" : "touch-pan-y"}`}
      aria-label="Sample chop waveform"
      onPointerDown={(e) => {
        if (!drawSlice || (e.target as HTMLElement).closest('[role="slider"]')) return;
        const at = Math.min(s.end - 0.002, Math.max(s.start, fracAt(e.clientX, e.clientY)));
        if (chops.some((c) => Math.abs(c - at) < 0.002)) return;
        updateSampler(track.id, { slices: Array.from(new Set([s.start, ...chops, at])).sort((a, b) => a - b) });
      }}
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="pointer-events-none absolute inset-0">
        <WaveformView peaks={peaks} color="var(--display-wave)" label={`${s.name} waveform`} />
      </div>

      <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${s.start * 100}%` }} />
      <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${(1 - s.end) * 100}%` }} />

      {chops.map((c, i) => (
        <div
          key={`chop-${i}`}
          role="slider"
          tabIndex={0}
          aria-label={`Chop ${i + 1}`}
          aria-valuenow={Math.round(c * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(i);
          }}
          onKeyDown={(e) => {
            const delta = e.key === "ArrowLeft" ? -0.001 : e.key === "ArrowRight" ? 0.001 : 0;
            if (!delta) return;
            e.preventDefault();
            updateSampler(track.id, { slices: chops.map((value, index) => index === i ? Math.min(s.end - 0.002, Math.max(s.start, value + delta)) : value).sort((a, b) => a - b) });
          }}
          onDoubleClick={() => onSlice(i)}
          className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${c * 100}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-destructive" />
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-destructive px-1 font-mono text-[9px] text-destructive-foreground">
            {i + 1}
          </span>
        </div>
      ))}

      {(["start", "end"] as const).map((h) => (
        <div
          key={h}
          role="slider"
          tabIndex={0}
          aria-label={h === "start" ? "Trim start" : "Trim end"}
          aria-valuenow={Math.round((h === "start" ? s.start : s.end) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(h);
          }}
          onKeyDown={(e) => {
            const d = e.key === "ArrowLeft" ? -0.01 : e.key === "ArrowRight" ? 0.01 : 0;
            if (!d) return;
            e.preventDefault();
            if (h === "start") updateSampler(track.id, { start: Math.min(Math.max(0, s.start + d), s.end - 0.002) });
            else updateSampler(track.id, { end: Math.max(Math.min(1, s.end + d), s.start + 0.002) });
          }}
          className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${(h === "start" ? s.start : s.end) * 100}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
          <span className="absolute top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-sm bg-primary" />
        </div>
      ))}
    </div>
    </WaveformZoom>
  );
}

export function Sampler() {
  const skin = useSkin("sample");
  const drop = useImageDrop("sample");
  const { tracks, selected, select, addTrack, addClip, loadSample, updateSampler, clearSample, stopSamples, previewNote, setPanel } =
    useStudio();
  const [over, setOver] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(true);
  /** chop pad currently held down */
  const [held, setHeld] = useState<number | null>(null);
  const [chopBank, setChopBank] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const armReplaceRef = useRef(0);

  const samplerTracks = tracks.filter((t) => t.kind === "sampler");
  const track =
    selected?.kind === "sampler" ? selected : samplerTracks.find((t) => t.sampler) ?? samplerTracks[0] ?? null;

  const resample = async (t: Track) => {
    if (!t.sampler) return;
    try {
      const engine = getEngine();
      const cap = await engine.renderSample(t.sampler);
      if (!cap) throw new Error("no sample");
      const name = `${t.name} RESAMPLE`.slice(0, 28);
      const loaded = await engine.loadSampleFile(encodeWav(cap), name);
      const trackId = addTrack("audio", name);
      addClip(trackId, {
        id: uid(),
        name,
        peaks: loaded.peaks,
        duration: loaded.duration,
        url: loaded.url,
        start: 0,
        offset: 0,
        length: loaded.duration,
        gain: 1,
      });
      toast.success("Resampled", { description: "A new audio track holds the processed sound. The original is unchanged." });
    } catch {
      toast.error("SYNCLAB couldn't complete this operation.", { description: "Load a sample first, then try again." });
    }
  };

  /** Tempo / pitch / mode for the stretch tool; nothing changes until Apply. */
  const [wTempo, setWTempo] = useState<number | null>(null);
  const [wPitch, setWPitch] = useState(0);
  const [wMode, setWMode] = useState<"keep" | "repitch">("keep");
  const [wBusy, setWBusy] = useState(false);
  const [wPlaying, setWPlaying] = useState(false);
  const previewRef = useRef<{ blob: Blob; key: string } | null>(null);
  const warpSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Leaving the sampler (switching tools) must silence the looping preview.
  useEffect(
    () => () => {
      try { warpSourceRef.current?.stop(); } catch { /* already stopped */ }
      warpSourceRef.current?.disconnect();
      warpSourceRef.current = null;
      previewRef.current = null;
    },
    [],
  );

  /**
   * Loads the sample's audio as soon as the sampler opens, so pads, keys and Preview are ready.
   * Saved cloud samples use 12-hour links; an expired link is renewed instead of playing silently.
   */
  const [sampleIssue, setSampleIssue] = useState<string | null>(null);
  const sampleUrl = track?.sampler?.url ?? "";
  const sampleCloudPath = track?.sampler?.cloudPath;
  const sampleTrackId = track?.id;
  const updateSamplerRef = useRef(updateSampler);
  updateSamplerRef.current = updateSampler;
  useEffect(() => {
    setSampleIssue(null);
    if (!sampleTrackId || (!sampleUrl && !sampleCloudPath)) return;
    let cancelled = false;
    void (async () => {
      const engine = getEngine();
      if (sampleUrl && await engine.ensureBuffer(sampleUrl)) return;
      if (sampleCloudPath) {
        try {
          const { freshCloudUrl } = await import("@/lib/synclab/cloud");
          const fresh = await freshCloudUrl(sampleCloudPath);
          if (fresh && fresh !== sampleUrl && await engine.ensureBuffer(fresh)) {
            if (!cancelled) updateSamplerRef.current(sampleTrackId, { url: fresh });
            return;
          }
        } catch { /* reported below */ }
      }
      if (!cancelled) setSampleIssue("This sample's audio couldn't be loaded, so it will be silent. This browser may not read its file type — re-import it as WAV or MP3.");
    })();
    return () => { cancelled = true; };
  }, [sampleTrackId, sampleUrl, sampleCloudPath]);


  const stopPreview = () => {
    try { warpSourceRef.current?.stop(); } catch { /* already stopped */ }
    warpSourceRef.current?.disconnect();
    warpSourceRef.current = null;
    setWPlaying(false);
  };

  const renderWarp = async (t: Track): Promise<Blob | null> => {
    const sm = t.sampler;
    if (!sm) return null;
    const engine = getEngine();
    const from = sm.sampleBpm ?? 120;
    const target = wTempo ?? engine.tempo;
    const ratio = target / from;
    const base = { ...sm, syncToBpm: false, filterType: "off" as const, fadeIn: 0, fadeOut: 0, gain: 1 };
    if (wMode === "repitch") {
      const cap = await engine.renderSample({ ...base, pitch: wPitch + 12 * Math.log2(ratio) });
      return cap ? encodeWav(cap) : null;
    }
    const r = Math.pow(2, wPitch / 12);
    const cap = await engine.renderSample({ ...base, pitch: wPitch });
    if (!cap) return null;
    const speed = ratio / r;
    if (Math.abs(speed - 1) < 0.001) return encodeWav(cap);
    return encodeWav({ left: wsolaStretch(cap.left, speed), right: wsolaStretch(cap.right, speed), sampleRate: cap.sampleRate });
  };

  const warpKey = (t: Track) => JSON.stringify([t.sampler?.url, t.sampler?.start, t.sampler?.end, t.sampler?.reverse, t.sampler?.sampleBpm, wTempo ?? getEngine().tempo, wPitch, wMode]);

  const getWarp = async (t: Track) => {
    const key = warpKey(t);
    if (previewRef.current?.key === key) return previewRef.current;
    const blob = await renderWarp(t);
    if (!blob) return null;
    previewRef.current = { blob, key };
    return previewRef.current;
  };

  const previewWarp = async (t: Track) => {
    if (wPlaying) return stopPreview();
    // Unlock audio in the click itself, before asynchronous rendering.
    const engine = getEngine();
    const ctx = engine.init();
    setWBusy(true);
    try {
      const pv = await getWarp(t);
      if (!pv) throw new Error("none");
      const buffer = await ctx.decodeAudioData(await pv.blob.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(engine.master ?? ctx.destination);
      warpSourceRef.current = source;
      source.start();
      setWPlaying(true);
    } catch {
      toast.error("SYNCLAB couldn't complete this operation.", { description: "Load a sample first, then try again." });
    } finally {
      setWBusy(false);
    }
  };

  const applyWarp = async (t: Track) => {
    setWBusy(true);
    try {
      const pv = await getWarp(t);
      if (!pv) throw new Error("none");
      stopPreview();
      const target = Math.round(wTempo ?? getEngine().tempo);
      await loadSample(t.id, new File([pv.blob], `${t.name}-${target}bpm.wav`, { type: "audio/wav" }));
      updateSampler(t.id, { sampleBpm: target, syncToBpm: false, start: 0, end: 1, reverse: false, slices: undefined });
      setWPitch(0);
      toast.success(`Applied: ${target} BPM`, { description: "The sampler now plays the new version. Your original file is unchanged." });
    } catch {
      toast.error("SYNCLAB couldn't complete this operation.", { description: "Load a sample first, then try again." });
    } finally {
      setWBusy(false);
    }
  };

  const take = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio") && !AUDIO_RE.test(file.name)) {
      toast.error("That is not an audio file", { description: "Drop an MP3, WAV, AIFF, M4A, OGG or FLAC file." });
      return;
    }
    let id = track?.id;
    if (!id) {
      id = addTrack("sampler", file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 16));
      select(id);
    }
    await loadSample(id, file);
  };

  const s = track?.sampler;
  const chops = s?.slices ?? [];
  const [pickChop, setPickChop] = useState(0);
  const [padTarget, setPadTarget] = useState(0);
  const chopFileRef = useRef<HTMLInputElement>(null);
  const [drawSlice, setDrawSlice] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [chopBusy, setChopBusy] = useState(false);
  const autoChop = async () => {
    if (!track || !s) return;
    setChopBusy(true);
    try {
      const buffer = await getEngine().init().decodeAudioData(await (await fetch(s.url)).arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      const slices = detectSampleChops(channels, buffer.sampleRate, s.start, s.end, sensitivity);
      updateSampler(track.id, { slices });
      toast.success(slices.length > 1 ? `${slices.length} transient chops` : "No additional attacks found");
    } catch (error) { toast.error("Could not auto-chop", { description: error instanceof Error ? error.message : undefined }); }
    finally { setChopBusy(false); }
  };
  const releaseChop = (index: number) => {
    setHeld(null);
    if (track && s) getEngine().stopVoiceKey(track.id, s.chopChoke ? `chop-choke-${s.chopChoke}` : `chop-${index}`);
  };
  const chopPads = useMidiPads(`sampler:${track?.id ?? "none"}`, Math.min(64, chops.length), (i, velocity) => {
    if (!track || !s) return;
    setHeld(i);
    previewNote(track.id, s.rootNote + i, s.duration); void velocity;
  }, releaseChop);

  /** Cuts the trimmed region into n equal chops. */
  const chopInto = (n: number) => {
    if (!track || !s) return;
    const span = s.end - s.start;
    const next = Array.from({ length: n }, (_, i) => s.start + (span * i) / n);
    updateSampler(track.id, { slices: next });
    toast.success(`Chopped into ${n}`, { description: "Each chop plays from the root note upwards." });
  };

  /** Cuts the trimmed region on a musical grid (1/div note) using the sample's BPM. */
  const chopByNote = (div: number) => {
    if (!track || !s || !s.duration) return;
    const bpm = s.sampleBpm ?? getEngine().tempo ?? 120;
    const step = ((60 / bpm) * (4 / div)) / s.duration;
    const next: number[] = [];
    for (let at = s.start; at < s.end - step * 0.25 && next.length < 64; at += step) next.push(at);
    updateSampler(track.id, { slices: next });
    toast.success(`Chopped in 1/${div} notes`, { description: `${next.length} chops at ${bpm} BPM${next.length >= 64 ? " (max 64)" : ""}. Set Sample BPM to match the audio.` });
  };



  /** Cuts each chop out of the real sample as its own WAV (respects reverse off; uses the source file audio). */
  const renderChops = async () => {
    if (!track || !s || chops.length === 0) return [];
    const ctx = getEngine().init();
    const buf = await ctx.decodeAudioData(await (await fetch(s.url)).arrayBuffer());
    const sr = buf.sampleRate;
    return chops.map((c, i) => {
      const end = chops[i + 1] ?? s.end;
      const a = Math.floor(c * buf.length), b = Math.max(a + 1, Math.floor(end * buf.length));
      const left = buf.getChannelData(0).slice(a, b);
      const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice(a, b);
      const cap = { left, right, sampleRate: sr };
      const blob = encodeWav(cap);
      const buckets = 160, size = Math.max(1, Math.floor(left.length / buckets));
      const peaks: number[] = [];
      for (let k = 0; k < buckets; k++) { let p = 0; for (let j = k * size; j < Math.min(left.length, (k + 1) * size); j++) p = Math.max(p, Math.abs(left[j] ?? 0)); peaks.push(p); }
      return { name: `${s.name} ${i + 1}`.slice(0, 18), blob, cap, peaks, duration: left.length / sr };
    });
  };

  const saveChops = async (only?: number) => {
    try {
      const all = await renderChops();
      const out = only === undefined ? all : all.slice(only, only + 1);
      const files = out.map((c) => new File([encodeMp3(c.cap, 192)], `${c.name.replace(/[^\w-]+/g, "_")}.mp3`, { type: "audio/mpeg" }));
      // Phones: use the system share sheet so chops can be saved to Files / Drive / etc.
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
      if (nav.canShare?.({ files }) && nav.share) {
        try {
          await nav.share({ files, title: `${s?.name ?? "Sample"} chops` });
          toast.success(`Shared ${out.length === 1 ? "the chop" : `${out.length} chops`} as MP3 — choose Save to Files on your phone`);
          return;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return; // user cancelled the share sheet
        }
      }
      files.forEach((f, i) => setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
      }, i * 250));
      toast.success(out.length === 1 ? `Saved ${files[0]?.name}` : `Saved ${out.length} chops as MP3 files`);
    } catch (e) {
      toast.error("Could not save the chops", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const makePad = (name: string, url: string, duration: number, peaks: number[]): SavedPad => ({
    name, url, duration, peaks,
    start: 0, end: 1, gain: 1, pitch: 0, reverse: false, loop: false, oneShot: s?.oneShot ?? true,
    attack: 0.002, release: 0.08, choke: s?.chopChoke ?? 0, steps: Array.from({ length: 16 }, () => 0),
  });

  const sendChopsToPads = async (only?: number) => {
    try {
      const all = await renderChops();
      const out = only === undefined ? all.slice(0, 16) : all.slice(only, only + 1);
      const bank = getPadBank();
      const firstPad = padTarget;
      if (only === undefined && firstPad + out.length > 16) {
        toast.error("Choose an earlier starting pad so every chop fits");
        return;
      }
      const targets = out.map((_, i) => only === undefined ? firstPad + i : padTarget);
      // window.confirm is unsupported in the desktop app, so replacing armed pads is a two-tap action.
      if (targets.some((target) => bank[target]?.url) && Date.now() - armReplaceRef.current > 4000) {
        armReplaceRef.current = Date.now();
        toast.info("Those pads already have sounds — tap again to replace them");
        return;
      }
      armReplaceRef.current = 0;
      const engine = getEngine();
      for (let i = 0; i < out.length; i++) {
        const c = out[i];
        if (!c) continue;
        // Decode into the engine now so the pad sounds on the very first hit.
        const loaded = await engine.loadSampleFile(c.blob, c.name);
        bank[only === undefined ? firstPad + i : padTarget] = makePad(c.name, loaded.url, c.duration, c.peaks);
      }
      setPadBank(bank);
      toast.success(only === undefined ? `${out.length} chops sent to sample pads ${firstPad + 1}–${firstPad + out.length}` : `Chop ${only + 1} sent to pad ${padTarget + 1}`, {
        description: "Those pads' old sounds were replaced.",
        action: { label: "Open pads", onClick: () => setPanel("pads") },
      });
    } catch (e) {
      toast.error("Could not send the chops", { description: e instanceof Error ? e.message : undefined });
    }
  };

  /** Loads one chop (or any audio file) from the phone or computer onto the chosen pad. */
  const loadChopFile = async (file: File) => {
    try {
      const loaded = await getEngine().loadSampleFile(file, file.name);
      const bank = getPadBank();
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 18);
      const peaks = loaded.peaks.filter((_, i) => i % 3 === 0);
      bank[padTarget] = makePad(name, loaded.url, loaded.duration, peaks);
      setPadBank(bank);
      toast.success(`${name} loaded on pad ${padTarget + 1}`, { action: { label: "Open pads", onClick: () => setPanel("pads") } });
    } catch (e) {
      toast.error("Could not load that file", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const removeChop = (i: number) => {
    if (!track) return;
    updateSampler(track.id, { slices: chops.filter((_, x) => x !== i) });
  };

  return (
    <div className="studio-wallpaper space-y-3 rounded-md p-3" data-studio-panel="sample" style={skinBackground(skin)} {...drop}>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">Sampler colors & wallpaper</summary>
        <SkinControls skinKey="sample" image />
      </details>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 ${s ? "py-2" : "py-5"} text-center transition-colors ${
          over ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="size-4 text-primary" />
        <span className="font-mono text-[11px] tracking-wider">
          Drop an MP3 or WAV here — or click to choose a file
        </span>
        <input
          ref={fileRef}
          type="file"
          aria-label="Load sampler audio"
          accept="audio/*,.mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac"
          className="hidden"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {samplerTracks.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {samplerTracks.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={t.id === track?.id ? "secondary" : "ghost"}
              className="h-9 font-mono text-[10px] tracking-widest sm:h-7"
              onClick={() => select(t.id)}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}

      {!track || !s ? (
        <p className="text-sm text-muted-foreground">
          No sample loaded yet. Drop a file above and it lands on a sampler channel you can play from the keyboard,
          piano roll or your MIDI controller.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AudioLines className="size-4 text-primary" />
            <span className="font-mono text-[11px]">{s.name}</span>
            <span className="label-xs">
              {s.duration.toFixed(2)}s · trimmed {(s.duration * (s.end - s.start)).toFixed(2)}s
            </span>
            <div className="ml-auto flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-9 touch-none gap-1.5 sm:h-7"
                onClick={() => {
                  const engine = getEngine();
                  engine.init();
                  if (sampleIssue) {
                    toast.error("This sample can't play", { description: sampleIssue });
                    return;
                  }
                  if (track.muted || (tracks.some((t) => t.solo) && !track.solo)) {
                    toast.warning("This channel is silenced", { description: track.muted ? "Unmute (M) this sampler channel to hear it." : "Another channel is soloed (S). Solo this channel or clear the other solo to hear it." });
                  }
                  engine.syncMixIfChanged(tracks);
                  stopSamples(track.id);
                  engine.playSample(track.id, { ...s, loop: false, oneShot: true }, s.rootNote);
                }}
              >
                <Play className="size-3.5" /> Preview sample
              </Button>
              <Button size="sm" variant="ghost" className="h-9 gap-1.5 sm:h-7" onClick={() => stopSamples(track.id)}>
                <Square className="size-3.5" /> Stop
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 sm:h-7"
                onClick={() => updateSampler(track.id, { start: 0, end: 1 })}
              >
                <RotateCcw className="size-3.5" /> Full length
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 sm:h-7"
                title="Render the processed sound to a new audio track. The original sample is not changed."
                onClick={() => void resample(track)}
              >
                <AudioLines className="size-3.5" /> Resample
              </Button>
              <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-destructive sm:h-7" onClick={() => clearSample(track.id)}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>
          </div>

          <div className="sticky top-0 z-30 space-y-1 border-b border-border bg-background pb-2" aria-label="Sample waveform editor">
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="truncate font-mono text-xs text-primary">{s.name}</span>
              <Button size="sm" variant={drawSlice ? "default" : "outline"} aria-pressed={drawSlice} onClick={() => setDrawSlice(!drawSlice)} className="h-9 shrink-0"><Scissors className="size-4" /> Manual slice</Button>
            </div>
            <Waveform key={`${track.id}:${s.url}`} track={track} onSlice={removeChop} drawSlice={drawSlice} />
          </div>

            <div className="space-y-3 border-y border-border py-3">
              <p className="label-xs">TIME STRETCH & PITCH</p>
              <div className="flex flex-wrap gap-1">
                {(["keep", "repitch"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={wMode === m ? "secondary" : "outline"}
                    aria-pressed={wMode === m}
                    onClick={() => { stopPreview(); setWMode(m); }}
                    className={`rounded border px-2 py-1 text-[10px] uppercase ${wMode === m ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {m === "keep" ? "Keep pitch" : "Repitch"}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Row label="Sample BPM" value={`${s.sampleBpm ?? 120} BPM`}>
                <Slider aria-label="Time stretch sample BPM" value={[s.sampleBpm ?? 120]} min={60} max={200} step={1} onValueChange={([v]) => { stopPreview(); updateSampler(track.id, { sampleBpm: v ?? 120 }); }} />
              </Row>
              <Row label="Target tempo" value={`${Math.round(wTempo ?? getEngine().tempo)} BPM`}>
                <Slider aria-label="Time stretch target tempo" value={[wTempo ?? getEngine().tempo]} min={60} max={200} step={1} onValueChange={([v]) => { stopPreview(); setWTempo(v ?? 120); }} />
              </Row>
              <Row label="Pitch" value={`${wPitch > 0 ? "+" : ""}${wPitch} st`}>
                <Slider value={[wPitch]} min={-12} max={12} step={1} onValueChange={([v]) => { stopPreview(); setWPitch(v ?? 0); }} />
              </Row>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="h-8 flex-1 gap-1.5" disabled={wBusy} onClick={() => void previewWarp(track)}>
                  {wPlaying ? <Square className="size-3.5" /> : <Play className="size-3.5" />} {wPlaying ? "Stop" : wBusy ? "Rendering…" : "Preview"}
                </Button>
                <Button size="sm" className="h-8 flex-1" disabled={wBusy} onClick={() => void applyWarp(track)}>
                  Apply stretch
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Stretches from Sample BPM to the target. Keep pitch changes speed only; Repitch changes speed and pitch together.
                Preview loops the result; nothing changes until Apply.
              </p>
            </div>


          <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Scissors className="size-4 text-primary" />
              <span className="label-xs">Chop sample</span>
              <Button size="sm" variant="secondary" disabled={chopBusy} onClick={() => void autoChop()} className="h-12 sm:h-8">{chopBusy ? "Analyzing…" : "Auto-chop attacks"}</Button>
              {[4, 8, 12, 16].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="secondary"
                  className="h-9 font-mono text-[10px] tracking-widest sm:h-7"
                  onClick={() => chopInto(n)}
                >
                  {n}
                </Button>
              ))}
              <span className="label-xs">Note grid</span>
              {[1, 2, 4, 8, 16, 32].map((d) => (
                <Button key={`n${d}`} size="sm" variant="outline" className="h-9 font-mono text-[10px] tracking-widest sm:h-7" aria-label={`Chop in 1/${d} notes`} onClick={() => chopByNote(d)}>
                  1/{d}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 font-mono text-[10px] tracking-widest sm:h-7"
                onClick={() =>
                  updateSampler(track.id, { slices: [...chops, (s.start + s.end) / 2].sort((a, b) => a - b) })
                }
              >
                + Add chop
              </Button>
              {chops.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 font-mono text-[10px] tracking-widest sm:h-7 text-destructive"
                  onClick={() => updateSampler(track.id, { slices: [] })}
                >
                  Clear chops
                </Button>
              )}
              {chops.length > 0 && (
                <>
                  <Button size="sm" variant="outline" className="h-9 font-mono text-[10px] tracking-widest sm:h-7" onClick={() => saveChops()}>
                    Save all chops (MP3)
                  </Button>
                  <Button size="sm" className="h-9 font-mono text-[10px] tracking-widest sm:h-7" onClick={() => sendChopsToPads()}>
                    Send all to sample pads
                  </Button>
                </>
              )}
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <Row label="Attack sensitivity" value={`${Math.round(sensitivity * 100)}%`}>
                <Slider aria-label="Attack sensitivity" value={[sensitivity]} min={0} max={1} step={0.01} onValueChange={([value = 0.5]) => setSensitivity(value)} />
              </Row>
              <div className="min-w-0 space-y-1">
                <span className="label-xs">Chop playback</span>
                <div className="flex gap-1">
                  {[true, false].map((oneShot) => <Button key={String(oneShot)} variant={s.oneShot === oneShot ? "default" : "outline"} aria-pressed={s.oneShot === oneShot} className="h-12 flex-1 sm:h-8" onClick={() => { stopSamples(track.id); updateSampler(track.id, { oneShot }); }}>{oneShot ? "One-shot" : "Gate"}</Button>)}
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <span className="label-xs">Chop choke group</span>
                <Select value={String(s.chopChoke ?? 0)} onValueChange={(value) => { stopSamples(track.id); updateSampler(track.id, { chopChoke: Number(value) }); }}>
                  <SelectTrigger aria-label="Chop choke group" className="h-12 w-full sm:h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 4].map((group) => <SelectItem key={group} value={String(group)}>{group ? `Group ${group}` : "Off · overlap"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/60 p-2 font-mono text-[10px] tracking-widest">
              <span className="text-muted-foreground">ONE CHOP</span>
              {chops.length > 0 && (
                <>
                  <select aria-label="Chop" value={Math.min(pickChop, chops.length - 1)} onChange={(e) => setPickChop(Number(e.target.value))} className="h-9 rounded border border-border bg-background px-2 sm:h-7">
                    {chops.map((_, i) => <option key={i} value={i}>Chop {i + 1}</option>)}
                  </select>
                  <Button size="sm" variant="outline" className="h-9 text-[10px] sm:h-7" onClick={() => saveChops(Math.min(pickChop, chops.length - 1))}>Save this chop (MP3)</Button>
                </>
              )}
              <span className="text-muted-foreground">PAD</span>
              <select aria-label="Target pad" value={padTarget} onChange={(e) => setPadTarget(Number(e.target.value))} className="h-9 rounded border border-border bg-background px-2 sm:h-7">
                {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>Pad {i + 1}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-9 text-[10px] sm:h-7" onClick={() => chopFileRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" /> Load a chop onto pad
              </Button>
              <input ref={chopFileRef} type="file" accept="audio/*,.mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadChopFile(f); e.target.value = ""; }} />
            </div>

            {chops.length > 0 ? (
              <>
                <MidiPadLearnBar pads={chopPads} label="chops" names={(i) => `chop ${i + 1}`} />
                <div className="flex items-center gap-2" role="group" aria-label="Chop banks">
                  <span className="label-xs">BANK</span>
                  {["A", "B", "C", "D"].map((label, bank) => <Button key={label} variant={Math.min(chopBank, Math.floor((chops.length - 1) / 16)) === bank ? "default" : "outline"} className="size-12 p-0" aria-label={`Chop bank ${label}`} aria-pressed={Math.min(chopBank, Math.floor((chops.length - 1) / 16)) === bank} disabled={bank * 16 >= chops.length} onClick={() => setChopBank(bank)}>{label}</Button>)}
                </div>
                <div className="sampler-chop-grid grid grid-cols-5 gap-2">
                  {chops.slice(Math.min(chopBank, Math.floor((chops.length - 1) / 16)) * 16, (Math.min(chopBank, Math.floor((chops.length - 1) / 16)) + 1) * 16).map((c, localIndex) => {
                    const i = Math.min(chopBank, Math.floor((chops.length - 1) / 16)) * 16 + localIndex;
                    const color = chopColor(i);
                    const next = chops[i + 1] ?? s.end;
                    const slice = s.peaks.slice(
                      Math.floor(c * s.peaks.length),
                      Math.max(Math.floor(c * s.peaks.length) + 2, Math.floor(next * s.peaks.length)),
                    );
                    const live = held === i;
                    return (
                      <Button
                        key={`pad-${i}`}
                        type="button"
                        variant="outline"
                        aria-label={`Play chop ${i + 1}`}
                        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); setHeld(i); previewNote(track.id, s.rootNote + i, s.duration); } }}
                        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") releaseChop(i); }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {
                            /* pointer capture is unavailable in a few mobile webviews */
                          }
                          setHeld(i);
                          previewNote(track.id, s.rootNote + i, s.duration);
                        }}
                        onPointerUp={() => releaseChop(i)}
                        onPointerCancel={() => releaseChop(i)}
                        onLostPointerCapture={() => releaseChop(i)}
                        style={{
                          borderColor: color,
                          background: live
                            ? `linear-gradient(145deg, ${color}, color-mix(in hsl, ${color} 50%, transparent))`
                            : `linear-gradient(145deg, color-mix(in hsl, ${color} 28%, transparent), color-mix(in hsl, ${color} 8%, transparent))`,
                          boxShadow: live ? `0 0 18px ${color}` : undefined,
                        }}
                        className="relative flex h-24 min-w-0 touch-none flex-col items-center justify-between rounded-md border-2 p-2 font-mono text-xs transition-all select-none active:scale-[0.97]"
                      >
                        <span className="relative z-10 text-sm text-foreground">{i + 1}</span>
                        <span className="pointer-events-none absolute inset-x-1 top-5 bottom-4">
                          <WaveformView peaks={slice} color="var(--display-wave)" grid={false} label={`Chop ${i + 1} waveform`} />
                        </span>
                        <span className="relative z-10 text-[9px] text-foreground/80">{(c * s.duration).toFixed(2)}s</span>
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {chops.length} chops · {s.oneShot ? "One-shot" : "Gate"} · {s.chopChoke ? `Choke ${s.chopChoke}` : "Overlap"} · {noteName(s.rootNote)}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick 4, 8, 12 or 16 to slice the trimmed part into even chops, or add your own markers and drag them
                where you want the cuts.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Trim start" midiId={track.id} midiParam="start" value={`${(s.start * s.duration).toFixed(2)}s`}>
              <Slider
                value={[s.start]}
                min={0}
                max={1}
                step={0.001}
                onValueChange={([v]) => updateSampler(track.id, { start: Math.min(v ?? 0, s.end - 0.002) })}
              />
            </Row>
            <Row label="Trim end" midiId={track.id} midiParam="end" value={`${(s.end * s.duration).toFixed(2)}s`}>
              <Slider
                value={[s.end]}
                min={0}
                max={1}
                step={0.001}
                onValueChange={([v]) => updateSampler(track.id, { end: Math.max(v ?? 1, s.start + 0.002) })}
              />
            </Row>
            <Row label="Level" midiId={track.id} midiParam="gain" value={`${Math.round(s.gain * 100)}%`}>
              <Slider value={[s.gain]} min={0} max={2} step={0.01} onValueChange={([v]) => updateSampler(track.id, { gain: v ?? 1 })} />
            </Row>
            <Row label="Tune" midiId={track.id} midiParam="pitch" value={`${s.pitch > 0 ? "+" : ""}${s.pitch.toFixed(1)} st`}>
              <Slider value={[s.pitch]} min={-24} max={24} step={0.1} onValueChange={([v]) => updateSampler(track.id, { pitch: v ?? 0 })} />
            </Row>
            <Row label="Root note" midiId={track.id} midiParam="rootNote" value={noteName(s.rootNote)}>
              <Slider
                value={[s.rootNote]}
                min={24}
                max={96}
                step={1}
                onValueChange={([v]) => updateSampler(track.id, { rootNote: v ?? 60 })}
              />
            </Row>
            <Row label="Attack" midiId={track.id} midiParam="attack" value={`${Math.round(s.attack * 1000)} ms`}>
              <Slider value={[s.attack]} min={0} max={2} step={0.001} onValueChange={([v]) => updateSampler(track.id, { attack: v ?? 0 })} />
            </Row>
            <Row label="Release" midiId={track.id} midiParam="release" value={`${Math.round(s.release * 1000)} ms`}>
              <Slider value={[s.release]} min={0.005} max={4} step={0.005} onValueChange={([v]) => updateSampler(track.id, { release: v ?? 0.06 })} />
            </Row>
            <Row label="Decay" midiId={track.id} midiParam="decay" value={`${Math.round((s.decay ?? 0) * 1000)} ms`}>
              <Slider value={[s.decay ?? 0]} min={0} max={3} step={0.005} onValueChange={([v]) => updateSampler(track.id, { decay: v ?? 0 })} />
            </Row>
            <Row label="Sustain" midiId={track.id} midiParam="sustain" value={`${Math.round((s.sustain ?? 1) * 100)}%`}>
              <Slider value={[s.sustain ?? 1]} min={0} max={1} step={0.01} onValueChange={([v]) => updateSampler(track.id, { sustain: v ?? 1 })} />
            </Row>
            <Row label="Fade in" midiId={track.id} midiParam="fadeIn" value={`${Math.round((s.fadeIn ?? 0) * 1000)} ms`}>
              <Slider value={[s.fadeIn ?? 0]} min={0} max={2} step={0.005} onValueChange={([v]) => updateSampler(track.id, { fadeIn: v ?? 0 })} />
            </Row>
            <Row label="Fade out" midiId={track.id} midiParam="fadeOut" value={`${Math.round((s.fadeOut ?? 0) * 1000)} ms`}>
              <Slider value={[s.fadeOut ?? 0]} min={0} max={2} step={0.005} onValueChange={([v]) => updateSampler(track.id, { fadeOut: v ?? 0 })} />
            </Row>
            <div className="space-y-1.5">
              <span className="label-xs">Filter</span>
              <div className="flex flex-wrap gap-1">
                {(["off", "lowpass", "highpass", "bandpass", "notch"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={(s.filterType ?? "off") === f}
                    onClick={() => updateSampler(track.id, { filterType: f })}
                    className={`rounded border px-2 py-1 text-[10px] uppercase ${(s.filterType ?? "off") === f ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {f === "off" ? "Off" : f === "lowpass" ? "LP" : f === "highpass" ? "HP" : f === "bandpass" ? "BP" : "Notch"}
                  </button>
                ))}
              </div>
            </div>
            <Row label="Cutoff" midiId={track.id} midiParam="cutoff" value={`${Math.round(s.cutoff ?? 18000)} Hz`}>
              <Slider value={[Math.log10(s.cutoff ?? 18000)]} min={Math.log10(20)} max={Math.log10(20000)} step={0.01} disabled={(s.filterType ?? "off") === "off"} onValueChange={([v]) => updateSampler(track.id, { cutoff: Math.round(Math.pow(10, v ?? 4.25)) })} />
            </Row>
            <Row label="Resonance" midiId={track.id} midiParam="resonance" value={(s.resonance ?? 0.7).toFixed(1)}>
              <Slider value={[s.resonance ?? 0.7]} min={0.1} max={20} step={0.1} disabled={(s.filterType ?? "off") === "off"} onValueChange={([v]) => updateSampler(track.id, { resonance: v ?? 0.7 })} />
            </Row>
            <Row label="Sample BPM" value={s.sampleBpm ? `${s.sampleBpm}` : "—"}>
              <Slider value={[s.sampleBpm ?? 120]} min={60} max={200} step={1} onValueChange={([v]) => updateSampler(track.id, { sampleBpm: v ?? 120 })} />
            </Row>
            <div className="flex items-center justify-between">
              <span className="label-xs" title="Repitch mode: speed and pitch change together. Pitch-preserving warp (Beats/Tones/Complex) needs the desktop engine.">Sync to project BPM (repitch)</span>
              <Switch checked={!!s.syncToBpm} onCheckedChange={(v) => updateSampler(track.id, { syncToBpm: v, sampleBpm: s.sampleBpm ?? 120 })} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Loop</span>
                <Switch checked={s.loop} onCheckedChange={(v) => updateSampler(track.id, { loop: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">Reverse</span>
                <Switch checked={s.reverse} onCheckedChange={(v) => updateSampler(track.id, { reverse: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">One shot</span>
                <Switch checked={s.oneShot} onCheckedChange={(v) => updateSampler(track.id, { oneShot: v })} />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Play the trimmed sample from the on-screen keyboard, the piano roll or your MIDI controller — the root note
            plays it at its original speed and every other key pitches it up or down. Tempo sync uses Repitch (speed and pitch
            move together); use Time Stretch & Pitch to preview and apply a stretch that keeps pitch.
          </p>
        </>
      )}
      <Button variant={showKeyboard ? "secondary" : "outline"} aria-pressed={showKeyboard} onClick={() => setShowKeyboard((value) => !value)}><Piano className="size-4" />{showKeyboard ? "Hide keyboard" : "Show keyboard"}</Button>
      {showKeyboard && <section aria-label="Sampler keyboard" className="min-w-0 border-t border-border pt-3"><Keyboard {...(track ? { track } : {})} skinKey="sampler-keyboard" disabled={!s} onPlay={(midi) => { if (track && s) previewNote(track.id, midi, s.duration); }} /></section>}
    </div>
  );
}
