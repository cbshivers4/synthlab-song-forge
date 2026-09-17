import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Circle,
  Copy,
  Grid2x2,
  Mic,
  Play,
  Scissors,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { toast } from "sonner";
import { WaveformView } from "@/components/studio/WaveformView";

const BANKS = ["A", "B", "C", "D"] as const;
/** Koala-style bank colors — each bank tints its loaded pads. */
const BANK_COLORS = ["hsl(187 85% 50%)", "hsl(38 95% 55%)", "hsl(330 80% 62%)", "hsl(95 70% 52%)"] as const;
const PADS_PER_BANK = 16;
const STEPS = 16;
const KEYMAP = "1234qwerasdfzxcv".split("");
const AUDIO_RE = /\.(mp3|wav|wave|aif|aiff|m4a|aac|ogg|flac|webm)$/i;

interface Pad {
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
function PadWave({ pad, color, onChange }: { pad: Pad; color: string; onChange: (p: Partial<Pad>) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<"start" | "end" | null>(null);

  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const f = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    if (drag === "start") onChange({ start: Math.min(f, pad.end - 0.002) });
    else onChange({ end: Math.max(f, pad.start + 0.002) });
  };

  return (
    <div
      ref={ref}
      className="relative h-28 w-full touch-none overflow-hidden rounded-lg border border-border bg-surface-2/60"
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
    >
      <div className="absolute inset-0">
        <WaveformView peaks={pad.peaks} color={color} label="Pad waveform" />
      </div>
      <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: `${pad.start * 100}%` }} />
      <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${(1 - pad.end) * 100}%` }} />
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
  );
}

export function PadSampler() {
  const { tracks, transport, addTrack, select } = useStudio();
  const [pads, setPads] = useState<Record<number, Pad>>({});
  const [bank, setBank] = useState(0);
  const [sel, setSel] = useState(0);
  const [hit, setHit] = useState<number | null>(null);
  const [seqOn, setSeqOn] = useState(false);
  const [step, setStep] = useState(0);
  const [liveRec, setLiveRec] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [over, setOver] = useState<number | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<number>(0);
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; pad: number } | null>(null);
  const padsRef = useRef(pads);
  padsRef.current = pads;
  const stepRef = useRef(0);
  const liveRef = useRef(liveRec);
  liveRef.current = liveRec;

  /** The mixer channel every pad plays through. */
  const ensureTrack = useCallback(() => {
    if (trackId && tracks.some((t) => t.id === trackId)) return trackId;
    const existing = tracks.find((t) => t.kind === "sampler" && t.name === "PAD SAMPLER");
    if (existing) {
      setTrackId(existing.id);
      return existing.id;
    }
    const id = addTrack("sampler", "PAD SAMPLER");
    setTrackId(id);
    select(id);
    return id;
  }, [addTrack, select, trackId, tracks]);

  const index = (i: number) => bank * PADS_PER_BANK + i;
  const selPad = pads[sel];

  const trigger = useCallback(
    (i: number, velocity = 1) => {
      const pad = padsRef.current[i];
      if (!pad) return;
      const id = ensureTrack();
      getEngine().playSample(
        id,
        {
          url: pad.url,
          start: pad.start,
          end: pad.end,
          gain: pad.gain,
          pitch: pad.pitch,
          rootNote: 60,
          loop: pad.loop,
          reverse: pad.reverse,
          oneShot: pad.oneShot,
          attack: pad.attack,
          release: pad.release,
        },
        60,
        undefined,
        velocity,
        undefined,
        pad.choke ? `choke${pad.choke}` : `pad${i}`,
      );
      setHit(i);
      window.setTimeout(() => setHit((h) => (h === i ? null : h)), 120);
      if (liveRef.current) {
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
    [ensureTrack],
  );

  /* pad step sequencer */
  useEffect(() => {
    if (!seqOn) return;
    const interval = (60 / Math.max(40, transport.bpm) / 4) * 1000;
    const timer = window.setInterval(() => {
      stepRef.current = (stepRef.current + 1) % STEPS;
      const s = stepRef.current;
      setStep(s);
      for (const [key, pad] of Object.entries(padsRef.current)) {
        const v = pad.steps[s] ?? 0;
        if (v > 0) trigger(Number(key), v);
      }
    }, interval);
    return () => window.clearInterval(timer);
  }, [seqOn, transport.bpm, trigger]);

  /* computer keyboard pads */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable)
        return;
      const k = KEYMAP.indexOf(e.key.toLowerCase());
      if (k < 0) return;
      e.preventDefault();
      trigger(index(k));
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  /** Stop just one pad's voice (and its choke group) without touching the others. */
  const stopPad = useCallback(
    (i: number) => {
      const pad = padsRef.current[i];
      const id = trackId;
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
    setPads((p) => ({ ...p, [i]: makePad(loaded) }));
    setSel(i);
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

  /** Spreads the selected pad's sample across the bank as equal chops. */
  const chopToPads = (n: number) => {
    const src = pads[sel];
    if (!src) return;
    const span = src.end - src.start;
    setPads((p) => {
      const next = { ...p };
      for (let i = 0; i < n; i++) {
        const a = src.start + (span * i) / n;
        const b = src.start + (span * (i + 1)) / n;
        next[bank * PADS_PER_BANK + i] = {
          ...makePad({ url: src.url, name: `${src.name} ${i + 1}`, peaks: src.peaks, duration: src.duration }, a, b),
        };
      }
      return next;
    });
    setSel(bank * PADS_PER_BANK);
    toast.success(`Sliced across ${n} pads`, { description: `Bank ${BANKS[bank]} now holds the chops in order.` });
  };

  /* record straight into a pad from the microphone */
  const startMic = async (i: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.start(200);
      recRef.current = { rec, stream, chunks, pad: i };
      setMicOn(true);
    } catch {
      toast.error("Microphone not available", {
        description: "Allow microphone access in your browser to sample straight into a pad.",
      });
    }
  };

  const stopMic = async () => {
    const r = recRef.current;
    if (!r) return;
    const blob: Blob = await new Promise((resolve) => {
      r.rec.onstop = () => resolve(new Blob(r.chunks, { type: r.rec.mimeType || "audio/webm" }));
      r.rec.stop();
    });
    r.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    setMicOn(false);
    if (!blob.size) return;
    ensureTrack();
    const loaded = await getEngine().loadSampleFile(blob, `REC ${r.pad + 1}`);
    setPads((p) => ({ ...p, [r.pad]: makePad(loaded) }));
    setSel(r.pad);
  };

  const filled = useMemo(() => Object.keys(pads).length, [pads]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Grid2x2 className="size-4 text-primary" />
        <span className="label-xs">PAD SAMPLER · {filled} pads loaded</span>
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
          <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => getEngine().stopSamples()}>
            <Square className="size-3.5" /> Panic
          </Button>
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

      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: PADS_PER_BANK }, (_, i) => {
          const id = index(i);
          const pad = pads[id];
          const active = hit === id;
          const c = BANK_COLORS[bank] as string;
          return (
            <button
              key={id}
              type="button"
              onPointerDown={() => (pad ? trigger(id) : (targetRef.current = id, fileRef.current?.click()))}
              onClick={() => setSel(id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(id);
              }}
              onDragLeave={() => setOver((o) => (o === id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                void loadInto(id, e.dataTransfer.files[0]);
              }}
              style={
                pad
                  ? {
                      borderColor: c,
                      background: active
                        ? `linear-gradient(145deg, ${c}, color-mix(in hsl, ${c} 55%, transparent))`
                        : sel === id
                          ? `linear-gradient(145deg, color-mix(in hsl, ${c} 55%, transparent), color-mix(in hsl, ${c} 22%, transparent))`
                          : `linear-gradient(145deg, color-mix(in hsl, ${c} 30%, transparent), color-mix(in hsl, ${c} 10%, transparent))`,
                      boxShadow: active ? `0 0 18px ${c}` : sel === id ? `0 0 0 1px ${c}` : undefined,
                      opacity: over === id ? 0.85 : 1,
                    }
                  : over === id
                    ? { borderColor: c, backgroundColor: `color-mix(in hsl, ${c} 15%, transparent)` }
                    : undefined
              }
              className={`relative flex h-20 flex-col items-start justify-between rounded-md border p-2 text-left transition-all ${
                pad ? "" : "border-dashed border-border bg-surface-2/40 hover:border-muted-foreground/60"
              }`}
            >
              <span className="relative z-10 font-mono text-[9px]" style={{ color: pad ? "hsl(0 0% 100% / 0.75)" : undefined }}>
                <span className={pad ? "" : "text-muted-foreground"}>
                  {BANKS[bank]}
                  {i + 1} · {KEYMAP[i]?.toUpperCase()}
                </span>
              </span>
              {pad && (
                <span className="pointer-events-none absolute inset-x-1.5 top-4 bottom-6">
                  <WaveformView peaks={pad.peaks} color="hsl(0 0% 100%)" grid={false} label={`${pad.name} waveform`} />
                  <span
                    className="absolute inset-y-0 left-0 bg-black/55"
                    style={{ width: `${pad.start * 100}%` }}
                  />
                  <span
                    className="absolute inset-y-0 right-0 bg-black/55"
                    style={{ width: `${(1 - pad.end) * 100}%` }}
                  />
                </span>
              )}
              <span
                className={`line-clamp-2 font-mono text-[10px] ${pad ? "" : "text-foreground"}`}
                style={pad ? { color: "hsl(0 0% 100%)", textShadow: "0 1px 2px hsl(0 0% 0% / 0.5)" } : undefined}
              >
                {pad ? pad.name : "drop / tap to load"}
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
                  className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-sm bg-black/45 text-white/80 opacity-70 transition-opacity hover:bg-destructive hover:text-white hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </span>
              )}
            </button>
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
      <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-xs">Pattern · pad {sel % PADS_PER_BANK + 1}</span>
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
              <button
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
                  on ? "border-primary bg-primary" : "border-border bg-surface-1 hover:bg-primary/20"
                } ${seqOn && step === s ? "ring-2 ring-accent" : ""} ${s % 4 === 0 ? "opacity-100" : "opacity-85"}`}
              />
            );
          })}
        </div>
      </div>

      {!selPad ? (
        <p className="text-sm text-muted-foreground">
          Drop an audio file on any pad, or tap an empty pad to pick one. You can also sample straight from your
          microphone, then slice that sound across the whole bank.
        </p>
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
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive" onClick={() => clearPad(sel)}>
                <Trash2 className="size-3.5" /> Clear pad
              </Button>
            </div>
          </div>

          <PadWave pad={selPad} color={BANK_COLORS[bank] as string} onChange={(n) => patch(sel, n)} />

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
            <Scissors className="size-4 text-primary" />
            <span className="label-xs">Slice this sound across bank {BANKS[bank]}</span>
            {[4, 8, 16].map((n) => (
              <Button
                key={n}
                size="sm"
                variant="secondary"
                className="h-7 font-mono text-[10px] tracking-widest"
                onClick={() => chopToPads(n)}
              >
                {n}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">
              Each slice lands on its own pad, in order, keeping the original sound untouched.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Level" value={`${Math.round(selPad.gain * 100)}%`}>
              <Slider value={[selPad.gain]} min={0} max={2} step={0.01} onValueChange={([v]) => patch(sel, { gain: v ?? 1 })} />
            </Row>
            <Row label="Tune" value={`${selPad.pitch > 0 ? "+" : ""}${selPad.pitch.toFixed(1)} st`}>
              <Slider value={[selPad.pitch]} min={-24} max={24} step={0.1} onValueChange={([v]) => patch(sel, { pitch: v ?? 0 })} />
            </Row>
            <Row label="Attack" value={`${Math.round(selPad.attack * 1000)} ms`}>
              <Slider value={[selPad.attack]} min={0} max={1} step={0.001} onValueChange={([v]) => patch(sel, { attack: v ?? 0 })} />
            </Row>
            <Row label="Release" value={`${Math.round(selPad.release * 1000)} ms`}>
              <Slider value={[selPad.release]} min={0.005} max={4} step={0.005} onValueChange={([v]) => patch(sel, { release: v ?? 0.08 })} />
            </Row>
            <Row label="Choke group" value={selPad.choke ? `Group ${selPad.choke}` : "Off"}>
              <Slider value={[selPad.choke]} min={0} max={4} step={1} onValueChange={([v]) => patch(sel, { choke: v ?? 0 })} />
            </Row>
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

      <p className="text-xs text-muted-foreground">
        Pads play through their own mixer channel, so you can fade them, send them to reverb and add effects like any
        other channel. Sounds you load or record stay in this session only — save them with your project export if you
        want to keep them.
      </p>
    </div>
  );
}
