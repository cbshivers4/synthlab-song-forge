import { WaveformZoom, waveformFraction, useWaveformDetail } from "./WaveformZoom";
import { SampleExportButtons } from "./SampleExportButtons";
import { BypassButton } from "./HardwareBypass";
import { captureFromUrl } from "@/lib/synclab/sample-export";
import { getLocalFile } from "@/lib/synclab/local-files";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Circle,
  Copy,
  Grid2x2,
  Mic,
  Play,
  Piano,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openMic, openInOwnTab, preferredRecordingMime, releaseMic } from "@/lib/synclab/mic";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { toast } from "sonner";
import { SkinControls, skinBackground, useImageDrag, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { WaveformView } from "@/components/studio/WaveformView";
import { LiveWave } from "@/components/studio/LiveWave";
import { getPadBank, setPadBank, subscribePadBank, type SavedPad } from "@/lib/synclab/pad-session";
import { renderStarterSamples } from "@/lib/synclab/starter-samples";
import { MidiLearnButton } from "./MidiLearn";
import { Knob } from "./Knob";
import { MidiPadLearnBar, useMidiPads } from "./MidiPadLearn";
import { Keyboard } from "./Keyboard";
import { qwertyEnabled } from "@/lib/synclab/qwerty";
import { SavePadsDialog } from "./SavePadsDialog";
import { PadSampleTools } from "./PadSampleTools";
import { cropPadPeaks } from "@/lib/synclab/pad-chops";

const BANKS = ["A", "B", "C", "D"] as const;
/** Koala-style bank colors — each bank tints its loaded pads. */
const BANK_COLORS = ["hsl(187 85% 50%)", "hsl(38 95% 55%)", "hsl(330 80% 62%)", "hsl(95 70% 52%)"] as const;
const BANK_HUES = [187, 38, 330, 95] as const;
/** Every pad gets its own colour so a full bank reads at a glance. */
const padColor = (bank: number, i: number) => `hsl(${((BANK_HUES[bank] ?? 187) + i * 13) % 360} 85% 56%)`;
const PADS_PER_BANK = 16;
const STEPS = 16;
const KEYMAP = "1234qwerasdfzxcv".split("");
const AUDIO_RE = /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i;

interface Pad extends SavedPad {
  name: string;
  url: string;
  duration: number;
  peaks: number[];
  start: number;
  end: number;
  gain: number;
  pitch: number;
  reverse: boolean;
  loop: boolean;
  oneShot: boolean;
  attack: number;
  release: number;
  /** 0 = no choke group, 1..4 = pads in the same group cut each other off */
  choke: number;
  steps: number[];
}

const emptySteps = () => Array.from({ length: STEPS }, () => 0);

const makePad = (
  loaded: { url: string; name: string; peaks: number[]; duration: number },
  start = 0,
  end = 1,
): Pad => ({
  name: loaded.name.slice(0, 18),
  url: loaded.url,
  duration: loaded.duration,
  peaks: loaded.peaks,
  start,
  end,
  gain: 1,
  pitch: 0,
  reverse: false,
  loop: false,
  oneShot: true,
  attack: 0.002,
  release: 0.08,
  choke: 0,
  steps: emptySteps(),
});

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">{label}</span>
        <span className="font-mono text-[10px] text-primary">{value}</span>
      </div>
      {children}
    </div>
  );
}

/** Waveform of one pad with draggable trim handles. */
function PadWave({ pad, color, onChange, manual }: { pad: Pad; color: string; onChange: (p: Partial<Pad>) => void; manual: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | number | null>(null);
  const peaks = useWaveformDetail(pad.url, pad.peaks);

  const move = (e: ReactPointerEvent) => {
    if (drag === null) return;
    const boxEl = ref.current;
    if (!boxEl) return;
    const f = waveformFraction(boxEl, e.clientX, e.clientY);
    if (typeof drag === "number") {
      const slices = [...(pad.slices ?? [])];
      slices[drag] = Math.min((slices[drag + 1] ?? pad.end) - 0.002, Math.max((slices[drag - 1] ?? pad.start) + 0.002, f));
      onChange({ slices });
    } else if (drag === "start") onChange({ start: Math.min(f, pad.end - 0.002) });
    else onChange({ end: Math.max(f, pad.start + 0.002) });
  };

  return (
    <WaveformZoom duration={pad.duration} label="Pad sample">
    <div
      ref={ref}
      className="relative h-28 w-full touch-none overflow-hidden rounded-lg border border-border bg-surface-2/60"
      aria-label="Pad sample chop waveform"
      onPointerDown={(e) => {
        if (!manual || e.target !== e.currentTarget) return;
        const at = waveformFraction(e.currentTarget, e.clientX, e.clientY);
        if (at <= pad.start + 0.002 || at >= pad.end - 0.002) return;
        onChange({ slices: [...new Set([pad.start, ...(pad.slices ?? []), at])].sort((a, b) => a - b) });
      }}
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="pointer-events-none absolute inset-0">
        <WaveformView peaks={peaks} color="var(--display-wave)" label="Pad waveform" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/70" style={{ width: `${pad.start * 100}%` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 bg-background/70" style={{ width: `${(1 - pad.end) * 100}%` }} />
      {(pad.slices ?? []).map((at, i) => at > pad.start && at < pad.end && <div key={i} role="slider" tabIndex={0} aria-label={`Pad cut ${i + 1}`} aria-valuenow={Math.round(at * 100)} aria-valuemin={0} aria-valuemax={100} className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-col-resize" style={{ left: `${at * 100}%` }} onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(i); }} onDoubleClick={() => onChange({ slices: pad.slices?.filter((_, index) => index !== i) })} onKeyDown={e => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); onChange({ slices: pad.slices?.filter((_, index) => index !== i) }); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const slices = [...(pad.slices ?? [])]; slices[i] = Math.max((slices[i - 1] ?? pad.start) + 0.002, Math.min((slices[i + 1] ?? pad.end) - 0.002, at + (e.key === 'ArrowLeft' ? -0.005 : 0.005))); onChange({ slices }); }
      }}><span className="absolute inset-y-0 left-1/2 w-0.5 bg-destructive" /><span className="absolute bottom-1 left-1/2 size-2 -translate-x-1/2 bg-destructive" /></div>)}
      {(["start", "end"] as const).map((h) => (
        <div
          key={h}
          role="slider"
          tabIndex={0}
          aria-label={h === "start" ? "Trim start" : "Trim end"}
          aria-valuenow={Math.round((h === "start" ? pad.start : pad.end) * 100)}
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
            if (h === "start") onChange({ start: Math.min(Math.max(0, pad.start + d), pad.end - 0.002) });
            else onChange({ end: Math.max(Math.min(1, pad.end + d), pad.start + 0.002) });
          }}
          className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${(h === "start" ? pad.start : pad.end) * 100}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2" style={{ backgroundColor: color }} />
          <span className="absolute top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-sm" style={{ backgroundColor: color }} />
        </div>
      ))}
    </div>
    </WaveformZoom>
  );
}

export function PadSampler() {
  const { tracks, transport, addTrack, select, captureNote, updateTrack } = useStudio();
  const [pads, setPadsState] = useState<Record<number, Pad>>(() => getPadBank());
  const setPads: typeof setPadsState = useCallback((next) => {
    setPadsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      setPadBank(value);
      return value;
    });
  }, []);
  const [bank, setBank] = useState(0);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [sel, setSel] = useState(0);
  const [manualCuts, setManualCuts] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const [seqOn, setSeqOn] = useState(false);
  const [step, setStep] = useState(0);
  const [liveRec, setLiveRec] = useState(false);
  const [micOn, setMicOn] = useState(false);
  /** hold-to-record mode: press a pad to record, release to keep the take */
  const [armRec, setArmRec] = useState(false);
  const [recPad, setRecPad] = useState<number | null>(null);
  /** live microphone stream shown as a moving wave while a pad records */
  const [recStream, setRecStream] = useState<MediaStream | null>(null);
  /** pad currently held down and sounding */
  const [playing, setPlaying] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<number>(0);
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; pad: number } | null>(null);
  const holdRef = useRef<{ pad: number; active: boolean } | null>(null);
  const voiceTrackRef = useRef<string | null>(null);
  const padsRef = useRef(pads);
  padsRef.current = pads;
  /** Held pads sweep a playhead across their pad waveform: pad id → press time. */
  const holdsRef = useRef<Map<number, number>>(new Map());
  const [sweep, setSweep] = useState<Record<number, number>>({});
  const [sweeping, setSweeping] = useState(false);
  const startSweep = useCallback((id: number) => {
    holdsRef.current.set(id, performance.now());
    setSweeping(true);
  }, []);
  const endSweep = useCallback((id: number) => {
    if (!holdsRef.current.delete(id)) return;
    setSweep((s) => {
      if (!(id in s)) return s;
      const n = { ...s };
      delete n[id];
      return n;
    });
    if (!holdsRef.current.size) setSweeping(false);
  }, []);
  // 20 fps display timer — only while a pad is actually held, never on the audio path.
  useEffect(() => {
    if (!sweeping) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const next: Record<number, number> = {};
      for (const [id, t0] of holdsRef.current) {
        const pad = padsRef.current[id];
        if (!pad) continue;
        const span = Math.max(0.02, pad.duration * (pad.end - pad.start));
        const rate = Math.pow(2, (pad.pitch || 0) / 12);
        let p = (((now - t0) / 1000) * rate) / span;
        p = pad.loop ? p - Math.floor(p) : Math.min(1, p);
        next[id] = p;
      }
      setSweep(next);
    }, 50);
    return () => window.clearInterval(timer);
  }, [sweeping]);
  useEffect(() => subscribePadBank((next) => setPadsState(next)), []);
  const stepRef = useRef(0);
  const liveRef = useRef(liveRec);
  liveRef.current = liveRec;
  useEffect(() => () => {
    const current = recRef.current;
    if (!current) return;
    if (current.rec.state !== "inactive") current.rec.stop();
    releaseMic(current.stream);
    recRef.current = null;
  }, []);

  /** The mixer channel every pad plays through. */
  const ensureTrack = useCallback(() => {
    if (trackId && tracks.some((t) => t.id === trackId)) {
      voiceTrackRef.current = trackId;
      return trackId;
    }
    const existing = tracks.find((t) => t.kind === "sampler" && t.name === "PAD SAMPLER");
    if (existing) {
      setTrackId(existing.id);
      voiceTrackRef.current = existing.id;
      return existing.id;
    }
    const id = addTrack("sampler", "PAD SAMPLER", undefined, { keepPanel: true });
    setTrackId(id);
    voiceTrackRef.current = id;
    select(id);
    return id;
  }, [addTrack, select, trackId, tracks]);

  const index = (i: number) => bank * PADS_PER_BANK + i;
  const selPad = pads[sel];

  const trigger = useCallback(
    (i: number, velocity = 1, when?: number, midi = 60, region?: { start: number; end: number }) => {
      const pad = padsRef.current[i];
      if (!pad) return;
      const id = ensureTrack();
      const engine = getEngine();
      engine.playSample(
        id,
        {
          url: pad.url,
          start: region?.start ?? pad.start,
          end: region?.end ?? pad.end,
          gain: pad.gain,
          pitch: pad.pitch,
          rootNote: 60,
          loop: pad.loop,
          reverse: pad.reverse,
          oneShot: pad.oneShot,
          attack: pad.attack,
          release: pad.release,
        },
        midi,
        when,
        velocity,
        undefined,
        pad.choke ? `choke${pad.choke}` : `pad${i}`,
      );
      // While the transport records, drop the hit into the sampler track's take on the timeline.
      if (!region) captureNote(id, midi, velocity);
      const delay = Math.max(0, ((when ?? engine.init().currentTime) - engine.init().currentTime) * 1000);
      window.setTimeout(() => {
        setHit(i);
        window.setTimeout(() => setHit((h) => (h === i ? null : h)), 120);
      }, delay);
      if (!region && liveRef.current && delay < 10) {
        const s = stepRef.current;
        setPads((p) => {
          const target = p[i];
          if (!target) return p;
          const steps = target.steps.slice();
          steps[s] = 1;
          return { ...p, [i]: { ...target, steps } };
        });
      }
    },
    [captureNote, ensureTrack],
  );
  const padMidi = useMidiPads("pad-sampler", 16, (i, velocity) => trigger(index(i), velocity));

  /* pad step sequencer */
  useEffect(() => {
    if (!seqOn) return;
    const engine = getEngine();
    const ctx = engine.init();
    const stepDuration = 60 / Math.max(40, transport.bpm) / 4;
    let nextTime = ctx.currentTime + 0.05;
    let nextStep = (stepRef.current + 1) % STEPS;
    let cancelled = false;
    const pump = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      if (nextTime < now - 0.2) nextTime = now + 0.04;
      while (nextTime < now + 0.12) {
        const scheduledStep = nextStep;
        for (const [key, pad] of Object.entries(padsRef.current)) {
          const velocity = pad.steps[scheduledStep] ?? 0;
          if (velocity > 0) trigger(Number(key), velocity, nextTime);
        }
        const delay = Math.max(0, (nextTime - now) * 1000);
        window.setTimeout(() => {
          if (!cancelled) {
            stepRef.current = scheduledStep;
            setStep(scheduledStep);
          }
        }, delay);
        nextStep = (nextStep + 1) % STEPS;
        nextTime += stepDuration;
      }
    };
    pump();
    const timer = window.setInterval(pump, 25);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [seqOn, transport.bpm, trigger]);

  /* computer keyboard pads */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (showKeyboard && qwertyEnabled()) return;
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable)
        return;
      const k = KEYMAP.indexOf(e.key.toLowerCase());
      if (k < 0) return;
      // Claim the key so the typing-keys instrument doesn't also play (and record) it.
      e.preventDefault();
      // A held key auto-repeats; only the first press is a hit.
      if (e.repeat) return;
      trigger(index(k));
    };
    // capture phase: pads win over the global typing keys, so one press = one note
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  /** Stop just one pad's voice (and its choke group) without touching the others. */
  const stopPad = useCallback(
    (i: number) => {
      const pad = padsRef.current[i];
      const id = voiceTrackRef.current ?? trackId;
      if (!pad || !id) return;
      getEngine().stopVoiceKey(id, `pad${i}`);
      if (pad.choke) getEngine().stopVoiceKey(id, `choke${pad.choke}`);
    },
    [trackId],
  );

  const loadInto = async (i: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio") && !AUDIO_RE.test(file.name)) {
      toast.error("That is not an audio file", { description: "Drop an MP3, WAV, AIFF, M4A, OGG or FLAC file." });
      return;
    }
    ensureTrack();
    const loaded = await getEngine().loadSampleFile(file, file.name.replace(/\.[^.]+$/, ""));
    setPadBank({ ...getPadBank(), [i]: makePad(loaded) });
    setSel(i);
    toast.success(`${loaded.name ?? file.name} loaded on the pad`, { description: "Tap the pad to play it." });
  };

  const patch = (i: number, next: Partial<Pad>) =>
    setPads((p) => (p[i] ? { ...p, [i]: { ...(p[i] as Pad), ...next } } : p));

  const clearPad = (i: number) => {
    stopPad(i);
    setPads((p) => {
      const n = { ...p };
      delete n[i];
      return n;
    });
  };

  /* record straight into a pad from the microphone */
  const startMic = async (i: number) => {
    const res = await openMic(undefined, "pad-sampler");
    if ("error" in res) {
      toast.error("Microphone not available", {
        description: res.error,
        duration: 9000,
        ...(res.canOpenTab ? { action: { label: "Open in tab", onClick: openInOwnTab } } : {}),
      });
      return;
    }
    const stream = res.stream;
    const mimeType = preferredRecordingMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.start(200);
    recRef.current = { rec, stream, chunks, pad: i };
    setMicOn(true);
    setRecStream(stream);
  };

  const stopMic = async () => {
    const r = recRef.current;
    if (!r) return;
    const blob: Blob = await new Promise((resolve) => {
      r.rec.onstop = () => resolve(new Blob(r.chunks, { type: r.rec.mimeType || "audio/webm" }));
      r.rec.stop();
    });
    releaseMic(r.stream);
    recRef.current = null;
    setMicOn(false);
    setRecStream(null);
    if (!blob.size) return;
    ensureTrack();
    const loaded = await getEngine().loadSampleFile(blob, `REC ${r.pad + 1}`);
    setPadBank({ ...getPadBank(), [r.pad]: makePad(loaded) });
    // Stay on the pad grid — only open the pad's detail view when the user taps the pad.
  };

  /** press and hold a pad to record into it, release to stop */
  const beginHold = async (i: number) => {
    if (recRef.current || holdRef.current) return;
    holdRef.current = { pad: i, active: true };
    setRecPad(i);
    await startMic(i);
    if (!recRef.current) {
      // microphone refused — clear the hold so the next press can try again
      holdRef.current = null;
      setRecPad(null);
      return;
    }
    if (!holdRef.current?.active) {
      setRecPad(null);
      await stopMic();
    }
  };

  const endHold = () => {
    if (!holdRef.current) return;
    holdRef.current.active = false;
    holdRef.current = null;
    setRecPad(null);
    if (recRef.current) void stopMic();
  };

  const filled = useMemo(() => Object.keys(pads).length, [pads]);

  /** which pad the big waveform monitor is showing */
  const monitorId = playing ?? recPad ?? sel;
  const skin = useSkin("sampler");
  const imageDrag = useImageDrag("sampler", skin);
  const drop = useImageDrop("sampler");
  const monitorSample = pads[monitorId];
  const monitorPad = monitorSample
    ? { pad: monitorSample, color: padColor(Math.floor(monitorId / PADS_PER_BANK), monitorId % PADS_PER_BANK) }
    : null;

  return (
    <div className="studio-wallpaper space-y-3 rounded-md p-3" data-studio-panel="pads" {...drop}>
      <SkinControls skinKey="sampler" image padColor colorLabel="Around pads" />
      <div className="flex flex-wrap items-center gap-2">
        <Grid2x2 className="size-4 text-primary" />
        <span className="label-xs">PAD SAMPLER · {filled} pads loaded</span>
        <BypassButton name="Pad Sampler" bypassed={tracks.find(t => t.id === trackId || (t.kind === "sampler" && t.name === "PAD SAMPLER"))?.deviceBypassed ?? false} onToggle={() => { const id = ensureTrack(); const current = tracks.find(t => t.id === id); updateTrack(id, { deviceBypassed: !current?.deviceBypassed }); }} />
        <div className="flex gap-1">
          {BANKS.map((b, i) => (
            <Button
              key={b}
              size="sm"
              variant={i === bank ? "secondary" : "ghost"}
              className="h-7 w-7 font-mono text-[10px]"
              style={
                i === bank
                  ? { backgroundColor: BANK_COLORS[i] as string, color: "hsl(0 0% 8%)" }
                  : { color: BANK_COLORS[i] as string }
              }
              onClick={() => setBank(i)}
            >
              {b}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant={showKeyboard ? "secondary" : "ghost"} className="h-7 gap-1.5" aria-pressed={showKeyboard} onClick={() => setShowKeyboard((value) => !value)}>
            <Piano className="size-3.5" /> {showKeyboard ? "Hide keyboard" : "Show keyboard"}
          </Button>
          <Button
            size="sm"
            variant={seqOn ? "secondary" : "ghost"}
            className="h-7 gap-1.5"
            onClick={() => {
              stepRef.current = 0;
              setStep(0);
              setSeqOn((v) => !v);
            }}
          >
            {seqOn ? <Square className="size-3.5" /> : <Play className="size-3.5" />} {seqOn ? "Stop" : "Play pattern"}
          </Button>
          <Button
            size="sm"
            variant={liveRec ? "destructive" : "ghost"}
            className="h-7 gap-1.5"
            onClick={() => setLiveRec((v) => !v)}
          >
            <Circle className="size-3.5" /> Record taps
          </Button>
          <Button
            size="sm"
            variant={armRec ? "destructive" : "ghost"}
            className="h-9 gap-1.5 sm:h-7"
            aria-pressed={armRec}
            onClick={() => {
              endHold();
              setArmRec((v) => !v);
            }}
          >
            <Mic className="size-3.5" /> {armRec ? "Exit hold-to-record" : "Hold to record"}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1.5 sm:h-7" onClick={() => getEngine().stopSamples()}>
            <Square className="size-3.5" /> Panic
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 sm:h-7"
            onClick={async () => {
              ensureTrack();
              const starters = await renderStarterSamples();
              const current = getPadBank();
              const empties: number[] = [];
              for (let i = 0; i < PADS_PER_BANK && empties.length < starters.length; i++) if (!current[i]) empties.push(i);
              if (!empties.length) {
                toast("Bank A is full", { description: "Clear a pad or switch banks — starter samples load onto bank A's empty pads." });
                return;
              }
              const next = { ...current };
              for (let s = 0; s < empties.length; s++) {
                const st = starters[s]!;
                const loaded = await getEngine().loadSampleFile(st.blob, st.name);
                next[empties[s]!] = makePad(loaded);
              }
              setPadBank(next);
              toast.success(`Loaded ${empties.length} starter samples`, {
                description: "Kick, snare, clap, hats, rim, shaker and tom — real synthesized audio on bank A.",
              });
            }}
          >
            <Sparkles className="size-3.5" /> Starter samples
          </Button>
          <SavePadsDialog pads={pads} selected={sel} />
        </div>
      </div>

      {/* visible feature strip */}
      <div className="flex flex-wrap gap-1.5">
        {[
          [Upload, "Drag & drop audio"],
          [Mic, "Sample the mic"],
          [Scissors, "Slice to pads"],
          [Grid2x2, "4 banks · 64 pads"],
          [Play, "16-step patterns"],
          [Circle, "Record taps live"],
          [Square, "Choke groups"],
          [Copy, "Trim · tune · choke"],
        ].map(([Icon, label]) => {
          const I = Icon as typeof Upload;
          return (
            <span
              key={label as string}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/50 px-2 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground"
            >
              <I className="size-3" style={{ color: BANK_COLORS[bank] as string }} />
              {label as string}
            </span>
          );
        })}
      </div>

      {/* live monitor: shows the microphone while recording, or the pad you are playing */}
      <div className="signal-screen relative h-24 overflow-hidden rounded-md border border-border sm:h-20">
        {recStream ? (
          <LiveWave stream={recStream} color="hsl(0 85% 62%)" label="Live microphone waveform" />
        ) : monitorPad ? (
          <>
            <WaveformView peaks={monitorPad.pad.peaks} color="var(--display-wave)" label={`${monitorPad.pad.name} waveform`} />
            <span className="pointer-events-none absolute inset-y-0 left-0 bg-background/70" style={{ width: `${monitorPad.pad.start * 100}%` }} />
            <span className="pointer-events-none absolute inset-y-0 right-0 bg-background/70" style={{ width: `${(1 - monitorPad.pad.end) * 100}%` }} />
          </>
        ) : (
          <span className="absolute inset-x-0 bottom-0 top-5 flex items-center justify-center px-2 text-center font-mono text-[10px] tracking-widest text-muted-foreground">
            HOLD A PAD TO PLAY · HOLD TO RECORD TO SAMPLE
          </span>
        )}
        <span className="absolute left-2 top-1.5 font-mono text-[9px] tracking-widest text-white/70">
          {recStream ? "RECORDING" : monitorPad ? monitorPad.pad.name : "MONITOR"}
        </span>
      </div>

      <MidiPadLearnBar pads={padMidi} label="pads" names={(i) => `pad ${i + 1} (current bank)`} />
      <div className={`performance-pad-grid grid grid-cols-4 gap-2 ${skinBackground(skin) ? "rounded-lg p-2" : ""}`} style={{ ...skinBackground(skin), cursor: skin.image ? "move" : undefined }} {...imageDrag}>
        {Array.from({ length: PADS_PER_BANK }, (_, i) => {
          const id = index(i);
          const pad = pads[id];
          const active = hit === id || playing === id;
          const c = skin.padColor ?? padColor(bank, i);
          const recording = recPad === id;
          const sp = sweep[id];
          const release = () => {
            endSweep(id);
            if (holdRef.current?.pad === id || recRef.current?.pad === id) {
              endHold();
              return;
            }
            if (pad) {
              stopPad(id);
              setPlaying((current) => (current === id ? null : current));
            }
          };
          return (
            <Button variant="ghost"
              key={id}
              type="button"
              data-loaded={Boolean(pad)}
              onPointerDown={(e) => {
                setSel(id);
                if (armRec || !pad) {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer capture is unavailable in a few mobile webviews */
                  }
                  void beginHold(id);
                  return;
                }
                if (pad) {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer capture is unavailable in a few mobile webviews */
                  }
                  trigger(id);
                  setPlaying(id);
                  startSweep(id);
                }
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onPointerLeave={release}
              onContextMenu={(e) => armRec && e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(id);
              }}
              onDragLeave={() => setOver((o) => (o === id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const file = e.dataTransfer.files[0];
                if (file) return void loadInto(id, file);
                const raw = e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain");
                try {
                  const v = JSON.parse(raw) as { type?: string; id?: string };
                  const local = v?.type === "localfile" && v.id ? getLocalFile(v.id) : undefined;
                  if (local) void loadInto(id, local.file);
                } catch {
                  /* not a file drag */
                }
              }}
              style={
                recording
                  ? {
                      borderColor: "hsl(0 85% 58%)",
                      background: "linear-gradient(145deg, hsl(0 85% 45%), hsl(0 75% 28%))",
                      boxShadow: "0 0 22px hsl(0 85% 55% / 0.8)",
                    }
                  : pad
                    ? {
                        borderColor: c,
                        background: active
                          ? `linear-gradient(145deg, ${c}, color-mix(in hsl, ${c} 55%, transparent))`
                          : sel === id
                            ? `linear-gradient(145deg, color-mix(in oklab, ${c} 65%, var(--sampler-pad-face)), color-mix(in oklab, ${c} 40%, var(--sampler-pad-face)))`
                            : `linear-gradient(145deg, color-mix(in oklab, ${c} 45%, var(--sampler-pad-face)), color-mix(in oklab, ${c} 25%, var(--sampler-pad-face)))`,
                        boxShadow: active ? `0 0 18px ${c}` : sel === id ? `0 0 0 1px ${c}` : undefined,
                        opacity: over === id ? 0.85 : 1,
                      }
                    : over === id
                      ? { borderColor: c, backgroundColor: `color-mix(in hsl, ${c} 15%, transparent)` }
                      : armRec
                        ? { borderColor: `color-mix(in hsl, ${c} 60%, transparent)` }
                        : undefined
              }
              className={`sample-pad-wallpaper mpc-pad relative flex min-w-0 touch-none flex-col items-start justify-between whitespace-normal p-2 text-left select-none ${
                pad || recording ? "" : "mpc-pad-rubber"
              } ${active ? "is-lit" : ""} ${recording ? "animate-pulse" : ""}`}
            >
              <span className="relative z-10 font-mono text-[9px]" style={{ color: pad ? "hsl(0 0% 100% / 0.75)" : undefined }}>
                <span className={pad ? "" : "text-foreground"}>
                  {BANKS[bank]}
                  {i + 1} · {KEYMAP[i]?.toUpperCase()}
                </span>
              </span>
              {pad && !recording && pad.peaks.length > 1 && (
                <span
                  className={`pointer-events-none absolute inset-x-1.5 top-5 bottom-7 rounded-sm ${playing === id ? "bg-black/75" : ""}`}
                  style={{ opacity: playing === id ? 1 : 0.9 }}
                >
                  <WaveformView peaks={cropPadPeaks(pad)} color="var(--display-wave)" grid={false} outline={false} className="!h-full !w-full" label={`${pad.name} waveform`} />
                  {playing === id && sp !== undefined && (() => {
                    // Playhead tracks the real playback position: sample time is
                    // linear, so pitch, reverse and loop only shape the sweep.
                    const pos = pad.reverse ? 1 - sp : sp;
                    const played = pad.reverse ? { left: `${pos * 100}%`, right: 0 } : { left: 0, width: `${pos * 100}%` };
                    return (
                      <>
                        <span className="absolute inset-y-0 bg-white/20" style={played as import("react").CSSProperties} />
                        <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${pos * 100}%` }} />
                      </>
                    );
                  })()}
                </span>
              )}
              {recording && recStream && (
                <span className="pointer-events-none absolute inset-x-1.5 top-4 bottom-6">
                  <LiveWave stream={recStream} color="hsl(0 0% 100%)" label="Recording waveform" />
                </span>
              )}
              <span
                className={`line-clamp-2 font-mono text-[10px] ${pad || recording ? "" : "text-foreground"}`}
                style={pad || recording ? { color: "hsl(0 0% 100%)", textShadow: "0 1px 2px hsl(0 0% 0% / 0.5)" } : undefined}
              >
                {recording ? "RECORDING…" : pad ? pad.name : "HOLD TO RECORD"}
              </span>
              {pad && pad.choke > 0 && (
                <span className="absolute right-1 top-1 rounded-sm bg-accent px-1 font-mono text-[8px] text-accent-foreground">
                  C{pad.choke}
                </span>
              )}
              {pad && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${pad.name}`}
                  title="Delete this sample"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearPad(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      clearPad(id);
                    }
                  }}
                  className="absolute bottom-1 right-1 flex size-8 items-center justify-center rounded-sm bg-black/45 text-white/80 opacity-80 transition-opacity hover:bg-destructive hover:text-white hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          void loadInto(targetRef.current, e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* step sequencer for the selected pad */}
      <section aria-label="Pad pattern" className="pad-pattern-section space-y-2 rounded-md border-2 border-primary bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-primary">PATTERN · PAD {sel % PADS_PER_BANK + 1}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{transport.bpm} BPM · 16 steps</span>
          {selPad && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 font-mono text-[10px] tracking-widest"
              onClick={() => patch(sel, { steps: emptySteps() })}
            >
              Clear pattern
            </Button>
          )}
        </div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-16">
          {Array.from({ length: STEPS }, (_, s) => {
            const on = (selPad?.steps[s] ?? 0) > 0;
            return (
              <Button variant="outline"
                key={s}
                type="button"
                aria-label={`Step ${s + 1}`}
                disabled={!selPad}
                onClick={() => {
                  if (!selPad) return;
                  const steps = selPad.steps.slice();
                  steps[s] = on ? 0 : 1;
                  patch(sel, { steps });
                }}
                className={`h-8 rounded-sm border transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-primary/50 bg-surface-1 text-foreground hover:bg-primary/20"
                } ${seqOn && step === s ? "ring-2 ring-accent" : ""} ${s % 4 === 0 ? "opacity-100" : "opacity-85"}`}
              >{s + 1}</Button>
            );
          })}
        </div>
      </section>

      {!selPad ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-2/40 p-3 sm:flex sm:items-center">
          <div className="col-span-2 min-w-0 sm:mr-auto">
            <div className="font-display text-sm font-semibold">Pad {BANKS[bank]}{sel % PADS_PER_BANK + 1} is empty</div>
            <p className="text-xs text-muted-foreground">Record straight into it or choose an audio file.</p>
          </div>
          <Button variant={micOn ? "destructive" : "default"} className="min-h-11 gap-2" onClick={() => (micOn ? void stopMic() : void startMic(sel))}>
            <Mic className="size-4" /> {micOn ? "Stop recording" : "Record to pad"}
          </Button>
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => { targetRef.current = sel; fileRef.current?.click(); }}>
            <Upload className="size-4" /> Choose audio
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px]">{selPad.name}</span>
            <span className="label-xs">
              {selPad.duration.toFixed(2)}s · plays {(selPad.duration * (selPad.end - selPad.start)).toFixed(2)}s
            </span>
            <div className="ml-auto flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" className="h-7 gap-1.5" onClick={() => trigger(sel)}>
                <Play className="size-3.5" /> Play
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => stopPad(sel)}>
                <Square className="size-3.5" /> Stop
              </Button>
              <Button
                size="sm"
                variant={micOn ? "destructive" : "ghost"}
                className="h-7 gap-1.5"
                onClick={() => (micOn ? void stopMic() : void startMic(sel))}
              >
                <Mic className="size-3.5" /> {micOn ? "Stop sampling" : "Sample mic"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
                onClick={() => {
                  targetRef.current = sel;
                  fileRef.current?.click();
                }}
              >
                <Upload className="size-3.5" /> Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
                onClick={() => {
                  const free = Array.from({ length: PADS_PER_BANK }, (_, i) => index(i)).find((i) => !pads[i]);
                  if (free === undefined) {
                    toast("Bank is full", { description: "Switch to another bank to copy this pad." });
                    return;
                  }
                  setPads((p) => ({ ...p, [free]: { ...(p[sel] as Pad), steps: emptySteps() } }));
                  setSel(free);
                }}
              >
                <Copy className="size-3.5" /> Copy pad
              </Button>
              <SampleExportButtons className="h-7 gap-1.5" name={selPad.name} getCapture={() => captureFromUrl(selPad.url, selPad.start, selPad.end, selPad.reverse)} />
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive" onClick={() => clearPad(sel)}>
                <Trash2 className="size-3.5" /> Clear pad
              </Button>
            </div>
          </div>

          <PadWave key={`${sel}:${selPad.url}`} pad={selPad} color={BANK_COLORS[bank] as string} manual={manualCuts} onChange={(n) => patch(sel, n)} />
          <PadSampleTools key={sel} id={sel} pad={selPad} manual={manualCuts} onManual={() => setManualCuts(value => !value)} onPatch={next => patch(sel, next)} onPreview={(start, end) => { stopPad(sel); trigger(sel, 1, undefined, 60, { start, end }); }} onStop={() => stopPad(sel)} onStopTarget={stopPad} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="col-span-full flex flex-wrap items-start gap-x-2 gap-y-3 sm:col-span-1 lg:col-span-3" role="group" aria-label={`Pad ${sel + 1} sound`}>
              <Knob label="LEVEL" ariaLabel={`Pad ${sel + 1} level`} size={46} value={selPad.gain} min={0} max={2} step={0.01} defaultValue={1} format={(v) => `${Math.round(v * 100)}%`} midiTarget={{ id: `sampler-pad:${sel}`, param: "pad:gain" }} onChange={(v) => patch(sel, { gain: v })} />
              <Knob label="TUNE" ariaLabel={`Pad ${sel + 1} tune`} size={46} value={selPad.pitch} min={-24} max={24} step={0.1} defaultValue={0} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} st`} midiTarget={{ id: `sampler-pad:${sel}`, param: "pad:pitch" }} onChange={(v) => patch(sel, { pitch: v })} />
              <Knob label="ATTACK" ariaLabel={`Pad ${sel + 1} attack`} size={46} value={selPad.attack} min={0} max={1} step={0.001} defaultValue={0} format={(v) => `${Math.round(v * 1000)} ms`} midiTarget={{ id: `sampler-pad:${sel}`, param: "pad:attack" }} onChange={(v) => patch(sel, { attack: v })} />
              <Knob label="RELEASE" ariaLabel={`Pad ${sel + 1} release`} size={46} value={selPad.release} min={0.005} max={4} step={0.005} defaultValue={0.08} format={(v) => `${Math.round(v * 1000)} ms`} midiTarget={{ id: `sampler-pad:${sel}`, param: "pad:release" }} onChange={(v) => patch(sel, { release: v })} />
              <Knob label="CHOKE" ariaLabel={`Pad ${sel + 1} choke group`} size={46} value={selPad.choke} min={0} max={4} step={1} defaultValue={0} format={(v) => (Math.round(v) ? `GRP ${Math.round(v)}` : "OFF")} midiTarget={{ id: `sampler-pad:${sel}`, param: "pad:choke" }} onChange={(v) => patch(sel, { choke: Math.round(v) })} />
              <div className="flex flex-col items-center gap-1 pt-1">
                <Button size="sm" variant="secondary" className="h-8 px-2 text-[10px]" title="Set LEVEL so the loudest point of this pad's trimmed part reaches −1 dB (up to 200%)" onClick={() => {
                  const peak = getEngine().samplePeak(selPad.url, selPad.start, selPad.end);
                  if (!(peak > 0)) { toast("Nothing to normalize", { description: "This pad's trimmed part is silent or not loaded yet — play it once first." }); return; }
                  const gain = Math.min(2, 0.89 / peak);
                  patch(sel, { gain: Math.round(gain * 100) / 100 });
                  toast.success("Pad normalized to −1 dB", { description: gain >= 2 ? "Level set to the 200% maximum — the sample is very quiet." : `Level ${Math.round(gain * 100)}%` });
                }}>NORMALIZE</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Loop</span>
                <Switch checked={selPad.loop} onCheckedChange={(v) => patch(sel, { loop: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">Reverse</span>
                <Switch checked={selPad.reverse} onCheckedChange={(v) => patch(sel, { reverse: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="label-xs">One shot</span>
                <Switch checked={selPad.oneShot} onCheckedChange={(v) => patch(sel, { oneShot: v })} />
              </div>
            </div>
          </div>
        </>
      )}

      {showKeyboard && <div className="min-w-0 border-t border-border pt-3" aria-label="Sample pads keyboard"><Keyboard skinKey="pads-keyboard" disabled={!selPad} onPlay={(midi, velocity) => trigger(sel, velocity, undefined, midi)} /></div>}

      <p className="text-xs text-muted-foreground">
        Pads play through their own mixer channel, so you can fade them, send them to reverb and add effects like any
        other channel. Cloud Save keeps loaded and recorded pad sounds with your project.
      </p>
    </div>
  );
}
