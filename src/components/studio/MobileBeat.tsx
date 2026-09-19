import { useEffect, useMemo, useRef, useState } from "react";
import { Disc3, Grid2x2, Mic, Minus, Play, Plus, Shuffle, SlidersHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { openInOwnTab } from "@/lib/synclab/mic";
import { uid } from "@/lib/synclab/presets";
import type { DrumPad, Track } from "@/lib/synclab/types";
import { toast } from "sonner";

type Tab = "pads" | "steps" | "sound" | "rec";

const PAD_HUES = [187, 320, 45, 100, 265, 10, 160, 210];

function padColor(i: number) {
  return `hsl(${(PAD_HUES[i % PAD_HUES.length] ?? 187) + (i > 7 ? 18 : 0)} 85% 56%)`;
}

function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibration unsupported */
  }
}

/**
 * Full-screen, thumb-sized beat maker for phones. Everything here drives the
 * same project state as the desktop studio — no separate engine, no demo mode.
 */
export function MobileBeat({ onClose }: { onClose: () => void }) {
  const { tracks, addTrack, updatePad, generateBeat, transport, setTransport, togglePlay, stop, updateTrack, addClip, previewClip } =
    useStudio();
  const [tab, setTab] = useState<Tab>("pads");
  const [padIdx, setPadIdx] = useState(0);
  const [page, setPage] = useState(0);

  // ---- mic recording (hold to record) ----
  const [recTrackId, setRecTrackId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recLevel, setRecLevel] = useState(0);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<number | null>(null);

  const micTrack: Track | undefined = useMemo(
    () => tracks.find((t) => t.id === recTrackId) ?? tracks.find((t) => t.kind === "audio"),
    [tracks, recTrackId],
  );

  useEffect(
    () => () => {
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    },
    [],
  );

  const startRec = async () => {
    if (recording) return;
    buzz(20);
    let id = micTrack?.id;
    if (!id) id = addTrack("audio", "PHONE MIC");
    setRecTrackId(id);
    const engine = getEngine();
    try {
      await engine.startInputRecording(id, false);
    } catch (err) {
      toast.error("Microphone unavailable", {
        description: err instanceof Error ? err.message : "The microphone could not be opened.",
        duration: 9000,
        action: { label: "Open in tab", onClick: openInOwnTab },
      });
      return;
    }
    recStartRef.current = transport.step ?? 0;
    updateTrack(id, { armed: true, recording: true });
    setRecording(true);
    setRecElapsed(0);
    const t0 = performance.now();
    recTimerRef.current = window.setInterval(() => {
      setRecElapsed((performance.now() - t0) / 1000);
      setRecLevel(engine.inputLevel());
    }, 80);
  };

  const stopRec = async () => {
    if (!recording) return;
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setRecording(false);
    setRecLevel(0);
    const id = recTrackId;
    if (!id) return;
    const result = await getEngine().stopInputRecording();
    if (!result) {
      updateTrack(id, { recording: false });
      toast("Nothing captured", { description: "Hold the mic button a little longer." });
      return;
    }
    const takeNo = (tracks.find((t) => t.id === id)?.clips?.length ?? 0) + 1;
    updateTrack(id, { recording: false });
    addClip(id, {
      id: uid(),
      name: `MIC ${takeNo}`,
      peaks: result.peaks,
      duration: result.duration,
      url: result.url,
      start: recStartRef.current,
      offset: 0,
      length: result.duration,
      gain: 1,
    });
    buzz(30);
    toast.success(`MIC ${takeNo} added to the timeline`, {
      description: `${result.duration.toFixed(1)}s — open the full studio to edit it.`,
    });
  };

  const drumTrack: Track | undefined = useMemo(() => tracks.find((t) => t.kind === "drum"), [tracks]);

  // A beat needs a drum track — make one the first time this screen opens.
  useEffect(() => {
    if (!drumTrack) addTrack("drum", "BEAT");
  }, [drumTrack, addTrack]);

  const pads = drumTrack?.pads ?? [];
  const pad: DrumPad | undefined = pads[Math.min(padIdx, Math.max(0, pads.length - 1))];
  const stepCount = drumTrack?.steps ?? 16;
  const pages = Math.max(1, Math.ceil(stepCount / 16));
  const pageStart = Math.min(page, pages - 1) * 16;

  const hit = (p: DrumPad) => {
    if (!drumTrack) return;
    buzz();
    getEngine().playDrum(drumTrack.id, p, 1);
  };

  const cycleStep = (i: number) => {
    if (!drumTrack || !pad) return;
    buzz(8);
    const v = pad.steps[i] ?? 0;
    const next = v === 0 ? 0.7 : v <= 0.7 ? 1 : v <= 1 ? 0.35 : 0;
    updatePad(drumTrack.id, pad.id, { steps: pad.steps.map((x, j) => (j === i ? next : x)) });
  };

  if (!drumTrack) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
        Setting up your drum kit…
      </div>
    );
  }

  const bpm = transport.bpm;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Transport — big targets, always visible */}
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b-2 border-border bg-surface-2/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            className="size-14 rounded-2xl"
            variant={transport.playing ? "default" : "secondary"}
            aria-label={transport.playing ? "Stop" : "Play"}
            onClick={() => {
              buzz(16);
              if (transport.playing) stop();
              else togglePlay();
            }}
          >
            {transport.playing ? <Square className="size-6" /> : <Play className="size-6" />}
          </Button>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="size-11 rounded-xl"
            aria-label="Slower"
            onClick={() => setTransport({ bpm: Math.max(40, bpm - 1) })}
          >
            <Minus className="size-5" />
          </Button>
          <div className="min-w-20 text-center">
            <div className="font-mono text-2xl leading-none font-bold">{bpm}</div>
            <div className="label-xs">BPM</div>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="size-11 rounded-xl"
            aria-label="Faster"
            onClick={() => setTransport({ bpm: Math.min(300, bpm + 1) })}
          >
            <Plus className="size-5" />
          </Button>
        </div>
        <Button size="icon" variant="ghost" className="size-11" aria-label="Leave beat mode" onClick={onClose}>
          <X className="size-6" />
        </Button>
      </header>

      {/* Voice selector */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-3 py-2">
        {pads.map((p, i) => (
          <button
            key={p.id}
            onClick={() => {
              setPadIdx(i);
              hit(p);
            }}
            className="h-11 shrink-0 rounded-xl border-2 px-4 font-mono text-xs tracking-widest uppercase"
            style={{
              borderColor: i === padIdx ? padColor(i) : "var(--color-border)",
              color: i === padIdx ? padColor(i) : undefined,
              background: i === padIdx ? `color-mix(in oklab, ${padColor(i)} 18%, transparent)` : "transparent",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "pads" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pads.map((p, i) => {
              const c = padColor(i);
              return (
                <button
                  key={p.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setPadIdx(i);
                    hit(p);
                  }}
                  className="flex h-28 touch-none flex-col items-center justify-center gap-1 rounded-2xl border-2 font-mono text-sm tracking-widest uppercase transition-transform select-none active:scale-95"
                  style={{
                    borderColor: c,
                    color: c,
                    background: `linear-gradient(150deg, color-mix(in oklab, ${c} 22%, transparent), transparent)`,
                    boxShadow: i === padIdx ? `0 0 20px color-mix(in oklab, ${c} 55%, transparent)` : undefined,
                  }}
                >
                  {p.name}
                  <span className="text-[10px] opacity-60">{p.steps.filter((v) => v > 0).length} hits</span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "steps" && pad && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: padColor(padIdx) }}>
                {pad.name}
              </span>
              {pages > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`h-9 w-9 rounded-lg border font-mono text-xs ${i === page ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: Math.min(16, stepCount - pageStart) }, (_, n) => {
                const i = pageStart + n;
                const v = pad.steps[i] ?? 0;
                const live = transport.playing && transport.step === i % 16;
                return (
                  <button
                    key={i}
                    aria-label={`${pad.name} step ${i + 1}`}
                    onClick={() => cycleStep(i)}
                    className="flex h-16 touch-none items-end justify-between rounded-xl border-2 p-2 font-mono text-[10px] select-none active:scale-95"
                    style={{
                      borderColor: live ? "var(--neon)" : v > 0 ? padColor(padIdx) : "var(--color-border)",
                      background:
                        v > 0
                          ? `color-mix(in oklab, ${padColor(padIdx)} ${20 + v * 55}%, transparent)`
                          : i % 4 === 0
                            ? "color-mix(in oklab, var(--surface-2) 90%, transparent)"
                            : "transparent",
                    }}
                  >
                    <span className="opacity-60">{i + 1}</span>
                    <span className="opacity-80">{v > 0 ? `${Math.round(v * 100)}` : ""}</span>
                  </button>
                );
              })}
            </div>
            <p className="label-xs">Tap a step: loud · accent · soft · off.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-12 flex-1 gap-2 rounded-xl"
                onClick={() => {
                  generateBeat(drumTrack.id, "Detroit Techno", 6);
                  toast.success("Beat generated");
                }}
              >
                <Shuffle className="size-4" /> Generate
              </Button>
              <Button
                variant="secondary"
                className="h-12 flex-1 rounded-xl"
                onClick={() => updatePad(drumTrack.id, pad.id, { steps: pad.steps.map(() => 0) })}
              >
                Clear voice
              </Button>
            </div>
          </div>
        )}

        {tab === "rec" && (
          <div className="flex flex-col items-center gap-5 pt-2">
            <div className="text-center">
              <div className="font-mono text-4xl font-bold tabular-nums">
                {`${Math.floor(recElapsed / 60)}:${String(Math.floor(recElapsed % 60)).padStart(2, "0")}`}
              </div>
              <div className="label-xs mt-1">{recording ? "Recording — lift to stop" : "Hold the mic to record"}</div>
            </div>
            <div className="h-2.5 w-56 overflow-hidden rounded-full border border-border bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${Math.min(100, recLevel * 130)}%`,
                  background: recLevel > 0.92 ? "var(--neon-pink)" : "var(--neon)",
                }}
              />
            </div>
            <button
              aria-label={recording ? "Stop recording" : "Hold to record"}
              onPointerDown={(e) => {
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* some browsers reject capture for synthetic pointers — recording still works */
                }
                void startRec();
              }}
              onPointerUp={() => void stopRec()}
              onPointerCancel={() => void stopRec()}
              className={`grid size-40 touch-none place-items-center rounded-full border-4 font-mono text-xs tracking-widest uppercase select-none active:scale-95 ${
                recording ? "animate-pulse border-destructive text-destructive" : "border-primary text-primary"
              }`}
              style={{
                background: recording
                  ? "color-mix(in oklab, var(--destructive) 22%, transparent)"
                  : "color-mix(in oklab, var(--primary) 14%, transparent)",
                boxShadow: recording ? "0 0 34px color-mix(in oklab, var(--destructive) 60%, transparent)" : undefined,
              }}
            >
              <Mic className="size-12" />
              {recording ? "REC" : "HOLD"}
            </button>
            <p className="label-xs px-6 text-center">
              Tip: press Play first to sing or rap over your beat. Each take lands on the timeline.
            </p>
            {(micTrack?.clips?.length ?? 0) > 0 && (
              <div className="w-full space-y-2">
                <div className="label-xs">Takes on {micTrack?.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  {micTrack?.clips?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        buzz(8);
                        if (micTrack) previewClip(micTrack.id, c.id);
                      }}
                      className="flex h-12 items-center justify-between rounded-xl border border-border bg-surface-2/60 px-3 font-mono text-[11px] tracking-widest uppercase"
                    >
                      <span>{c.name}</span>
                      <span className="opacity-60">{c.duration.toFixed(1)}s</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "sound" && pad && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-4">
              <Knob size={64} label="VOL" value={pad.volume} onChange={(v) => updatePad(drumTrack.id, pad.id, { volume: v })} />
              <Knob size={64} label="PAN" min={-1} max={1} value={pad.pan} onChange={(v) => updatePad(drumTrack.id, pad.id, { pan: v })} />
              <Knob size={64} label="PITCH" min={-12} max={12} step={1} value={pad.pitch} onChange={(v) => updatePad(drumTrack.id, pad.id, { pitch: v })} />
              <Knob size={64} label="DECAY" value={pad.decay} onChange={(v) => updatePad(drumTrack.id, pad.id, { decay: v })} />
              <Knob size={64} label="TONE" value={pad.tone ?? 0.5} onChange={(v) => updatePad(drumTrack.id, pad.id, { tone: v })} />
              <Knob size={64} label="DRIVE" value={pad.drive ?? 0} onChange={(v) => updatePad(drumTrack.id, pad.id, { drive: v })} />
              <Knob size={64} label="SNAP" value={pad.snap ?? 0} onChange={(v) => updatePad(drumTrack.id, pad.id, { snap: v })} />
              <Knob size={64} label="NOISE" value={pad.noise ?? 0} onChange={(v) => updatePad(drumTrack.id, pad.id, { noise: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Swing</span>
                <span className="font-mono text-xs">{Math.round((transport.swing ?? 0) * 100)}%</span>
              </div>
              <Slider
                value={[transport.swing ?? 0]}
                min={0}
                max={0.6}
                step={0.01}
                onValueChange={([v = 0]) => setTransport({ swing: v })}
              />
            </div>
            <Button variant="secondary" className="h-12 w-full rounded-xl" onClick={() => hit(pad)}>
              Preview sound
            </Button>
          </div>
        )}
      </div>

      {/* Bottom tabs — thumb reach */}
      <nav className="grid shrink-0 grid-cols-4 gap-2 border-t-2 border-border bg-surface-2/70 p-2">
        {(
          [
            ["pads", "PADS", <Grid2x2 key="a" className="size-5" />],
            ["steps", "STEPS", <Disc3 key="b" className="size-5" />],
            ["sound", "SOUND", <SlidersHorizontal key="c" className="size-5" />],
            ["rec", "MIC", <Mic key="d" className="size-5" />],
          ] as [Tab, string, React.ReactNode][]
        ).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 font-mono text-[10px] tracking-widest ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
