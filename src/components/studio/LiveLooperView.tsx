import { useEffect, useMemo, useReducer } from "react";
import { ArrowDownToLine, Circle, Mic, Play, RotateCcw, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getLooper, type LoopSlot } from "@/lib/synclab/live-looper";
import { getBeatsPerBar } from "@/lib/synclab/timebase";
import { cn } from "@/lib/utils";
import { TRACK_PALETTE } from "./TrackStyle";
import { MidiLearnButton } from "./MidiLearn";
import { MidiPadLearnBar, useMidiPads } from "./MidiPadLearn";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";

const labels: Record<LoopSlot["state"], string> = {
  empty: "RECORD", armed: "ARMED", recording: "REC", playing: "PLAYING", stopped: "STOPPED",
};
const polar = (angle: number, radius: number) => ({ x: 100 + Math.cos(angle) * radius, y: 100 + Math.sin(angle) * radius });

function LoopDonut({ slot, send }: { slot: LoopSlot; send: (i: number) => void }) {
  const looper = getLooper();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!["armed", "recording", "playing"].includes(slot.state)) return;
    let frame = 0;
    let last = 0;
    const animate = (time: number) => {
      if (time - last >= 50) { last = time; tick(); }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [slot.state]);
  let progress = 0;
  if (slot.state === "playing" && slot.buffer) progress = (((looper.now - slot.start) % slot.buffer.duration) + slot.buffer.duration) % slot.buffer.duration / slot.buffer.duration;
  else if (slot.state === "recording") progress = slot.recEnd ? (looper.now - slot.recStart) / (slot.recEnd - slot.recStart) : 0;
  else if (slot.state === "armed") progress = looper.phase;
  progress = Math.max(0, Math.min(1, progress));
  const levels = looper.levels(slot.index);
  const wave = useMemo(() => {
    const buf = slot.buffer;
    if (!buf) return null;
    const N = 180;
    const data = buf.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / N));
    const peaks: number[] = [];
    let max = 0;
    for (let b = 0; b < N; b++) {
      let p = 0;
      for (let i = b * size, e = Math.min(data.length, (b + 1) * size); i < e; i += 4) p = Math.max(p, Math.abs(data[i] ?? 0));
      peaks.push(p);
      max = Math.max(max, p);
    }
    const norm = max > 0 ? 1 / max : 0;
    const outer: string[] = [];
    const inner: string[] = [];
    peaks.forEach((p, n) => {
      const ang = -Math.PI / 2 + (n / N) * Math.PI * 2;
      const amp = Math.max(0.04, p * norm) * 19;
      const o = polar(ang, 78 + amp);
      const i = polar(ang, 78 - amp);
      outer.push(`${o.x.toFixed(1)},${o.y.toFixed(1)}`);
      inner.unshift(`${i.x.toFixed(1)},${i.y.toFixed(1)}`);
    });
    return `M${outer.join("L")}Z M${inner.join("L")}Z`;
  }, [slot.buffer]);
  const ringColor = slot.state === "recording" ? "var(--destructive)" : slot.state === "armed" ? "var(--amber)" : slot.color;
  const circle = 2 * Math.PI * 78;
  const beatLen = 60 / (looper.bpm || 120);
  let countLabel: string | null = null;
  if (slot.state === "armed" && looper.precountStart !== null && looper.now < slot.recStart) {
    const left = Math.ceil((slot.recStart - looper.now) / beatLen - 1e-3);
    countLabel = String(((left - 1) % getBeatsPerBar()) + 1);
  } else if (slot.state === "recording" && looper.precount > 0 && looper.now - slot.recStart < 0.5 && looper.now >= slot.recStart) {
    countLabel = "GO";
  }
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 border-b border-border pb-4">
      <Button
        type="button" variant="ghost"
        className="relative aspect-square h-auto w-full max-w-36 rounded-full p-0 text-foreground hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Loop ${slot.index + 1}: ${slot.state === "recording" && slot.recEnd === null ? "close recording" : labels[slot.state]}`}
        onClick={() => void looper.tap(slot.index).catch((error) => toast.error("Couldn't start the looper", { description: error instanceof Error ? error.message : undefined }))}
      >
         <svg className="absolute inset-0 !h-full !w-full overflow-visible" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="78" fill="none" stroke="var(--border)" strokeWidth="20" />
          <circle cx="100" cy="100" r="78" fill="none" stroke={ringColor} strokeOpacity="0.22" strokeWidth="20" />
          {wave && slot.state !== "recording" && (
            <path d={wave} fill={ringColor} fillRule="evenodd" opacity={slot.muted ? 0.35 : 0.85} />
          )}
          {!(wave && slot.state !== "recording") && levels.map((level, n) => {
            const angle = -Math.PI / 2 + n * Math.PI * 2 / levels.length;
            const a = polar(angle, 67);
            const b = polar(angle, 71 + Math.max(0.12, level) * 17);
            return <line key={n} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ringColor} strokeWidth="2" strokeLinecap="round" opacity={slot.state === "empty" ? 0.25 : 0.9} />;
          })}
          <circle cx="100" cy="100" r="78" fill="none" stroke={ringColor} strokeWidth="5" strokeDasharray={`${circle * progress} ${circle}`} transform="rotate(-90 100 100)" strokeLinecap="round" />
          <circle cx="100" cy="100" r="57" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          {slot.state !== "empty" && <circle cx={polar(-Math.PI / 2 + progress * 2 * Math.PI, 78).x} cy={polar(-Math.PI / 2 + progress * 2 * Math.PI, 78).y} r="4" fill={ringColor} />}
        </svg>
        <span className="relative z-10 flex flex-col items-center gap-1 leading-none">
          {countLabel ? (
            <span aria-live="assertive" className={cn("font-display text-5xl font-bold", countLabel === "GO" ? "text-destructive" : "text-primary")}>{countLabel}</span>
          ) : (
            <span className="font-display text-3xl font-bold">{String(slot.index + 1).padStart(2, "0")}</span>
          )}
          <span className={cn("font-mono text-[10px] uppercase", slot.state === "recording" ? "text-destructive" : "text-muted-foreground")}>{slot.overdubbing ? "DUB" : slot.state === "armed" && looper.isWaitingForSignal ? "PLAY TO START" : labels[slot.state]}</span>
        </span>
      </Button>
      <div className="flex w-full max-w-72 flex-wrap items-center justify-center gap-1" aria-label={`Loop ${slot.index + 1} color`}>
        {TRACK_PALETTE.slice(slot.index % 3, slot.index % 3 + 6).map((color) => (
          <Button
            key={color.id}
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-7 rounded-full p-1", slot.color === color.value && "ring-2 ring-foreground/70")}
            onClick={() => looper.setColor(slot.index, color.value)}
            title={`${color.name} loop color`}
            aria-label={`${color.name} loop color`}
          >
            <span className="size-full rounded-full border border-foreground/20" style={{ backgroundColor: color.value }} />
          </Button>
        ))}
        <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-2" title="Custom loop color">
          <span className="size-4 rounded-full" style={{ backgroundColor: slot.color }} />
          <input className="absolute inset-0 cursor-pointer opacity-0" type="color" aria-label={`Custom color for loop ${slot.index + 1}`} onChange={(event) => looper.setColor(slot.index, event.target.value)} />
        </label>
      </div>
      <div className="flex w-full max-w-72 items-center gap-2 px-1">
        <Volume2 className="size-4 shrink-0 text-muted-foreground" />
        <Slider value={[slot.volume]} min={0} max={1.2} step={0.01} onValueChange={(v) => looper.setVolume(slot.index, v[0] ?? 0)} aria-label={`Loop ${slot.index + 1} volume`} />
        <MidiLearnButton id={`looper:${slot.index}`} param="volume" label={`Loop ${slot.index + 1} volume`} />
      </div>
      <div className="grid w-full max-w-72 grid-cols-3 items-center justify-center gap-1 [&>button]:w-full [&>button]:min-w-0 [&>button]:px-1">
        <Button size="sm" variant={slot.state === "armed" ? "default" : "secondary"} className="h-10 px-2 font-mono text-[10px]" disabled={slot.state !== "empty" && slot.state !== "armed"} aria-label={`${slot.state === "armed" ? "Disarm" : "Arm"} loop ${slot.index + 1}`} title="Arm: uses the pre-count / start-on-sound / next cycle" onClick={() => void looper.tap(slot.index).catch((error) => toast.error("Couldn't start the looper", { description: error instanceof Error ? error.message : undefined }))}>ARM</Button>
        <Button size="sm" variant={slot.state === "recording" ? "destructive" : "secondary"} className="h-10 px-2 font-mono text-[10px]" disabled={slot.state !== "empty" && !(slot.state === "recording" && slot.recEnd === null)} aria-label={`Record loop ${slot.index + 1}`} title="Record with the pre-count (1 bar if pre-count is Off). In Free mode tap again to close the loop." onClick={() => void (slot.state === "recording" ? looper.tap(slot.index) : looper.recordCounted(slot.index)).catch((error) => toast.error("Couldn't start the looper", { description: error instanceof Error ? error.message : undefined }))}><Circle className="size-3 fill-current text-destructive" /> REC</Button>
        <Button size="icon" variant="secondary" className="size-10" disabled={!slot.buffer} aria-label={`Loop ${slot.index + 1} ${slot.state === "playing" ? "stop" : "play"}`} title="Play / stop" onClick={() => slot.state === "playing" ? looper.stop(slot.index) : looper.play(slot.index)}>{slot.state === "playing" ? <Square className="size-4" /> : <Play className="size-4" />}</Button>
        <Button size="icon" variant="secondary" className="size-10" disabled={slot.state !== "playing" || slot.overdubbing || looper.source === "output"} aria-label={`Overdub loop ${slot.index + 1}`} title={looper.source === "output" ? "Overdub uses mic / interface only to prevent feedback" : "Overdub one cycle"} onClick={() => void looper.overdub(slot.index).catch((error) => toast.error("Overdub failed", { description: error instanceof Error ? error.message : undefined }))}><Circle className="size-4" /></Button>
        <Button size="icon" variant="secondary" className="size-10" disabled={!slot.buffer} aria-label={`${slot.muted ? "Unmute" : "Mute"} loop ${slot.index + 1}`} title={slot.muted ? "Unmute" : "Mute"} onClick={() => looper.toggleMute(slot.index)}>{slot.muted ? <VolumeX className="size-4 text-destructive" /> : <Volume2 className="size-4" />}</Button>
        <Button size="icon" variant="secondary" className="size-10" disabled={!slot.buffer || slot.overdubbing} aria-label={`${slot.reversed ? "Restore" : "Reverse"} loop ${slot.index + 1}`} title={slot.reversed ? "Restore direction" : "Reverse"} onClick={() => looper.toggleReverse(slot.index)}><RotateCcw className={cn("size-4", slot.reversed && "text-primary")} /></Button>
      </div>
      <div className="flex w-full max-w-72 gap-1">
        <Button variant="outline" className="h-10 flex-1" disabled={!slot.buffer} onClick={() => send(slot.index)} aria-label={`Send loop ${slot.index + 1} to timeline`}><ArrowDownToLine className="size-4" /> Timeline</Button>
        <Button variant="outline" size="icon" className="size-10" disabled={slot.state === "empty"} onClick={() => looper.clear(slot.index)} aria-label={`Clear loop ${slot.index + 1}`} title="Clear"><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}

/** Live input level against the threshold line while the looper listens. */
function ThresholdMeter() {
  const looper = getLooper();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { const id = window.setInterval(tick, 50); return () => window.clearInterval(id); }, []);
  const toPct = (lin: number) => Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(1e-5, lin)) + 60) / 60) * 100));
  const level = looper.isWaitingForSignal || looper.slots.some((x) => x.state === "recording") ? looper.inputPeak : 0;
  const th = looper.threshold ?? -60;
  return (
    <div className="flex w-40 flex-col gap-1">
      <div className="font-mono text-[10px] uppercase text-muted-foreground">{looper.isWaitingForSignal ? "Waiting for sound…" : "Input"}</div>
      <div className="relative h-3 overflow-hidden rounded-sm border border-border bg-surface-2" role="meter" aria-label="Looper input level" aria-valuenow={Math.round(toPct(level))}>
        <div className={cn("h-full", level >= Math.pow(10, th / 20) ? "bg-destructive" : "bg-primary")} style={{ width: `${toPct(level)}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${((th + 60) / 60) * 100}%` }} />
      </div>
    </div>
  );
}

export function LiveLooperView() {
  const skin = useSkin("looper");
  const drop = useImageDrop("looper");
  const { transport, addTrack, addClip } = useStudio();
  const looper = getLooper();
  // Controller pads: 0-7 toggle, 8-15 start, 16-23 stop, 24-31 record (per loop slot).
  const loopPads = useMidiPads("looper", 32, (p) => {
    const i = p % 8;
    const action = Math.floor(p / 8);
    const slot = looper.slots[i];
    if (!slot) return;
    const fail = (error: unknown) => toast.error("Couldn't start the looper", { description: error instanceof Error ? error.message : undefined });
    const busy = slot.state === "recording" || slot.state === "armed";
    if (action === 1) { if (busy) void looper.tap(i).catch(fail); else if (slot.buffer && slot.state !== "playing") looper.play(i); }
    else if (action === 2) { if (busy) void looper.tap(i).catch(fail); else if (slot.state === "playing") looper.stop(i); }
    else if (action === 3) { if (busy) void looper.tap(i).catch(fail); else void looper.recordCounted(i).catch(fail); }
    else if (slot.state === "playing") looper.stop(i);
    else if (busy) void looper.tap(i).catch(fail);
    else if (slot.buffer) looper.play(i);
    else void looper.recordCounted(i).catch(fail);
  });
  const LOOP_ACTIONS = ["Toggle", "Start", "Stop", "Record"];
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => looper.subscribe(rerender), [looper]);
  useEffect(() => { looper.bpm = transport.bpm; }, [looper, transport.bpm]);
  const locked = !looper.isEmpty;
  const capturing = looper.slots.some((slot) => slot.state === "armed" || slot.state === "recording");
  const send = async (i: number) => {
    const blob = looper.wav(i);
    if (!blob) return;
    try {
      const name = `LIVE LOOP ${i + 1}`;
      const res = await getEngine().loadSampleFile(blob, name);
      const trackId = addTrack("audio", name);
      addClip(trackId, { id: crypto.randomUUID(), name, peaks: res.peaks, duration: res.duration, url: res.url, start: transport.step, offset: 0, length: res.duration, gain: 1 });
      toast.success(`${name} added to the timeline`);
    } catch (error) { toast.error("Couldn't send the loop", { description: error instanceof Error ? error.message : undefined }); }
  };
  return (
    <div className="studio-wallpaper space-y-5 rounded-md p-3" data-studio-panel="looper" style={skinBackground(skin)} {...drop}>
      <SkinControls skinKey="looper" image />
      <MidiPadLearnBar pads={loopPads} label="loops" groupSize={8} groupLabels={LOOP_ACTIONS}
        names={(i) => `loop ${(i % 8) + 1} ${LOOP_ACTIONS[Math.floor(i / 8)].toLowerCase()}`} />
      <div className="flex flex-wrap items-end gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Timing</div>
          <div className="flex gap-1">
            <Button size="sm" variant={looper.mode === "sync" ? "default" : "secondary"} disabled={locked} onClick={() => looper.setMode("sync")}>Sync</Button>
            <Button size="sm" variant={looper.mode === "free" ? "default" : "secondary"} disabled={locked} onClick={() => looper.setMode("free")}>Free</Button>
          </div>
        </div>
        {looper.mode === "sync" && <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Record length
          <select aria-label="Record length in bars" value={looper.bars} disabled={locked} onChange={(e) => looper.setBars(Number(e.target.value))} className="h-9 rounded border border-border bg-surface-2 px-3 text-sm text-foreground disabled:opacity-50">
            {[1, 2, 4, 8, 16, 32].map((bar) => <option key={bar} value={bar}>{bar} {bar === 1 ? "bar" : "bars"}</option>)}
          </select>
        </label>}
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Pre-count
          <select aria-label="Looper pre-count" value={looper.precount} disabled={capturing} onChange={(e) => looper.setPrecount(Number(e.target.value))} className="h-9 rounded border border-border bg-surface-2 px-3 text-sm text-foreground disabled:opacity-50">
            {[0, 1, 2, 4].map((bar) => <option key={bar} value={bar}>{bar === 0 ? "Off" : `${bar} ${bar === 1 ? "bar" : "bars"}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Start on sound
          <select aria-label="Looper input threshold" value={looper.threshold === null ? "off" : String(looper.threshold)} disabled={capturing} onChange={(e) => looper.setThreshold(e.target.value === "off" ? null : Number(e.target.value))} className="h-9 rounded border border-border bg-surface-2 px-3 text-sm text-foreground disabled:opacity-50">
            <option value="off">Off</option>
            {[-50, -40, -30, -24, -18, -12, -6].map((db) => <option key={db} value={db}>Threshold {db} dB</option>)}
          </select>
        </label>
        {looper.threshold !== null && <ThresholdMeter />}
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Record from</div>
          <div className="flex gap-1">
            <Button size="sm" variant={looper.source === "mic" ? "default" : "secondary"} disabled={capturing} onClick={() => looper.setSource("mic")}><Mic className="size-4" /> Mic / interface</Button>
            <Button size="sm" variant={looper.source === "output" ? "default" : "secondary"} disabled={capturing} onClick={() => looper.setSource("output")}>App output</Button>
          </div>
        </div>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{looper.mode === "sync" ? `${looper.bars} ${looper.bars === 1 ? "BAR" : "BARS"} · ${transport.bpm} BPM` : "FREE LENGTH"}</span>
      </div>
      <div className="looper-pad-grid grid grid-cols-4 gap-x-2 gap-y-4">
        {looper.slots.map((slot) => <LoopDonut key={slot.index} slot={slot} send={send} />)}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={() => looper.playAll()}><Play className="size-4" /> Play all</Button>
        <Button variant="secondary" onClick={() => looper.stopAll()}><Square className="size-4" /> Stop all</Button>
        <Button variant="secondary" onClick={() => looper.clearAll()}><Trash2 className="size-4" /> Clear all</Button>
      </div>
       <p className="text-xs text-muted-foreground">Start on sound: tap a loop and it waits — recording begins the moment your input crosses the threshold (first loop only; it replaces the pre-count). The pre-count clicks before the first loop only and recording starts on GO; later loops wait for the next cycle instead. The first loop sets the shared cycle. Later recordings wait for the next cycle. Free length closes on a second tap; sync closes after the selected bars. Overdub adds one mic cycle. Loops play outside the song master effects to prevent app-output capture feeding back into itself. Loops remain in this session until cleared; send them to the timeline to include them in your project. Input delay depends on your browser and audio interface; use headphones when recording.</p>
    </div>
  );
}
