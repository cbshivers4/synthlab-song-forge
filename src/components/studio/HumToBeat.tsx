import { useEffect, useRef, useState } from "react";
import { Disc3, Mic, Music2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { GeneratedWaveform } from "./GeneratedWaveform";
import { PatternWaveform } from "./PatternWaveform";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
import { useStudio } from "@/lib/synclab/store";
import { openMic, preferredRecordingMime, releaseMic } from "@/lib/synclab/mic";
import { alignToStart, analyseBeatbox, analyseMelody, type BeatHit, type HumNote } from "@/lib/synclab/hum-to-beat";
import { stepsPerBar } from "@/lib/synclab/timebase";

type Mode = "beat" | "melody";
const MAX_SEC = 30;

export function HumToBeat() {
  const { tracks, transport, addTrack, updateTrack } = useStudio();
  const [mode, setMode] = useState<Mode>("beat");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<{ mode: Mode; hits: BeatHit[]; notes: HumNote[] } | null>(null);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const pending = useRef<{ id: string; hits: BeatHit[]; steps: number } | null>(null);

  const stopAll = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    releaseMic(streamRef.current);
    streamRef.current = null;
  };
  useEffect(() => () => { recRef.current?.state === "recording" && recRef.current.stop(); stopAll(); }, []);

  // Drum tracks are created with default pads; fill their steps once the track exists.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const t = tracks.find((x) => x.id === p.id);
    if (!t?.pads) return;
    pending.current = null;
    const pads = t.pads.map((pad) => {
      const steps = new Array(p.steps).fill(0);
      p.hits.filter((h) => h.kind === pad.kind && h.step < p.steps).forEach((h) => (steps[h.step] = h.velocity));
      return { ...pad, steps };
    });
    updateTrack(p.id, { pads, steps: p.steps });
  }, [tracks, updateTrack]);

  const start = async () => {
    const r = await openMic({ echoCancellation: false, noiseSuppression: false, autoGainControl: false }, "hum-to-beat");
    if (!("stream" in r)) { toast.error("Microphone unavailable", { description: r.error }); return; }
    streamRef.current = r.stream;
    const mime = preferredRecordingMime();
    const rec = new MediaRecorder(r.stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stopAll();
      setRecording(false);
      setBusy(true);
      try {
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(await new Blob(chunks, { type: rec.mimeType }).arrayBuffer());
        void ctx.close();
        const data = new Float32Array(buf.length);
        for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] = data[i]! + ch[i]! / buf.numberOfChannels; }
        setRecordedBuffer(buf);
        const bpm = transport.bpm || 120;
        if (mode === "beat") {
          const hits = alignToStart(analyseBeatbox(data, buf.sampleRate, bpm));
          setResult({ mode, hits, notes: [] });
          if (!hits.length) toast("No hits heard", { description: "Beatbox louder and closer to the mic." });
        } else {
          const notes = alignToStart(analyseMelody(data, buf.sampleRate, bpm));
          setResult({ mode, hits: [], notes });
          if (notes.length) toast.success(`Heard ${notes.length} notes`, { description: "Check the waveform and notes, then preview or add them to the timeline." });
          if (!notes.length) toast("No notes heard", { description: "Hum steady \"ooo\" or \"mmm\" notes for at least a quarter second each, with short gaps between them." });
        }
      } catch {
        toast.error("Couldn't read that recording");
      } finally {
        setBusy(false);
      }
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setResult(null);
    setRecordedBuffer(null);
    setSeconds(0);
    const t0 = Date.now();
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSeconds(s);
      if (s >= MAX_SEC) rec.state === "recording" && rec.stop();
    }, 200);
  };

  const stop = () => recRef.current?.state === "recording" && recRef.current.stop();

  const lengthSteps = (last: number) => {
    const bar = stepsPerBar();
    return Math.max(bar, Math.ceil((last + 1) / bar) * bar);
  };

  const pv = usePreviewTrack();
  const finalName = () => (result?.mode === "beat" ? "HUM BEAT" : "HUM MELODY");
  const build = (name: string) => {
    if (!result) return "";
    if (result.mode === "beat") {
      const steps = lengthSteps(Math.max(...result.hits.map((h) => h.step)));
      const id = addTrack("drum", name, undefined, { keepPanel: true });
      pending.current = { id, hits: result.hits, steps };
      return id;
    }
    const steps = lengthSteps(Math.max(...result.notes.map((n) => n.step + n.length - 1)));
    const id = addTrack("instrument", name, undefined, { keepPanel: true });
    updateTrack(id, { steps, notes: result.notes.map((n, i) => ({ id: `hum-${Date.now()}-${i}`, ...n })) });
    return id;
  };
  const preview = () => pv.start((n) => build(n(finalName())));
  const create = () => {
    if (!result) return;
    if (!pv.keep(finalName())) build(finalName());
    toast.success(result.mode === "beat" ? "Beat track added" : "Melody track added", {
      description: result.mode === "beat" ? `${result.hits.length} hits on kick, snare and hat.` : `${result.notes.length} notes — edit them in the piano roll.`,
    });
    setResult(null);
  };

  const counts = result?.hits.reduce<Record<string, number>>((a, h) => ((a[h.kind] = (a[h.kind] ?? 0) + 1), a), {});

  return (
    <section className="rounded-md border border-border bg-surface-1 p-4 space-y-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">HUM TO BEAT</h2>
        <p className="text-xs text-muted-foreground">
          Beatbox a rhythm or hum a melody. SYNCLAB listens to your recording and writes it as drum hits or notes at {transport.bpm} BPM.
          This is signal analysis on your device, not AI — clear, separated sounds work best.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {(["beat", "melody"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={recording || busy}
            onClick={() => { setMode(m); setResult(null); }}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium ${mode === m ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {m === "beat" ? <Disc3 className="size-4" /> : <Music2 className="size-4" />}
            {m === "beat" ? "Beatbox → Drums" : "Hum → Melody"}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "beat"
          ? "Deep “boom” sounds become kicks, “pff/ka” become snares, “ts” become hi-hats. The first hit lands on bar 1."
          : "Hum one note at a time with short gaps. The first note lands on bar 1, then open the piano roll to tidy up."}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button size="lg" variant="destructive" onClick={stop} className="min-h-12">
            <Square className="size-4 fill-current" /> Stop ({seconds.toFixed(1)}s / {MAX_SEC}s)
          </Button>
        ) : (
          <Button size="lg" onClick={() => void start()} disabled={busy} className="min-h-12">
            <Mic className="size-4" /> {busy ? "Listening back…" : "Record"}
          </Button>
        )}
        {result && (result.hits.length > 0 || result.notes.length > 0) && (
          <PreviewButtons pv={pv} onPreview={preview} onAdd={create} addLabel="Add to timeline" />
        )}
      </div>

      {recordedBuffer && <GeneratedWaveform buffer={recordedBuffer} label="Recorded hum / beatbox waveform" />}
      {result && (
        <div className="rounded-md border border-border bg-surface-2 p-3 font-mono text-xs">
          {result.mode === "beat"
            ? `Heard ${result.hits.length} hits — kick ${counts?.['kick'] ?? 0}, snare ${counts?.['snare'] ?? 0}, hat ${counts?.['hat'] ?? 0}`
            : `Heard ${result.notes.length} notes${result.notes.length ? ` — ${result.notes.slice(0, 16).map((n) => NOTE_NAMES[n.pitch % 12]! + (Math.floor(n.pitch / 12) - 1)).join(" ")}${result.notes.length > 16 ? " …" : ""}` : ""}`}
        </div>
      )}
      {result && (result.hits.length > 0 || result.notes.length > 0) && (
        <PatternWaveform
          bpm={transport.bpm}
          label={result.mode === "beat" ? "Generated drum beat waveform" : "Generated melody waveform"}
          pattern={result.mode === "beat"
            ? { hits: result.hits, steps: lengthSteps(Math.max(...result.hits.map((h) => h.step))) }
            : { notes: result.notes, instrument: "Metro Pluck", steps: lengthSteps(Math.max(...result.notes.map((n) => n.step + n.length - 1))) }}
        />
      )}
    </section>
  );
}
