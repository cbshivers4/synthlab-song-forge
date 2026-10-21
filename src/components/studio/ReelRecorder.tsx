import { ReelInputChannels } from "./ReelInputChannels";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Circle, Download, Headphones, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { reelTapeProgress, reelTapeRadius } from "@/lib/synclab/reel-audio";
import { useStudio } from "@/lib/synclab/store";
import { encodeMp3, encodeWav, downloadBlob } from "@/lib/synclab/bounce";
import { encodeAiff, encodeFlac, encodeWavDepth } from "@/lib/synclab/export-formats";
import { getEngine } from "@/lib/synclab/audio-engine";
import { uid } from "@/lib/synclab/presets";
import { Knob } from "./Knob";
import { stepsPerBar, stepSeconds, STEPS_PER_BEAT } from "@/lib/synclab/timebase";

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
function Reel({ moving, right, fill = 0.5 }: { moving: boolean; right?: boolean; fill?: number }) {
  const radius = reelTapeRadius(fill);
  const id = right ? "r" : "l";
  return <div className="tape-reel" data-moving={moving} aria-label={`${right ? "Take-up" : "Supply"} reel ${moving ? "moving" : "stopped"}`}><svg viewBox="0 0 240 240" role="img" aria-label="Tape reel">
    <defs>
      <radialGradient id={`reel-metal-${id}`} cx="40%" cy="35%" r="75%"><stop offset="0" className="reel-stop-hi" /><stop offset="0.55" className="reel-stop-mid" /><stop offset="1" className="reel-stop-lo" /></radialGradient>
      <radialGradient id={`reel-tape-${id}`} cx="50%" cy="50%" r="50%"><stop offset="0.3" className="tape-stop-in" /><stop offset="1" className="tape-stop-out" /></radialGradient>
    </defs>
    <circle cx="120" cy="120" r="116" className="reel-shadow" />
    <circle cx="120" cy="120" r={radius} fill={`url(#reel-tape-${id})`} className="reel-tape" />
    {Array.from({ length: Math.max(0, Math.floor((radius - 40) / 5)) }, (_, i) => <circle key={i} cx="120" cy="120" r={40 + i * 5} className="reel-wind" />)}
    <g className="reel-flange">
      <path fill={`url(#reel-metal-${id})`} fillRule="evenodd" className="reel-rim" d={`M120 6a114 114 0 1 0 0.01 0Z ${[0, 120, 240].map((a) => { const r1 = 44, r2 = 100, s = 0.62; const p = (rr: number, ang: number) => `${120 + rr * Math.sin(ang)} ${120 - rr * Math.cos(ang)}`; const t = (a * Math.PI) / 180; return `M${p(r1, t - s * 0.9)} L${p(r2, t - s)} A${r2} ${r2} 0 0 1 ${p(r2, t + s)} L${p(r1, t + s * 0.9)} A${r1} ${r1} 0 0 0 ${p(r1, t - s * 0.9)}Z`; }).join(" ")}`} />
      {[0, 120, 240].map((a) => <circle key={a} cx={120 + 72 * Math.sin(((a + 60) * Math.PI) / 180)} cy={120 - 72 * Math.cos(((a + 60) * Math.PI) / 180)} r="3" className="reel-rivet" />)}
      <circle cx="120" cy="120" r="110" className="reel-edge" /><circle cx="120" cy="120" r="102" className="reel-edge thin" />
    </g>
    <circle cx="120" cy="120" r="37" fill={`url(#reel-metal-${id})`} className="reel-hub" /><circle cx="120" cy="120" r="14" className="reel-center" />
    {[0, 120, 240].map((a) => <rect key={a} x="117" y="98" width="6" height="10" rx="1" transform={`rotate(${a} 120 120)`} className="reel-key" />)}
    <path d="M40 60 A95 95 0 0 1 120 25" className="reel-glint" />
  </svg></div>;
}
function TapeMeter({ level, channel, clipped, reset }: { level: number; channel: string; clipped: boolean; reset: () => void }) {
  const db = level > 0 ? 20 * Math.log10(level) : -60;
  const angle = -55 + Math.max(0, Math.min(1, (db + 45) / 45)) * 110;
  const ticks = Array.from({ length: 23 }, (_, i) => -55 + i * 5);
  return <div className="tape-meter vu-real"><svg viewBox="0 0 220 116" role="meter" aria-label={`${channel} tape level`} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.max(-60, Math.round(db))}>
    <defs><radialGradient id={`vu-glow-${channel}`} cx="50%" cy="90%" r="90%"><stop offset="0" className="vu-glow-in" /><stop offset="1" className="vu-glow-out" /></radialGradient></defs>
    <rect width="220" height="116" fill={`url(#vu-glow-${channel})`} />
    {ticks.map((a, i) => <line key={a} x1="110" y1={i % 2 ? 30 : 26} x2="110" y2="36" transform={`rotate(${a} 110 106)`} className={a > 30 ? "vu-tick hot" : "vu-tick"} />)}
    <path d="M30 65 Q110 -12 190 65" className="vu-arc" /><path d="M150 24 Q180 36 196 70" className="vu-hot-band" /><path d="M155 29 Q177 39 190 65" className="vu-hot" />
    {[[-20, 33, 55], [-10, 66, 31], [-7, 97, 23], [-3, 133, 27], [0, 164, 42], [3, 190, 63]].map(([value, x, y]) => <text key={value} x={x} y={y} className="vu-number">{value}</text>)}
    <text x="110" y="72" className="vu-label">VU</text><text x="110" y="86" className="vu-sub">{channel}</text>
    <g transform={`rotate(${angle} 110 106)`} className="vu-needle-group"><path d="M112 108V27" className="vu-needle-shadow" /><path d="M110 106V24" className="vu-needle" /></g>
    <rect x="70" y="96" width="80" height="20" rx="2" className="vu-pivot-cover" /><circle cx="110" cy="106" r="5" className="reel-center" />
    <path d="M0 0H220V40Q110 20 0 46Z" className="vu-glass" />
  </svg><div className="flex items-center justify-between gap-2 px-2 pb-1 font-mono text-[10px]"><span>{level > 0 ? `${db.toFixed(1)} dBFS` : "−∞ dBFS"}</span><Button variant="ghost" className={`h-6 px-1 text-[10px] ${clipped ? "text-destructive" : ""}`} onClick={reset} aria-label={`Reset ${channel} tape clipping`}>{clipped ? "● CLIP" : "PEAK"}</Button></div></div>;
}
export function ReelRecorder() {
  const recorder = getReelRecorder();
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  const { addTrack, addClip, transport, setTransport, togglePlay, stop: stopSong, toggleRecord } = useStudio();
  const [deck, setDeck] = useState<"timeline" | "tape">("timeline");
  const [look, setLook] = useState<"reel" | "simple">("reel");
  const master = deck === "timeline";
  const fileInput = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState("wav24");
  const [quality, setQuality] = useState(320);
  const [saving, setSaving] = useState(false);
  useEffect(() => () => { void recorder.release(); }, [recorder]);
  useEffect(() => {
    recorder.setMasterMetering(master);
    return () => recorder.setMasterMetering(false);
  }, [recorder, master]);
  const rewinding = state.mode === "rewinding";
  const active = rewinding || state.mode === "recording" || state.mode === "playing" || (master && (transport.playing || transport.recording));
  const locked = state.busy || saving;
  const recording = state.mode === "recording";
  /** Tape progress 0..1: supply reel starts full and empties as the song/tape plays or records. */
  const progress = reelTapeProgress({ tapePosition: state.position, tapeDuration: state.duration, timelinePosition: transport.step * stepSeconds(transport.bpm), timelineDuration: transport.bars * stepsPerBar() * stepSeconds(transport.bpm), master, recording, tapeMoving: rewinding || state.mode === "playing" || state.mode === "paused" });
  const save = async (toProject: boolean) => {
    if (locked || recording || !state.hasTape) return;
    setSaving(true);
    try {
      const capture = await recorder.render(); const name = state.name.trim() || "SYNCLAB tape";
      if (toProject) {
        const audio = await getEngine().loadSampleFile(encodeWav(capture), name);
        const id = addTrack("audio", name, undefined, { keepPanel: true });
        addClip(id, { ...audio, id: uid(), name, start: transport.step, offset: 0, length: audio.duration }); toast.success("Tape added to project");
      } else {
        const blob = format === "mp3" ? encodeMp3(capture, quality) : format === "flac" ? encodeFlac(capture, 24) : format === "aiff" ? encodeAiff(capture, 24) : encodeWavDepth(capture, format === "wav16" ? 16 : format === "wav32" ? 32 : 24);
        const extension = format.startsWith("wav") ? "wav" : format;
        downloadBlob(blob, `${name.replace(/[\\/:*?"<>|]/g, "-")}.${extension}`); toast.success(`${extension.toUpperCase()} exported`);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save tape."); }
    finally { setSaving(false); }
  };
  const setTransportStart = () => setTransport({ step: 0 });
  const masterStop = async () => { if (state.mode === "recording" || state.mode === "playing") await recorder.stop(); stopSong(); };
  const masterPlay = () => { togglePlay(); };
  /** REC on the master deck prints the song output onto tape while the timeline plays (and records armed tracks). */
  const masterRecord = async () => {
    if (state.source !== "song") await recorder.setSource("song");
    await recorder.record();
    if (!transport.recording) toggleRecord();
    if (!transport.playing) togglePlay();
  };
  return <section className="reel-recorder mx-auto w-full max-w-[900px]" aria-label="Reel-to-reel recorder">
    <header className="tape-brand flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div><h2 className="font-display text-lg font-semibold">SYNCLAB <span className="text-primary">R2R</span></h2><p className="font-mono text-[10px] text-muted-foreground">STEREO TAPE RECORDER · DETROIT</p></div><span role="status" className={`font-mono text-xs ${recording ? "text-destructive" : "text-primary"}`}>{state.busy ? "PREPARING" : saving ? "SAVING" : recording ? "RECORDING" : master ? transport.playing ? "PLAYING" : "STOPPED" : state.mode.toUpperCase()}</span>
      <div className="flex gap-1" role="group" aria-label="Recorder look"><Button size="sm" variant={look === "reel" ? "default" : "outline"} aria-pressed={look === "reel"} onClick={() => setLook("reel")}>Reel-to-reel</Button><Button size="sm" variant={look === "simple" ? "default" : "outline"} aria-pressed={look === "simple"} onClick={() => { setLook("simple"); setDeck("tape"); }}>QuickTime style</Button></div></header>
    {look === "simple" ? <div className="flex flex-col items-center gap-4 border-t border-border bg-card px-4 py-6">
      <output aria-label="Recording time" className="font-mono text-4xl tabular-nums text-foreground">{clock(state.position)}</output>
      <div className="flex w-full max-w-md items-center gap-4">
        <button type="button" disabled={locked} aria-label={recording ? "Stop recording" : "Start recording"} onClick={() => void (recording ? recorder.stop() : recorder.record())} className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-muted-foreground/40 bg-background transition-transform active:scale-95 disabled:opacity-50">
          {recording ? <span className="size-6 rounded-sm bg-destructive" /> : <span className="size-11 rounded-full bg-destructive" />}
        </button>
        <div className="flex-1 space-y-1" aria-label="Input level">
          {[state.levelL, state.levelR].map((l, i) => <div key={i} className="h-2 overflow-hidden rounded bg-muted"><div className={`h-full ${state.clipped ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, Math.max(0, l * 100))}%` }} /></div>)}
        </div>
        <Button variant="outline" size="icon" className="size-11" disabled={locked || recording || !state.hasTape} aria-label={state.mode === "playing" ? "Pause" : "Play"} onClick={() => void recorder.play()}>{state.mode === "playing" ? <Pause /> : <Play />}</Button>
      </div>
      <label className="flex w-full max-w-md flex-col gap-1 text-xs text-muted-foreground">Record from<select value={state.source} disabled={locked || recording} onChange={(e) => void recorder.setSource(e.target.value as "input" | "song")} className="h-11 rounded border border-input bg-background px-2 text-foreground"><option value="input">Microphone / interface</option><option value="song">Song master</option></select></label>
      {!state.ready && <Button className="h-11" disabled={locked} onClick={() => void recorder.enable()}>{state.source === "input" ? "Enable microphone" : "Enable song input"}</Button>}
      {state.hasTape && !recording && <input className="w-full max-w-md accent-primary" type="range" min={0} max={state.duration || 1} step={0.01} value={state.position} disabled={locked} aria-label="Recording position" onChange={(e) => void recorder.seek(Number(e.target.value))} />}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </div> : <>

    <div className="tape-deck" data-moving={active} style={{ "--reel-time": rewinding ? "0.4s" : `${3 / state.speed}s` } as CSSProperties}><div className="tape-reels"><Reel moving={active} fill={1 - progress} /><Reel moving={active} right fill={progress} /></div>
      <svg className="tape-path" viewBox="0 0 600 80" aria-hidden="true"><path d="M88 5L176 60H424L512 5" /><circle cx="176" cy="60" r="13" /><circle cx="424" cy="60" r="13" /><rect x="267" y="41" width="66" height="24" rx="3" /><path d="M286 45V60M302 45V60M318 45V60" /></svg>
      <div className="tape-display flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-xs">{master || state.source === "song" ? "SONG MASTER" : "MIC / LINE"}</span><output aria-label="Tape counter" className="font-mono text-2xl text-primary">{clock(master ? transport.step * stepSeconds(transport.bpm) : state.position)}</output><span aria-label="Song position" className="font-mono text-xs text-muted-foreground">{master ? `BAR ${Math.floor(transport.step / stepsPerBar()) + 1} · BEAT ${Math.floor((transport.step % stepsPerBar()) / STEPS_PER_BEAT) + 1}${recording ? ` · TAPE ${clock(state.position)}` : ""}` : clock(state.duration)}</span></div>
    </div>
    <div className="tape-console"><div className="grid grid-cols-2 gap-3"><TapeMeter channel="L" level={state.levelL} clipped={state.clipped} reset={recorder.resetClip} /><TapeMeter channel="R" level={state.levelR} clipped={state.clipped} reset={recorder.resetClip} /></div>
      <div className="mt-3 flex gap-2" role="group" aria-label="Deck controls"><Button variant={master ? "default" : "outline"} className="h-10 flex-1 text-xs" aria-pressed={master} onClick={() => setDeck("timeline")}>Timeline master</Button><Button variant={!master ? "default" : "outline"} className="h-10 flex-1 text-xs" aria-pressed={!master} onClick={() => setDeck("tape")}>Tape only</Button></div>
      {master ? <div className="tape-buttons mt-3 grid grid-cols-5 gap-2">
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" disabled={transport.playing} onClick={() => setTransportStart()} aria-label="Return timeline to start"><SkipBack />REW</Button>
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" onClick={() => void masterStop()} aria-label="Stop timeline"><Square className="fill-current" />STOP</Button>
        <Button variant={transport.playing ? "default" : "outline"} className="h-14 flex-col gap-1 text-[10px]" onClick={masterPlay} aria-label={transport.playing ? "Pause timeline" : "Play timeline"}>{transport.playing ? <Pause /> : <Play />}{transport.playing ? "PAUSE" : "PLAY"}</Button>
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" disabled={transport.playing} onClick={() => setTransport({ step: transport.step + stepsPerBar() })} aria-label="Forward one bar"><SkipForward />FWD</Button>
        <Button variant={recording || transport.recording ? "destructive" : "outline"} className={`h-14 flex-col gap-1 border-destructive/50 text-[10px] ${recording || transport.recording ? "text-destructive-foreground" : "text-destructive"}`} disabled={locked || recording} onClick={() => void masterRecord()} aria-label="Record timeline to tape"><Circle className="fill-current" />REC</Button>
      </div> : <div className="tape-buttons mt-3 grid grid-cols-5 gap-2">
        <Button variant={rewinding ? "default" : "outline"} className="h-14 flex-col gap-1 text-[10px]" disabled={locked || recording || !state.hasTape || state.position <= 0} onClick={() => void recorder.rewind()} title="Rewind tape — plays the tape backward at high speed" aria-label="Rewind tape"><SkipBack />REW</Button>
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" disabled={locked} onClick={() => void recorder.stop()} aria-label="Stop tape"><Square className="fill-current" />STOP</Button>
        <Button variant={state.mode === "playing" ? "default" : "outline"} className="h-14 flex-col gap-1 text-[10px]" disabled={locked || recording || !state.hasTape} onClick={() => void recorder.play()} aria-label={state.mode === "playing" ? "Pause tape" : "Play tape"}>{state.mode === "playing" ? <Pause /> : <Play />}{state.mode === "playing" ? "PAUSE" : "PLAY"}</Button>
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" disabled={locked || recording || !state.hasTape} onClick={() => void recorder.seek(state.position + 10)} title="Forward ten seconds" aria-label="Forward tape ten seconds"><SkipForward />FWD</Button>
        <Button variant={recording ? "destructive" : "outline"} className={`h-14 flex-col gap-1 border-destructive/50 text-[10px] ${recording ? "text-destructive-foreground" : "text-destructive"}`} disabled={locked || recording} onClick={() => void recorder.record()} aria-label="Record tape"><Circle className="fill-current" />REC</Button>
      </div>}
      {master && <p className="mt-2 text-[11px] text-muted-foreground">PLAY/STOP drive the song transport. REC prints the song master to tape and starts timeline recording on armed tracks.</p>}
      <input className="mt-4 w-full accent-primary" type="range" min={0} max={state.duration || 1} step={0.01} value={state.position} disabled={locked || recording || !state.hasTape} aria-label="Tape position" onChange={(e) => void recorder.seek(Number(e.target.value))} />
      <div className="tape-knobs mt-4 grid grid-cols-3 justify-items-center gap-y-4 sm:grid-cols-5">
        <Knob label="Record gain" min={-24} max={24} step={0.5} value={state.inputGain} unit=" dB" onChange={(inputGain) => recorder.configure({ inputGain })} size={52} />
        <Knob label="Tone" min={-12} max={12} step={0.5} value={state.tone} unit=" dB" onChange={(tone) => recorder.configure({ tone })} size={52} />
        <Knob label="Saturation" value={state.drive} onChange={(drive) => recorder.configure({ drive })} size={52} />
        <Knob label="Playback level" min={-48} max={6} step={0.5} value={state.outputGain} unit=" dB" onChange={(outputGain) => recorder.configure({ outputGain })} size={52} />
        <Knob label="Tape speed" min={0.5} max={2} step={0.05} value={state.speed} unit="×" onChange={(speed) => recorder.configure({ speed })} size={52} />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="flex min-w-[160px] flex-1 basis-full flex-col gap-1 text-xs text-muted-foreground sm:basis-auto">Record source<select value={state.source} disabled={locked || recording} onChange={(e) => void recorder.setSource(e.target.value as "input" | "song")} className="h-11 rounded border border-input bg-background px-2 text-foreground"><option value="input">Microphone / interface</option><option value="song">Song master</option></select></label>
        <Button variant={state.ready ? "secondary" : "default"} className="h-11" disabled={locked || recording} onClick={() => void (state.ready ? recorder.release() : recorder.enable())}>{state.ready ? "Release input" : state.source === "input" ? "Enable microphone" : "Enable song input"}</Button>
        <Button variant={state.monitor ? "secondary" : "outline"} className="h-11" aria-pressed={state.monitor} disabled={state.source !== "input"} onClick={() => recorder.configure({ monitor: !state.monitor })}><Headphones />Monitor</Button>
        <Button variant={state.loop ? "secondary" : "outline"} className="h-11" aria-pressed={state.loop} onClick={() => recorder.configure({ loop: !state.loop })}><RotateCcw />Loop</Button>
      </div>
      {state.monitor && <p className="mt-2 text-xs text-amber">Use headphones to avoid microphone feedback.</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">Digital recording. Tape speed changes pitch and duration. Tone and saturation are printed into new recordings.</p>
      <ReelInputChannels />
      {state.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </div></>}
    <footer className="flex flex-wrap items-end gap-2 border-t border-border px-4 py-4">
      <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs text-muted-foreground">Tape name<input className="h-11 w-full rounded border border-input bg-background px-2 text-foreground" value={state.name} onChange={(e) => recorder.configure({ name: e.target.value })} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Export format<select className="h-11 rounded border border-input bg-background px-2 text-foreground" value={format} onChange={(e) => setFormat(e.target.value)}><option value="wav16">WAV · 16-bit</option><option value="wav24">WAV · 24-bit</option><option value="wav32">WAV · 32-bit float</option><option value="mp3">MP3</option><option value="flac">FLAC · 24-bit</option><option value="aiff">AIFF · 24-bit</option></select></label>
      {format === "mp3" && <label className="flex flex-col gap-1 text-xs text-muted-foreground">MP3 quality<select className="h-11 rounded border border-input bg-background px-2 text-foreground" value={quality} onChange={(e) => setQuality(Number(e.target.value))}>{[128, 192, 256, 320].map((k) => <option key={k} value={k}>{k} kbps</option>)}</select></label>}
      <Button variant="outline" className="h-11" disabled={locked || recording} onClick={() => fileInput.current?.click()}><Upload />Load audio</Button>
      <input ref={fileInput} hidden type="file" accept="audio/*,.wav,.mp3,.flac,.aiff,.aif,.m4a" onChange={(e) => { const file = e.target.files?.[0]; if (file) void recorder.load(file); e.target.value = ""; }} />
      <Button variant="outline" className="h-11" disabled={locked || recording || !state.hasTape} onClick={() => void save(false)}><Download />Save file</Button>
      <Button className="h-11" disabled={locked || recording || !state.hasTape} onClick={() => void save(true)}><Plus />Add to project</Button>
    </footer>
  </section>;
}