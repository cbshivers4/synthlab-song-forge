import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowDownToLine, Circle, Mic, Play, Radio, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { LIVE_FX, getLiveFx, type LiveFxInfo } from "@/lib/synclab/live-fx";
import { getLooper, type LoopSlot } from "@/lib/synclab/live-looper";
import { cn } from "@/lib/utils";

function FxPad({ fx }: { fx: LiveFxInfo }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hold, setHold] = useState(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const down = useRef(false);

  const read = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const end = () => {
    down.current = false;
    if (holdRef.current) return;
    getLiveFx().release(fx.id);
    setPos(null);
  };

  useEffect(() => {
    if (!hold && !down.current && pos) {
      getLiveFx().release(fx.id);
      setPos(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  const active = pos !== null;
  return (
    <div className={cn("panel flex flex-col gap-1.5 p-2 transition-colors", active && "border-primary")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-display text-[11px] font-semibold tracking-[0.14em] uppercase">{fx.name}</span>
        <button
          type="button"
          onClick={() => setHold((h) => !h)}
          aria-pressed={hold}
          className={cn(
            "rounded-[3px] border px-2 py-1 font-mono text-[9px] tracking-widest uppercase",
            hold ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
          )}
        >
          Hold
        </button>
      </div>
      <div
        ref={box}
        role="slider"
        aria-label={`${fx.name} X-Y pad`}
        aria-valuenow={pos ? Math.round(pos.x * 100) : 0}
        tabIndex={0}
        className="relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-[4px] border border-border bg-surface-2/60"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          down.current = true;
          const p = read(e);
          setPos(p);
          getLiveFx().engage(fx.id, p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!down.current) return;
          const p = read(e);
          setPos(p);
          getLiveFx().move(fx.id, p.x, p.y);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:25%_25%]" />
        {pos && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/50" style={{ left: `${pos.x * 100}%` }} />
            <div className="pointer-events-none absolute inset-x-0 h-px bg-primary/50" style={{ top: `${(1 - pos.y) * 100}%` }} />
            <div
              className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]"
              style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%` }}
            />
          </>
        )}
        <span className="pointer-events-none absolute bottom-1 left-1.5 font-mono text-[9px] text-muted-foreground uppercase">X · {fx.x}</span>
        <span className="pointer-events-none absolute left-1.5 top-1 font-mono text-[9px] text-muted-foreground uppercase">Y · {fx.y}</span>
      </div>
    </div>
  );
}

const STATE_LABEL: Record<LoopSlot["state"], string> = {
  empty: "Tap to record",
  armed: "Waiting…",
  recording: "Recording",
  playing: "Playing",
  stopped: "Stopped",
};

function LoopTile({ slot, onSend }: { slot: LoopSlot; onSend: (i: number) => void }) {
  const looper = getLooper();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const firstFree = slot.state === "recording" && slot.recEnd === null;
  useEffect(() => {
    if (slot.state !== "playing" && slot.state !== "recording" && slot.state !== "armed") return;
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [slot.state]);

  let progress = 0;
  if (slot.state === "playing" && slot.buffer) {
    const len = slot.buffer.duration;
    progress = ((((looper.now - slot.start) % len) + len) % len) / len;
  } else if (slot.state === "recording") {
    progress = slot.recEnd ? (looper.now - slot.recStart) / (slot.recEnd - slot.recStart) : (looper.now - slot.recStart) % 1;
  } else if (slot.state === "armed") {
    progress = looper.phase;
  }

  return (
    <div
      className={cn(
        "panel flex flex-col gap-1.5 p-2",
        slot.state === "recording" && "border-destructive",
        slot.state === "armed" && "border-accent",
        slot.state === "playing" && "border-primary",
      )}
    >
      <button
        type="button"
        onClick={() => {
          looper.tap(slot.index).catch((err) =>
            toast.error("Couldn't start the looper", { description: err instanceof Error ? err.message : undefined }),
          );
        }}
        className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px] border border-border bg-surface-2/60 active:scale-[0.98]"
        aria-label={`Loop ${slot.index + 1}: ${STATE_LABEL[slot.state]}`}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 opacity-25",
            slot.state === "recording" ? "bg-destructive" : slot.state === "armed" ? "bg-accent" : "bg-primary",
          )}
          style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
        />
        <span className="relative font-display text-2xl font-bold">{slot.index + 1}</span>
        <span className="relative flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
          {slot.state === "recording" && <Circle className="size-2.5 fill-destructive text-destructive" />}
          {firstFree ? "Tap to close loop" : STATE_LABEL[slot.state]}
        </span>
      </button>
      <Slider
        value={[slot.volume]}
        min={0}
        max={1.2}
        step={0.01}
        onValueChange={(v) => looper.setVolume(slot.index, v[0] ?? 0)}
        aria-label={`Loop ${slot.index + 1} volume`}
      />
      <div className="grid grid-cols-3 gap-1">
        <Button
          size="icon"
          variant="secondary"
          className="h-9 w-full sm:h-7"
          disabled={!slot.buffer}
          onClick={() => (slot.state === "playing" ? looper.stop(slot.index) : looper.play(slot.index))}
          aria-label={slot.state === "playing" ? "Stop loop" : "Play loop"}
        >
          {slot.state === "playing" ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-9 w-full sm:h-7"
          disabled={!slot.buffer}
          onClick={() => onSend(slot.index)}
          aria-label="Send loop to timeline"
          title="Send to timeline"
        >
          <ArrowDownToLine className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-9 w-full sm:h-7"
          disabled={slot.state === "empty"}
          onClick={() => looper.clear(slot.index)}
          aria-label="Clear loop"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function LiveView() {
  const { transport, addTrack, addClip } = useStudio();
  const looper = getLooper();
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => looper.subscribe(rerender), [looper]);
  useEffect(() => {
    looper.bpm = transport.bpm;
    getLiveFx().bpm = transport.bpm;
  }, [transport.bpm, looper]);
  // FX sit on the master only while Live View is open; loops keep playing after it closes.
  useEffect(() => () => getLiveFx().detach(), []);

  const locked = !looper.isEmpty;
  const capturing = looper.slots.some((s) => s.state === "armed" || s.state === "recording");

  const send = async (i: number) => {
    const blob = looper.wav(i);
    if (!blob) return;
    try {
      const name = `LIVE LOOP ${i + 1}`;
      const res = await getEngine().loadSampleFile(blob, name);
      const trackId = addTrack("audio", name);
      addClip(trackId, {
        id: crypto.randomUUID(),
        name,
        peaks: res.peaks,
        duration: res.duration,
        url: res.url,
        start: transport.step,
        offset: 0,
        length: res.duration,
        gain: 1,
      });
      toast.success(`${name} added to the timeline`, { description: "Placed at the playhead on a new audio track." });
    } catch (err) {
      toast.error("Couldn't send the loop", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const seg = (on: boolean) =>
    cn(
      "h-10 rounded-[3px] border px-3 font-mono text-[10px] tracking-widest uppercase sm:h-8",
      on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
    );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xs font-semibold tracking-[0.2em]">PERFORMANCE FX · WHOLE SONG</h3>
          <p className="text-[11px] text-muted-foreground">Touch and drag a pad to play the effect. Let go to return to dry, or tap HOLD to latch it.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LIVE_FX.map((fx) => (
            <FxPad key={fx.id} fx={fx} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-xs font-semibold tracking-[0.2em]">
            <Radio className="size-4 text-primary" /> LIVE LOOPER
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" disabled={locked} className={seg(looper.mode === "sync")} onClick={() => looper.setMode("sync")}>
              Tempo sync
            </button>
            <button type="button" disabled={locked} className={seg(looper.mode === "free")} onClick={() => looper.setMode("free")}>
              Free length
            </button>
            {looper.mode === "sync" &&
              [1, 2, 4, 8].map((b) => (
                <button key={b} type="button" disabled={locked} className={seg(looper.bars === b)} onClick={() => looper.setBars(b)}>
                  {b} bar{b > 1 ? "s" : ""}
                </button>
              ))}
            <span className="mx-1 h-6 w-px bg-border" />
            <button type="button" disabled={capturing} className={seg(looper.source === "mic")} onClick={() => looper.setSource("mic")}>
              <Mic className="mr-1 inline size-3" /> Mic / interface
            </button>
            <button type="button" disabled={capturing} className={seg(looper.source === "output")} onClick={() => looper.setSource("output")}>
              App output
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {looper.mode === "sync"
            ? `First loop records ${looper.bars} bar${looper.bars > 1 ? "s" : ""} at ${transport.bpm} BPM.`
            : "Tap to start the first loop, tap again to close it — that sets the loop length."}{" "}
          Next loops start on the following cycle so everything stays in time. Change mode or length after clearing all loops.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {looper.slots.map((s) => (
            <LoopTile key={s.index} slot={s} onSend={send} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="h-11 sm:h-8" onClick={() => looper.playAll()}>
            <Play className="mr-1 size-3.5" /> Play all
          </Button>
          <Button variant="secondary" className="h-11 sm:h-8" onClick={() => looper.stopAll()}>
            <Square className="mr-1 size-3.5" /> Stop all
          </Button>
          <Button variant="secondary" className="h-11 sm:h-8" onClick={() => looper.clearAll()}>
            <Trash2 className="mr-1 size-3.5" /> Clear all
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Browser note: microphone loops include your device's input delay, which varies by interface and browser. Use headphones to avoid
          recording the speakers. Crusher's rate control darkens the sound rather than truly resampling.
        </p>
      </section>
    </div>
  );
}
