import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { toast } from "sonner";
import { Disc3, FolderOpen, Music2, Pause, Play, Circle, Square, Download, Trash2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { clock } from "@/lib/synclab/dj";
import { getLocalFile } from "@/lib/synclab/local-files";
import { renderSong } from "@/lib/synclab/song-render";
import { canShareFile, downloadBlob, encodeWav, shareFile } from "@/lib/synclab/bounce";
import { songSteps } from "@/lib/synclab/timebase";
import { useIsLandscapePhone } from "@/hooks/use-mobile";

/** Re-render on any deck/mixer change. */
function useDjVersion() {
  const dj = getDj();
  return useSyncExternalStore((fn) => dj.subscribe(fn), () => dj.version, () => 0);
}

/** 30 fps while anything plays; the moving waveforms and clocks read the decks directly. */
function useFrame(active: boolean, draw: () => void) {
  const ref = useRef(draw);
  ref.current = draw;
  // also redraw after every change (a track loaded, a cue set) while stopped
  useEffect(() => { ref.current(); });
  useEffect(() => {
    ref.current();
    if (!active) return;
    let raf = 0, last = 0;
    const loop = (t: number) => { if (t - last > 32) { last = t; ref.current(); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

const cssVar = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/** The decks' audio is created in the browser only, after the panel has mounted. */
export function DjDecks() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <DjDesk /> : null;
}

function DjDesk() {
  useDjVersion();
  const dj = getDj();
  const anyPlaying = dj.A.state.playing || dj.B.state.playing;
  const phone = useIsLandscapePhone();
  return (
    <section className="dj-device space-y-2 rounded-md border border-border p-2 sm:p-3" aria-label="DJ decks">
      {!phone && (
        <header className="flex flex-wrap items-center gap-2">
          <Disc3 className="size-5 text-primary" />
          <h2 className="dj-brand">SYNCLAB <b>DJ Decks</b></h2>
          <span className="text-[11px] text-muted-foreground">Load your music on two decks, beat-match with Sync, mix with EQ, filter and the crossfader, and record your set.</span>
        </header>
      )}
      <div className="dj-waves">
        <ScrollingWave id="A" active={anyPlaying} />
        <ScrollingWave id="B" active={anyPlaying} />
      </div>
      <div className="dj-console">
        <DeckPanel id="A" />
        <MixerPanel active={anyPlaying} />
        <DeckPanel id="B" />
      </div>
      {!phone && <RecordPanel />}
      <p className="dj-footnote text-[11px] text-muted-foreground">
        Pitch changes tempo and key together, like a turntable. Headphone cueing needs a second audio output, which browsers don't give a web page — everything plays through your main speakers.
      </p>
    </section>
  );
}

function ScrollingWave({ id, active }: { id: DeckId; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dj = getDj();
  const deck = dj.deck(id);
  useFrame(active, () => {
    const c = canvas.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const wave = deck.wave;
    const mid = h / 2;
    const low = cssVar(c, "--dj-low", "#e0413a"), md = cssVar(c, "--dj-mid", "#4ccf5a"), hi = cssVar(c, "--dj-high", "#3f8bff");
    const grid = cssVar(c, "--dj-grid", "rgba(255,255,255,.18)"), head = cssVar(c, "--playhead", "#fff");
    if (wave) {
      const pos = deck.position();
      const span = 8; // seconds shown
      const pxPerSec = w / span;
      const start = pos - span / 2;
      const scale = (v: number) => Math.min(mid, v * mid * 2.2);
      for (let x = 0; x < w; x++) {
        const col = Math.floor((start + x / pxPerSec) * wave.perSecond);
        if (col < 0 || col >= wave.peak.length) continue;
        const l = wave.low[col]!, m = wave.mid[col]!, hh = wave.high[col]!;
        g.fillStyle = low; const a = scale(l + m + hh); g.fillRect(x, mid - a, 1, a * 2);
        g.fillStyle = md; const b = scale(m + hh); g.fillRect(x, mid - b, 1, b * 2);
        g.fillStyle = hi; const d = scale(hh); g.fillRect(x, mid - d, 1, d * 2);
      }
      const bpm = deck.state.bpm;
      if (bpm > 0) {
        const beat = 60 / bpm;
        const first = deck.state.firstBeat;
        let n = Math.ceil((start - first) / beat);
        for (let t = first + n * beat; t < start + span; t += beat, n++) {
          const x = (t - start) * pxPerSec;
          g.fillStyle = grid;
          g.fillRect(Math.round(x), n % 4 === 0 ? 0 : h * 0.72, n % 4 === 0 ? 2 : 1, n % 4 === 0 ? h : h * 0.28);
        }
      }
      const loop = deck.state.loop;
      if (loop) {
        g.fillStyle = cssVar(c, "--dj-loop", "rgba(255,200,0,.18)");
        g.fillRect((loop.start - start) * pxPerSec, 0, (loop.end - loop.start) * pxPerSec, h);
      }
      deck.state.hotCues.forEach((cue, i) => {
        if (cue == null) return;
        const x = (cue - start) * pxPerSec;
        if (x < 0 || x > w) return;
        g.fillStyle = cssVar(c, `--dj-cue-${i + 1}`, "#f5a623");
        g.fillRect(x, 0, 2, h);
      });
    }
    g.fillStyle = head;
    g.fillRect(Math.round(w / 2) - 1, 0, 2, h);
  });
  return (
    <div className="dj-wave" data-deck={id}>
      <span className="dj-wave-tag">{id}</span>
      <canvas ref={canvas} className="dj-wave-canvas" aria-label={`Deck ${id} waveform`} />
    </div>
  );
}

function Overview({ id }: { id: DeckId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const deck = getDj().deck(id);
  useFrame(deck.state.playing, () => {
    const c = canvas.current;
    const ov = deck.overview;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);
    if (!ov || !deck.buffer) return;
    const played = deck.position() / deck.buffer.duration;
    const fg = cssVar(c, "--dj-overview", "#8fd6e0"), dim = cssVar(c, "--dj-overview-played", "rgba(143,214,224,.35)");
    for (let x = 0; x < w; x++) {
      const v = ov[Math.floor((x / w) * ov.length)] ?? 0;
      const a = Math.max(1, v * h * 0.95);
      g.fillStyle = x / w < played ? dim : fg;
      g.fillRect(x, (h - a) / 2, 1, a);
    }
    deck.state.hotCues.forEach((cue, i) => { if (cue != null) { g.fillStyle = cssVar(c, `--dj-cue-${i + 1}`, "#f5a623"); g.fillRect((cue / deck.buffer!.duration) * w, 0, 2, h); } });
    g.fillStyle = cssVar(c, "--playhead", "#fff");
    g.fillRect(played * w - 1, 0, 2, h);
  });
  const seek = (e: React.PointerEvent) => {
    if (!deck.buffer || !canvas.current) return;
    const r = canvasRect(canvas.current);
    const p = canvasPoint(e.clientX, e.clientY);
    deck.seek(((p.x - r.left) / Math.max(1, r.width)) * deck.buffer.duration);
  };
  return <canvas ref={canvas} className="dj-overview" onPointerDown={seek} aria-label={`Deck ${id} track overview — tap to jump`} />;
}

function DeckPanel({ id }: { id: DeckId }) {
  const dj = getDj();
  const deck = dj.deck(id);
  const s = deck.state;
  const { tracks, transport, buses, vcas, auxReturns, fxChains } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { if (!s.playing) return; const t = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(t); }, [s.playing]);
  const unlock = () => { void getEngine().init().resume?.(); };

  const loadFile = async (file: File) => { unlock(); await deck.load(file, file.name.replace(/\.[^.]+$/, "")); if (deck.state.error) toast.error(deck.state.error); };
  const loadSong = async () => {
    unlock();
    const steps = songSteps(transport.bars);
    const id0 = toast.loading("Rendering your song for the deck…");
    try {
      const cap = await renderSong({ tracks, transport, buses, vcas, auxReturns, fxChains, startStep: 0, lengthSteps: steps, tail: 2, sampleRate: 44100 });
      if (!cap) throw new Error("This browser can't render the song offline.");
      await deck.load(encodeWav(cap, 2), "This song");
      toast.success("Your song is on deck " + id, { id: id0 });
    } catch (e) { toast.error("Couldn't load the song", { id: id0, description: (e as Error).message }); }
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { void loadFile(file); return; }
    try {
      const raw = e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain");
      const v = JSON.parse(raw) as { type?: string; id?: string };
      const local = v?.type === "localfile" && v.id ? getLocalFile(v.id) : null;
      if (local) void loadFile(local.file);
    } catch { /* not a file */ }
  };
  const pos = deck.position();
  const pct = (s.pitch * 100).toFixed(1);
  const syncNow = () => { if (!deck.sync(dj.other(id))) toast("Load both decks first", { description: "Sync matches this deck's tempo and beats to the other deck." }); };

  return (
    <div className={`dj-deck${over ? " is-over" : ""}`} data-deck={id} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <div className="dj-deck-head">
        <span className="dj-deck-letter">{id}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={s.name ?? undefined}>{s.loading ? "Loading…" : s.name ?? "Drop a track here"}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{s.name ? `${clock(pos)} / -${clock(s.duration - pos)}` : "MP3 · WAV · AAC · FLAC"}</p>
        </div>
        <div className="dj-bpm" title="Detected tempo × pitch">
          <b>{s.bpm ? (s.bpm * (1 + s.pitch)).toFixed(1) : "—"}</b>
          <span>{s.pitch >= 0 ? "+" : ""}{pct}%</span>
        </div>
      </div>
      <Overview id={id} />
      <div className="dj-deck-body">
        <div className="dj-deck-controls">
          <div className="dj-row">
            <Button variant="secondary" className="dj-btn" onClick={() => fileRef.current?.click()} aria-label={`Load a track on deck ${id}`}><FolderOpen className="size-4" /><span className="dj-btn-text">Load</span></Button>
            <Button variant="secondary" className="dj-btn" onClick={() => void loadSong()} aria-label={`Put this song on deck ${id}`} title="Render the song you're making and put it on this deck"><Music2 className="size-4" /><span className="dj-btn-text">This song</span></Button>
            {s.bpm > 0 && (
              <>
                <Button variant="ghost" className="dj-btn dj-halve" onClick={() => deck.setBpm(s.bpm / 2)} title="Detected tempo is double — halve it">½</Button>
                <Button variant="ghost" className="dj-btn dj-halve" onClick={() => deck.setBpm(s.bpm * 2)} title="Detected tempo is half — double it">×2</Button>
              </>
            )}
          </div>
          <div className="dj-row">
            <Button className="dj-btn dj-cue" variant="outline" disabled={!s.name} onClick={() => { unlock(); deck.cue(); }} title="Stopped: set the cue here. Playing: back to the cue">CUE</Button>
            <Button className="dj-btn dj-play" disabled={!s.name || s.loading} aria-pressed={s.playing} onClick={() => { unlock(); deck.toggle(); }}>
              {s.playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
            </Button>
            <Button className="dj-btn dj-sync" variant="outline" disabled={!s.name} onClick={syncNow}><RefreshCcw className="size-4" />SYNC</Button>
          </div>
          <div className="dj-row" aria-label="Hot cues">
            {s.hotCues.map((cue, i) => (
              <span key={i} className="dj-hotcue-wrap">
                <button type="button" className={`dj-hotcue${cue != null ? " is-set" : ""}`} data-cue={i + 1} disabled={!s.name} onClick={() => { unlock(); deck.hotCue(i); }}
                  title={cue != null ? `Jump to hot cue ${i + 1}` : `Set hot cue ${i + 1} here`}>{i + 1}</button>
                {cue != null && <button type="button" className="dj-hotcue-clear" aria-label={`Clear hot cue ${i + 1}`} onClick={() => deck.clearHotCue(i)}>×</button>}
              </span>
            ))}
          </div>
          <div className="dj-row" aria-label="Loops">
            <span className="dj-label">LOOP</span>
            {[1, 2, 4, 8, 16].map((b) => (
              <button key={b} type="button" className={`dj-loop${s.loop?.beats === b ? " is-on" : ""}`} disabled={!s.name} onClick={() => deck.loop(b)} aria-pressed={s.loop?.beats === b}>{b}</button>
            ))}
            {s.loop && <button type="button" className="dj-loop is-exit" onClick={() => deck.exitLoop()}>EXIT</button>}
          </div>
        </div>
        <div className="dj-pitch">
          <span className="dj-label">PITCH</span>
          <Slider orientation="vertical" className="dj-vfader" min={-s.range} max={s.range} step={0.001} value={[s.pitch]} onValueChange={([v = 0]) => deck.setPitch(v)} aria-label={`Deck ${id} pitch`} />
          <div className="flex gap-1">
            <button type="button" className="dj-nudge" aria-label="Nudge slower" onPointerDown={() => deck.setNudge(-0.04)} onPointerUp={() => deck.setNudge(0)} onPointerLeave={() => deck.setNudge(0)} onPointerCancel={() => deck.setNudge(0)}>−</button>
            <button type="button" className="dj-nudge" aria-label="Nudge faster" onPointerDown={() => deck.setNudge(0.04)} onPointerUp={() => deck.setNudge(0)} onPointerLeave={() => deck.setNudge(0)} onPointerCancel={() => deck.setNudge(0)}>+</button>
          </div>
          <div className="dj-pitch-opts">
            <button type="button" className="dj-range" onClick={() => deck.setRange(s.range === 0.08 ? 0.16 : s.range === 0.16 ? 0.5 : 0.08)} title="Pitch range">±{Math.round(s.range * 100)}%</button>
            <button type="button" className="dj-range" onClick={() => deck.setPitch(0)} title="Reset pitch to 0">0</button>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.aif,.aiff,.m4a,.aac,.ogg,.flac" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
    </div>
  );
}

function MixerPanel({ active }: { active: boolean }) {
  const dj = getDj();
  const meters = useRef<Record<string, HTMLSpanElement | null>>({});
  const data = useRef(new Float32Array(1024));
  useFrame(active, () => {
    const set = (k: string, v: number) => { const el = meters.current[k]; if (el) el.style.setProperty("--dj-meter", String(Math.min(1, Math.max(0, (20 * Math.log10(Math.max(1e-5, v)) + 48) / 54)))); };
    set("A", dj.A.level(data.current)); set("B", dj.B.level(data.current));
    dj.masterMeter.getFloatTimeDomainData(data.current);
    let p = 0; for (const v of data.current) p = Math.max(p, Math.abs(v));
    set("M", p);
  });
  const phone = useIsLandscapePhone();
  const knobs = (id: DeckId) => {
    const deck = dj.deck(id);
    const s = deck.state;
    const k = phone ? { size: 26, className: "dj-knob" } : { size: 34 };
    return (
      <>
        <Knob label="GAIN" value={s.gain} min={0} max={2} onChange={(v) => deck.setGain(v)} defaultValue={1} {...k} format={(v) => `${(20 * Math.log10(Math.max(0.01, v))).toFixed(1)}dB`} ariaLabel={`Deck ${id} gain`} />
        <Knob label="HI" value={s.eq.high} onChange={(v) => deck.setEq("high", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} high EQ`} />
        <Knob label="MID" value={s.eq.mid} onChange={(v) => deck.setEq("mid", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} mid EQ`} />
        <Knob label="LOW" value={s.eq.low} onChange={(v) => deck.setEq("low", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} low EQ`} />
        <Knob label={phone ? "FILT" : "FILTER"} value={s.filter} onChange={(v) => deck.setFilter(v)} defaultValue={0.5} {...k} format={(v) => (Math.abs(v - 0.5) < 0.03 ? "OFF" : v < 0.5 ? "LP" : "HP")} ariaLabel={`Deck ${id} filter`} />
      </>
    );
  };
  const fader = (id: DeckId) => (
    <div className="dj-fader-row">
      <span className="dj-meter" ref={(el) => { meters.current[id] = el; }} aria-hidden />
      <Slider orientation="vertical" className="dj-vfader" min={0} max={1} step={0.01} value={[dj.deck(id).state.fader]} onValueChange={([v = 0]) => dj.deck(id).setFader(v)} aria-label={`Deck ${id} volume`} />
    </div>
  );
  const xfader = (
    <div className="dj-xfader">
      <span className="dj-label">A</span>
      <Slider min={-1} max={1} step={0.01} value={[dj.state.crossfader]} onValueChange={([v = 0]) => dj.setCrossfader(v)} aria-label="Crossfader" className="dj-xfader-slider" />
      <span className="dj-label">B</span>
      <button type="button" className="dj-range" onClick={() => dj.setCrossfader(0)} title="Centre the crossfader">◆</button>
    </div>
  );
  if (phone) {
    return (
      <div className="dj-mixer is-phone">
        <div className="dj-knob-row" data-deck="A">{knobs("A")}</div>
        <div className="dj-knob-row" data-deck="B">{knobs("B")}</div>
        <div className="dj-phone-faders">
          {fader("A")}
          <div className="flex flex-col items-center gap-1">
            <Knob label="MASTER" value={dj.state.master} min={0} max={1.2} onChange={(v) => dj.setMaster(v)} defaultValue={0.9} size={26} className="dj-knob" format={(v) => `${Math.round(v * 100)}%`} />
            <span className="dj-meter is-master" ref={(el) => { meters.current["M"] = el; }} aria-hidden />
          </div>
          {fader("B")}
        </div>
        {xfader}
        <RecordPanel />
      </div>
    );
  }
  const channel = (id: DeckId) => {
    return (
      <div className="dj-channel" data-deck={id}>
        <span className="dj-label">{id}</span>
        {knobs(id)}
        {fader(id)}
      </div>
    );
  };
  return (
    <div className="dj-mixer">
      <div className="dj-mixer-channels">
        {channel("A")}
        <div className="dj-channel is-master">
          <span className="dj-label">MASTER</span>
          <Knob label="LEVEL" value={dj.state.master} min={0} max={1.2} onChange={(v) => dj.setMaster(v)} defaultValue={0.9} size={34} format={(v) => `${Math.round(v * 100)}%`} />
          <span className="dj-meter is-master" ref={(el) => { meters.current["M"] = el; }} aria-hidden />
        </div>
        {channel("B")}
      </div>
      {xfader}
    </div>
  );
}
const eqLabel = (v: number) => (v <= 0.02 ? "KILL" : `${v >= 0.5 ? "+" : ""}${((v - 0.5) * (v >= 0.5 ? 12 : 52)).toFixed(0)}`);

function RecordPanel() {
  const dj = getDj();
  const m = dj.state;
  const [busy, setBusy] = useState<string | null>(null);
  const name = `SYNCLAB DJ mix ${new Date().toISOString().slice(0, 10)}`;
  const save = async (kind: "wav" | "mp3") => {
    setBusy(kind === "mp3" ? "Encoding MP3…" : "Preparing WAV…");
    try {
      const blob = kind === "wav" ? dj.wav() : await dj.mp3((f) => setBusy(`Encoding MP3… ${Math.round(f * 100)}%`));
      const filename = `${name}.${kind}`;
      const file = new File([blob], filename, { type: blob.type });
      if (canShareFile(file)) {
        try { await shareFile(file, filename); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
      }
      downloadBlob(blob, filename);
      toast.success(`Mix saved as ${kind.toUpperCase()}`, { description: filename });
    } catch (e) { toast.error("Couldn't save the mix", { description: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const rec = async () => {
    try { if (m.recording) dj.stopRecording(); else { void getEngine().init().resume?.(); await dj.startRecording(); } }
    catch (e) { toast.error("Recording unavailable", { description: (e as Error).message }); }
  };
  return (
    <div className="dj-rec">
      <Button className={`dj-btn ${m.recording ? "dj-rec-on" : ""}`} variant={m.recording ? "destructive" : "secondary"} onClick={() => void rec()} aria-pressed={m.recording} aria-label={m.recording ? "Stop recording" : "Record mix"}>
        {m.recording ? <Square className="size-4 fill-current" /> : <Circle className="size-4 fill-current text-destructive" />}<span className="dj-btn-text">{m.recording ? "Stop recording" : "Record mix"}</span>
      </Button>
      <span className="dj-rec-status font-mono text-xs" style={{ "--rec": m.recording ? "1" : "0" } as CSSProperties}>
        {m.recording ? `● REC ${clock(m.recSeconds)} / ${Math.round(m.recLimit / 60)}:00` : m.hasMix ? `Recorded ${clock(m.recSeconds)}` : <span className="dj-btn-text">Records exactly what the decks play</span>}
      </span>
      {m.hasMix && !m.recording && (
        <>
          <Button className="dj-btn" variant="outline" disabled={!!busy} onClick={() => void save("mp3")} aria-label="Save the mix as MP3"><Download className="size-4" />MP3</Button>
          <Button className="dj-btn" variant="outline" disabled={!!busy} onClick={() => void save("wav")} aria-label="Save the mix as WAV"><Download className="size-4" />WAV</Button>
          <Button className="dj-btn" variant="ghost" disabled={!!busy} onClick={() => dj.discardRecording()} aria-label="Discard recording"><Trash2 className="size-4" /></Button>
        </>
      )}
      {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
    </div>
  );
}
