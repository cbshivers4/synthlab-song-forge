import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Disc3, FolderOpen, SkipBack, Headphones, ListMusic, Music2, Pause, Play, Circle, Square, Download, Trash2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { clock, djSilenceReason, scrubTo } from "@/lib/synclab/dj";
import { getLocalFile } from "@/lib/synclab/local-files";
import { renderSong } from "@/lib/synclab/song-render";
import { canShareFile, downloadBlob, encodeWav, shareFile } from "@/lib/synclab/bounce";
import { songSteps } from "@/lib/synclab/timebase";
import { useIsLandscapePhone } from "@/hooks/use-mobile";
import { DJ_TRACK_DRAG, DjPlaylist, loadPlaylistTrack } from "./DjPlaylist";
import { Turntable } from "./DjTurntable";
import { PhonesPanel, PhonesSheet, togglePhonesCue } from "./DjPhones";
import { useFrame } from "./dj-frame";

/** Re-render on any deck/mixer change. */
function useDjVersion() {
  const dj = getDj();
  return useSyncExternalStore((fn) => dj.subscribe(fn), () => dj.version, () => 0);
}

/**
 * Sideways phone: the playlist / headphone pages cover the visible panel area (not the top of the
 * tall, scrolled desk) so their header buttons are always on screen. Falls back to in-place render.
 */
function PhoneSheet({ anchor, children }: { anchor: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setHost(anchor.current?.closest<HTMLElement>(".phone-pages") ?? null); }, [anchor]);
  if (!host) return <>{children}</>;
  return createPortal(<div className="dj-device dj-sheet-host">{children}</div>, host);
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
  const [listOpen, setListOpen] = useState(false);
  const [phonesOpen, setPhonesOpen] = useState(false);
  const deskRef = useRef<HTMLElement>(null);
  return (
    <section ref={deskRef} className="dj-device relative space-y-2 rounded-md border border-border p-2 sm:p-3" aria-label="DJ decks">
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
        <MixerPanel active={anyPlaying} onPlaylist={() => setListOpen(true)} onPhones={() => setPhonesOpen(true)} />
        <DeckPanel id="B" />
      </div>
      {!phone && <RecordPanel />}
      {!phone && <DjPlaylist />}
      {phone && listOpen && <PhoneSheet anchor={deskRef}><DjPlaylist sheet onClose={() => setListOpen(false)} /></PhoneSheet>}
      {phone && phonesOpen && <PhoneSheet anchor={deskRef}><PhonesSheet onClose={() => setPhonesOpen(false)} /></PhoneSheet>}
      <p className="dj-footnote text-[11px] text-muted-foreground">
        Press a channel's orange CUE to hear that deck in your headphones before the crowd does (even with its fader down). MONO SPLIT works with headphones on one output: cue in the left ear, master in the right. 2ND OUT sends the headphones to USB headphones or a DJ interface while the speakers keep the master (Chrome or Edge on a computer). Pitch and 45 RPM change tempo and key together, like a turntable.
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
  // drag the waveform like a record: right winds back (a quick swipe goes further), left moves ahead
  const drag = useRef<{ id: number; x: number; t: number } | null>(null);
  const SPAN = 8;
  const onDown = (e: React.PointerEvent) => {
    if (!deck.buffer || (e.pointerType === "mouse" && e.button !== 0)) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    void getEngine().init().resume?.();
    drag.current = { id: e.pointerId, x: canvasPoint(e.clientX, e.clientY).x, t: e.timeStamp };
    deck.grab();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !deck.buffer || !canvas.current) return;
    const x = canvasPoint(e.clientX, e.clientY).x;
    const pxPerSec = Math.max(1, canvasRect(canvas.current).width) / SPAN;
    const dt = Math.max(0.001, (e.timeStamp - d.t) / 1000);
    const delta = -(x - d.x) / pxPerSec;
    d.x = x; d.t = e.timeStamp;
    if (delta) deck.dragTo(scrubTo(deck.position(), delta, dt, deck.buffer.duration));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    deck.release();
  };
  return (
    <div className="dj-wave" data-deck={id} data-grab={deck.state.name ? "1" : "0"} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      title={deck.state.name ? "Drag the waveform: right winds back toward the start, left moves ahead" : undefined}>
      <span className="dj-wave-tag">{id}</span>
      <canvas ref={canvas} className="dj-wave-canvas" aria-label={`Deck ${id} waveform — drag to move through the track`} />
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
      let peak = 0;
      for (let i = 0; i < cap.left.length; i += 4) peak = Math.max(peak, Math.abs(cap.left[i]!), Math.abs(cap.right[i]!));
      if (peak < 1e-4) throw new Error("Your song is silent so far — add some notes, drums or audio to the timeline first, or load a music file with the folder button.");
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
      if (v?.type === DJ_TRACK_DRAG && v.id) { void loadPlaylistTrack(id, v.id); return; }
      const local = v?.type === "localfile" && v.id ? getLocalFile(v.id) : null;
      if (local) void loadFile(local.file);
    } catch { /* not a file */ }
  };
  const pos = deck.position();
  const pct = (s.pitch * 100).toFixed(1);
  const phone = useIsLandscapePhone();
  const loadRow = (
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
  );
  /** Wake the phone's sound inside a tap; if its clock is stuck (common after headphones/Bluetooth change), stop and restart it. */
  const wakeSound = async () => {
    const ctx = getEngine().init();
    try { await ctx.resume(); } catch { /* reported below */ }
    const t0 = ctx.currentTime;
    await new Promise((r) => setTimeout(r, 300));
    if (ctx.state !== "running" || ctx.currentTime - t0 < 0.1) {
      try { await ctx.suspend(); await ctx.resume(); } catch { /* reported below */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (ctx.state === "running") toast.success("Sound is on", { description: `Deck ${id} should be playing now.` });
    else toast.error("The phone still won't start the sound", { description: "Close other apps that play sound or use the microphone, check the phone isn't on silent, then reload SYNCLAB." });
  };
  /** Shortly after Play, check the music really reaches the speakers and say exactly what's blocking it if not. */
  const checkSound = (clock0: number) => {
    window.setTimeout(() => {
      if (!deck.state.playing) return;
      const ctx = dj.ctx;
      const moving = ctx.currentTime - clock0 > 0.3;
      const [ml, mr] = dj.masterMeter.levels();
      const peak = Math.max(ml, mr);
      const st = deck.state;
      const reason = djSilenceReason({ deck: id, gain: st.gain, fader: st.fader, filter: st.filter, eq: st.eq, crossfader: dj.state.crossfader, master: dj.state.master });
      let outcome = "ok";
      if (ctx.state !== "running" || !moving) {
        outcome = ctx.state !== "running" ? `ctx_${ctx.state}` : "clock_stuck";
        toast.error("Your phone hasn't started the sound", { description: "The deck is ready but the phone is holding the sound back. Tap Turn sound on.", duration: 12000, action: { label: "Turn sound on", onClick: () => void wakeSound() } });
      } else if (reason) {
        outcome = "controls";
        toast.error(reason, { description: `That's why deck ${id} is silent.`, duration: 12000, action: { label: "Fix it", onClick: () => {
          if (st.gain < 0.05) deck.setGain(1);
          if (st.fader < 0.05) deck.setFader(0.85);
          if (st.eq.high <= 0.02 && st.eq.mid <= 0.02 && st.eq.low <= 0.02) { deck.setEq("high", 0.5); deck.setEq("mid", 0.5); deck.setEq("low", 0.5); }
          deck.setFilter(0.5);
          if (dj.state.master < 0.05) dj.setMaster(0.9);
          if (djSilenceReason({ deck: id, gain: deck.state.gain, fader: deck.state.fader, filter: deck.state.filter, eq: deck.state.eq, crossfader: dj.state.crossfader, master: dj.state.master })) dj.setCrossfader(0);
        } } });
      } else if (peak < 1e-4) {
        outcome = "silent_audio";
        toast(`Deck ${id} is playing, but this part of the track is silent`, { description: "Some files start with silence. Drag the waveform or the needle further into the song." });
      }
      window.__lovableEvents?.track?.("project.dj_play_check", { outcome, ctx_state: ctx.state, clock_moving: moving, master_db: peak > 0 ? Math.round(20 * Math.log10(peak)) : -120, sideways_layout: phone });
    }, 900);
  };
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
          <b>{s.bpm ? deck.effectiveBpm.toFixed(1) : "—"}</b>
          <span>{s.pitch >= 0 ? "+" : ""}{pct}%</span>
        </div>
      </div>
      <Overview id={id} />
      <div className="dj-deck-body">
        {phone ? <div className="dj-turntable-col"><Turntable id={id} compact />{loadRow}</div> : <Turntable id={id} />}
        <div className="dj-deck-controls">
          {!phone && loadRow}
          <div className="dj-row">
            <Button className="dj-btn dj-tostart" variant="outline" disabled={!s.name || s.loading} onClick={() => { unlock(); deck.toStart(); }}
              aria-label={`Deck ${id} back to the beginning`} title="Back to the beginning of the track"><SkipBack className="size-4 fill-current" /></Button>
            <Button className="dj-btn dj-cue" variant="outline" disabled={!s.name} onClick={() => { unlock(); deck.cue(); }} title="Stopped: set the cue here. Playing: back to the cue">CUE</Button>
            <Button className="dj-btn dj-play" data-empty={!s.name || s.loading ? "1" : undefined} aria-pressed={s.playing} aria-label={s.playing ? `Pause deck ${id}` : `Play deck ${id}`}
              onClick={() => {
                unlock();
                if (s.loading) { toast("Deck " + id + " is still loading the track", { description: "Press Play again in a moment." }); return; }
                if (!s.name) {
                  // An empty deck has nothing to play: say so and offer the file picker right from the message.
                  toast("Deck " + id + " has no music on it yet", { description: "Load a music file (folder button), put your song on it (♪ button) or pick one from the Playlist.", action: { label: "Load a file", onClick: () => fileRef.current?.click() } });
                  return;
                }
                const starting = !s.playing;
                const clock0 = dj.ctx.currentTime;
                deck.toggle();
                if (starting) checkSound(clock0);
              }}>
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
          <span className="dj-pitch-zero" data-on={Math.abs(s.pitch) < 0.0005 ? "1" : "0"} title={Math.abs(s.pitch) < 0.0005 ? "Pitch at 0 %" : `Pitch ${pct}%`} aria-hidden />
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

const meterPos = (v: number) => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(1e-5, v)) + 48) / 54));
const METER_TICKS = [6, 0, -6, -12, -24, -48];

function MixerPanel({ onPlaylist, onPhones }: { active: boolean; onPlaylist: () => void; onPhones: () => void }) {
  const dj = getDj();
  const meters = useRef<Record<string, HTMLElement | null>>({});
  const hold = useRef<Record<string, { v: number; at: number; clipAt: number }>>({});
  // Meters run at 20 fps the whole time the mixer is open, so they also fall back to silence after Stop.
  useEffect(() => {
    const set = (k: string, peak: number, now: number) => {
      const el = meters.current[k];
      if (!el) return;
      const v = meterPos(peak);
      const h = (hold.current[k] ??= { v: 0, at: 0, clipAt: -1e9 });
      if (v >= h.v || now - h.at > 900) { h.v = v >= h.v ? v : Math.max(v, h.v - 0.03); if (v >= h.v) h.at = now; }
      if (peak >= 1) h.clipAt = now;
      el.style.setProperty("--lvl", v.toFixed(3));
      el.style.setProperty("--hold", h.v.toFixed(3));
      const clip = meters.current[`${k}c`];
      if (clip) clip.dataset["on"] = now - h.clipAt < 1200 ? "1" : "0";
    };
    const id = setInterval(() => {
      const now = performance.now();
      const [al, ar] = dj.A.levels(), [bl, br] = dj.B.levels(), [ml, mr] = dj.masterMeter.levels();
      set("AL", al, now); set("AR", ar, now); set("BL", bl, now); set("BR", br, now); set("ML", ml, now); set("MR", mr, now);
    }, 50);
    return () => clearInterval(id);
  }, [dj]);
  const meter = (k: "A" | "B" | "M", scale = false) => (
    <div className={`dj-lr${k === "M" ? " is-master" : ""}`} role="img" aria-label={`${k === "M" ? "Master" : `Deck ${k}`} left and right level`}>
      <div className="dj-lr-clips">
        <i ref={(el) => { meters.current[`${k}Lc`] = el; }} title="Left clipping" />
        <i ref={(el) => { meters.current[`${k}Rc`] = el; }} title="Right clipping" />
      </div>
      <div className="dj-lr-body">
        {scale && (
          <div className="dj-lr-scale" aria-hidden>
            {METER_TICKS.map((db) => <span key={db} style={{ bottom: `${((db + 48) / 54) * 100}%` }}>{db > 0 ? `+${db}` : db}</span>)}
          </div>
        )}
        <div className="dj-lr-bars">
          <span className="dj-lr-bar" ref={(el) => { meters.current[`${k}L`] = el; }} />
          <span className="dj-lr-bar" ref={(el) => { meters.current[`${k}R`] = el; }} />
        </div>
      </div>
      <div className="dj-lr-legend" aria-hidden><span>L</span><span>R</span></div>
    </div>
  );
  const phone = useIsLandscapePhone();
  const cueBtn = (id: DeckId) => (
    <button type="button" className="djm-cue" data-deck={id} aria-pressed={dj.deck(id).state.phones}
      onClick={() => togglePhonesCue(id, phone ? onPhones : undefined)} aria-label={`Deck ${id} headphone cue`} title="Hear this deck in your headphones">{phone ? <>CUE<b className="dj-cue-deck">{id}</b></> : "CUE"}</button>
  );
  const knobs = (id: DeckId) => {
    const deck = dj.deck(id);
    const s = deck.state;
    const k = phone ? { size: 26, className: "dj-knob" } : { size: 34, className: "djm-knob" };
    if (!phone) {
      return (
        <>
          <Knob label="TRIM" value={s.gain} min={0} max={2} onChange={(v) => deck.setGain(v)} defaultValue={1} size={34} className="djm-knob is-trim" format={(v) => `${(20 * Math.log10(Math.max(0.01, v))).toFixed(1)}dB`} ariaLabel={`Deck ${id} trim`} />
          <div className="djm-eq">
            <Knob label="HI" value={s.eq.high} onChange={(v) => deck.setEq("high", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} high EQ`} />
            <Knob label="MID" value={s.eq.mid} onChange={(v) => deck.setEq("mid", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} mid EQ`} />
            <Knob label="LOW" value={s.eq.low} onChange={(v) => deck.setEq("low", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} low EQ`} />
          </div>
          <Knob label="COLOR · FILTER" value={s.filter} onChange={(v) => deck.setFilter(v)} defaultValue={0.5} size={42} className="djm-knob is-color" format={(v) => (Math.abs(v - 0.5) < 0.03 ? "OFF" : v < 0.5 ? "LOW PASS" : "HIGH PASS")} ariaLabel={`Deck ${id} filter`} />
        </>
      );
    }
    return (
      <>
        <Knob label="GAIN" value={s.gain} min={0} max={2} onChange={(v) => deck.setGain(v)} defaultValue={1} {...k} format={(v) => `${(20 * Math.log10(Math.max(0.01, v))).toFixed(1)}dB`} ariaLabel={`Deck ${id} gain`} />
        <Knob label="HI" value={s.eq.high} onChange={(v) => deck.setEq("high", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} high EQ`} />
        <Knob label="MID" value={s.eq.mid} onChange={(v) => deck.setEq("mid", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} mid EQ`} />
        <Knob label="LOW" value={s.eq.low} onChange={(v) => deck.setEq("low", v)} defaultValue={0.5} {...k} format={eqLabel} ariaLabel={`Deck ${id} low EQ`} />
        <Knob label="FILT" value={s.filter} onChange={(v) => deck.setFilter(v)} defaultValue={0.5} {...k} format={(v) => (Math.abs(v - 0.5) < 0.03 ? "OFF" : v < 0.5 ? "LP" : "HP")} ariaLabel={`Deck ${id} filter`} />
        {cueBtn(id)}
      </>
    );
  };
  const fader = (id: DeckId, withMeter = true) => (
    <div className="dj-fader-row">
      {withMeter && meter(id)}
      {!withMeter && <FaderScale />}
      <Slider orientation="vertical" className="dj-vfader" min={0} max={1} step={0.01} value={[dj.deck(id).state.fader]} onValueChange={([v = 0]) => dj.deck(id).setFader(v)} aria-label={`Deck ${id} volume`} />
    </div>
  );
  const xfader = (
    <div className="dj-xfader">
      <span className="dj-label">{phone ? "A" : "◀ A"}</span>
      <div className="djm-xgrill"><Slider min={-1} max={1} step={0.01} value={[dj.state.crossfader]} onValueChange={([v = 0]) => dj.setCrossfader(v)} aria-label="Crossfader" className="dj-xfader-slider" /></div>
      <span className="dj-label">{phone ? "B" : "B ▶"}</span>
      <button type="button" className="dj-range" onClick={() => dj.setCrossfader(0)} title="Centre the crossfader">◆</button>
    </div>
  );
  if (phone) {
    return (
      <div className="dj-mixer is-phone">
        {/* Like a real two-channel DJ mixer: the left strip is all Deck A (left turntable), the right strip is all Deck B, master in the middle. */}
        <div className="dj-phone-strips">
          <div className="dj-phone-strip" data-deck="A" role="group" aria-label="Deck A controls (left turntable)">
            <span className="dj-row-tag" aria-hidden>A</span>
            {knobs("A")}
            {fader("A")}
          </div>
          <div className="dj-phone-master">
            <Knob label="MASTER" value={dj.state.master} min={0} max={1.2} onChange={(v) => dj.setMaster(v)} defaultValue={0.9} size={26} className="dj-knob is-wide" format={(v) => `${Math.round(v * 100)}%`} />
            {meter("M")}
          </div>
          <div className="dj-phone-strip" data-deck="B" role="group" aria-label="Deck B controls (right turntable)">
            <span className="dj-row-tag" aria-hidden>B</span>
            {knobs("B")}
            {fader("B")}
          </div>
        </div>
        {xfader}
        <div className="dj-phone-bottom">
          <RecordPanel />
          <Button variant="secondary" className="dj-btn dj-pl-open" onClick={onPlaylist} aria-label="Open the playlist — add, save and delete music"><ListMusic className="size-4" />Playlist</Button>
          <Button variant="secondary" className="dj-btn dj-pl-open" onClick={onPhones} aria-label="Headphones" data-on={dj.state.phonesMode !== "off" ? "1" : "0"}><Headphones className="size-4" /></Button>
        </div>
      </div>
    );
  }
  const channel = (id: DeckId) => (
    <div className="djm-ch" data-deck={id}>
      {knobs(id)}
      {cueBtn(id)}
      <span className="djm-num">{id === "A" ? 1 : 2}</span>
      {fader(id, false)}
    </div>
  );
  return (
    <div className="dj-mixer djm">
      <span className="djm-screw is-tl" aria-hidden /><span className="djm-screw is-tr" aria-hidden /><span className="djm-screw is-bl" aria-hidden /><span className="djm-screw is-br" aria-hidden />
      <div className="djm-top">
        {channel("A")}
        <div className="djm-center">
          <Knob label="MASTER LEVEL" value={dj.state.master} min={0} max={1.2} onChange={(v) => dj.setMaster(v)} defaultValue={0.9} size={36} className="djm-knob" format={(v) => `${Math.round(v * 100)}%`} />
          <div className="djm-bridge" aria-label="Level meters">
            <div className="djm-bridge-head" aria-hidden><span>CH1</span><span>MASTER</span><span>CH2</span></div>
            <div className="djm-bridge-meters">{meter("A")}{meter("M", true)}{meter("B")}</div>
          </div>
          <PhonesPanel />
        </div>
        {channel("B")}
      </div>
      {xfader}
      <span className="djm-model" aria-hidden>SYNCLAB · 2 CHANNEL DJ MIXER</span>
    </div>
  );
}

/** Printed 10…0 fader scale beside a channel fader. */
function FaderScale() {
  return (
    <div className="djm-fscale" aria-hidden>
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => <span key={n}>{n}</span>)}
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
