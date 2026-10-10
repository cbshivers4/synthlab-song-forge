import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Circle, Download, Headphones, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { useStudio } from "@/lib/synclab/store";
import { encodeMp3, encodeWav, downloadBlob } from "@/lib/synclab/bounce";
import { encodeAiff, encodeFlac, encodeWavDepth } from "@/lib/synclab/export-formats";
import { getEngine } from "@/lib/synclab/audio-engine";
import { uid } from "@/lib/synclab/presets";
import { Knob } from "./Knob";
import { stepsPerBar, stepSeconds, STEPS_PER_BEAT } from "@/lib/synclab/timebase";

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
function Reel({ moving, right }: { moving: boolean; right?: boolean }) {
  return <div className="tape-reel" data-moving={moving} aria-label={`${right ? "Take-up" : "Supply"} reel ${moving ? "moving" : "stopped"}`}><svg viewBox="0 0 240 240" role="img" aria-label="Tape reel">
    <circle cx="120" cy="120" r="114" className="reel-rim" /><circle cx="120" cy="120" r={right ? 79 : 90} className="reel-tape" />
    {[0, 120, 240].map((angle) => <g key={angle} transform={`rotate(${angle} 120 120)`}><path d="M102 101 L77 33 Q120 11 163 33 L138 101Z" className="reel-spoke" /><path d="M109 73 L99 40 Q120 30 141 40 L131 73Z" className="reel-cutout" /></g>)}
    <circle cx="120" cy="120" r="37" className="reel-hub" /><circle cx="120" cy="120" r="21" className="reel-center" /><path d="M120 106V134M106 120H134" className="reel-screw" /><circle cx="120" cy="120" r="110" className="reel-edge" />
  </svg></div>;
}
function TapeMeter({ level, channel, clipped, reset }: { level: number; channel: string; clipped: boolean; reset: () => void }) {
  const db = level > 0 ? 20 * Math.log10(level) : -60;
  const angle = -55 + Math.max(0, Math.min(1, (db + 45) / 45)) * 110;
  const color = db >= -1 ? "var(--tape-red)" : db >= -6 ? "var(--tape-orange)" : "var(--tape-green)";
  return <div className="tape-meter"><svg viewBox="0 0 220 116" role="meter" aria-label={`${channel} tape level`} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.max(-60, Math.round(db))}>
    <path d="M30 65 Q110 -12 190 65" className="vu-arc" /><path d="M155 29 Q177 39 190 65" className="vu-hot" />
    {[[-20, 33, 55], [-10, 66, 31], [-7, 97, 23], [-3, 133, 27], [0, 164, 42], [3, 190, 63]].map(([value, x, y]) => <text key={value} x={x} y={y} className="vu-number">{value}</text>)}
    <text x="110" y="72" className="vu-label">VU · {channel}</text><g transform={`rotate(${angle} 110 106)`}><path d="M110 106V25" className="vu-needle" style={{ stroke: color }} /><circle cx="110" cy="106" r="6" className="reel-center" /></g>
  </svg><div className="flex items-center justify-between gap-2 px-2 pb-1 font-mono text-[10px]"><span>{level > 0 ? `${db.toFixed(1)} dBFS` : "−∞ dBFS"}</span><Button variant="ghost" className="h-6 px-1 text-[10px]" onClick={reset} aria-label={`Reset ${channel} tape clipping`}>{clipped ? "CLIP" : "PEAK"}</Button></div></div>;
}
export function ReelRecorder() {
  const recorder = getReelRecorder();
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  const { addTrack, addClip, transport, setTransport, togglePlay, stop: stopSong, toggleRecord } = useStudio();
  const [deck, setDeck] = useState<"timeline" | "tape">("timeline");
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
  const active = state.mode === "recording" || state.mode === "playing" || (master && (transport.playing || transport.recording));
  const locked = state.busy || saving;
  const recording = state.mode === "recording";
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
    <header className="tape-brand flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div><h2 className="font-display text-lg font-semibold">SYNCLAB <span className="text-primary">R2R</span></h2><p className="font-mono text-[10px] text-muted-foreground">STEREO TAPE RECORDER · DETROIT</p></div><span role="status" className={`font-mono text-xs ${recording ? "text-destructive" : "text-primary"}`}>{state.busy ? "PREPARING" : saving ? "SAVING" : recording ? "RECORDING" : master ? transport.playing ? "PLAYING" : "STOPPED" : state.mode.toUpperCase()}</span></header>
    <div className="tape-deck" data-moving={active} style={{ "--reel-time": `${3 / state.speed}s` } as CSSProperties}><div className="tape-reels"><Reel moving={active} /><Reel moving={active} right /></div>
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
        <Button variant="outline" className="h-14 flex-col gap-1 text-[10px]" disabled={locked || recording || !state.hasTape} onClick={() => void recorder.seek(0)} title="Rewind to start" aria-label="Rewind tape"><SkipBack />REW</Button>
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
      {state.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </div>
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