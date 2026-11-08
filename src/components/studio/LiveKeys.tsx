import { useIsLandscapePhone } from "@/hooks/use-mobile";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { toast } from "sonner";
import { Piano, Play, Square, Sparkles, Zap, PauseCircle, Music2, Disc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Knob } from "./Knob";
import { IntensityPad } from "./LiveDrummer";
import { useStudio } from "@/lib/synclab/store";
import { stepsPerBar } from "@/lib/synclab/timebase";
import { getPlayStep } from "@/lib/synclab/playhead";
import { getEngine } from "@/lib/synclab/audio-engine";
import { uid } from "@/lib/synclab/presets";
import { getKeysPlayer, type KeysSnapshot } from "@/lib/synclab/keyboardist-player";
import {
  KEYS_GROUPS, KEYS_PATCH_REV, KEYS_PROGRESSIONS, KEYS_SOUNDS, KEYS_STYLES, NOTE_NAMES, defaultKeys, keysBars, keysPatch, keysStyleById, keysToNotes, soundById,
  type KeysGroup, type KeysSettings, type KeysSoundId,
} from "@/lib/synclab/keyboardist";
import type { Track } from "@/lib/synclab/types";

/** The keys channel the panel controls: the one chosen, else the first Live Keys track. */
export function useKeysTrack() {
  const { tracks } = useStudio();
  const chosen = useSyncExternalStore(subscribeChoice, () => chosenId, () => null);
  return tracks.find((t) => t.keyboardist && t.id === chosen) ?? tracks.find((t) => t.keyboardist) ?? null;
}
let chosenId: string | null = null;
const choiceListeners = new Set<() => void>();
const subscribeChoice = (fn: () => void) => { choiceListeners.add(fn); return () => void choiceListeners.delete(fn); };
export function chooseKeys(id: string) { chosenId = id; choiceListeners.forEach((l) => l()); }

/** Always mounted: keeps the keyboard player pointed at its channel and the song tempo/swing. */
export function KeysBridge() {
  const { transport, tracks, updateTrack } = useStudio();
  const track = useKeysTrack();
  useEffect(() => { getKeysPlayer().sync(track, transport.bpm, transport.swing ?? 0, stepsPerBar()); }, [track, transport.bpm, transport.swing, transport.beatsPerBar]);
  // Live Keys players made before a sound-level fix get the corrected sound once (their style,
  // key, chords and settings stay as they are).
  useEffect(() => {
    for (const t of tracks) {
      const k = t.keyboardist;
      if (k && (k.patchRev ?? 0) < KEYS_PATCH_REV) updateTrack(t.id, { patch: keysPatch(k.sound), keyboardist: { ...k, patchRev: KEYS_PATCH_REV } });
    }
  }, [tracks, updateTrack]);
  return null;
}

function useKeysState(): KeysSnapshot {
  const [snap, setSnap] = useState(() => getKeysPlayer().snapshot());
  useEffect(() => {
    const p = getKeysPlayer();
    const read = () => setSnap(p.snapshot());
    const off = p.subscribe(read);
    const id = setInterval(() => { if (p.snapshot().running) read(); }, 50);
    return () => { off(); clearInterval(id); };
  }, []);
  return snap;
}

const trackName = (label: string) => `KEYS · ${label}`.slice(0, 40);

export function LiveKeys() {
  const { tracks, addTrack, updateTrack, transport, setTransport, togglePlay, pause } = useStudio();
  const track = useKeysTrack();
  const players = tracks.filter((t) => t.keyboardist);
  const [group, setGroup] = useState<KeysGroup>(() => (track?.keyboardist ? keysStyleById(track.keyboardist.style).group : "Jazz"));
  const snap = useKeysState();

  const bringIn = (styleId: string) => {
    const style = keysStyleById(styleId);
    const settings = defaultKeys(styleId);
    const id = addTrack("instrument", "LIVE KEYS", soundById(settings.sound).preset, { keepPanel: true });
    updateTrack(id, { notes: [], patch: keysPatch(settings.sound), keyboardist: settings, name: trackName(style.label) });
    chooseKeys(id);
    toast.success(`${style.label} keyboard player joined the session`, { description: "Preview them alone, or play them along with your song." });
  };

  if (!track?.keyboardist) {
    return (
      <section className="drummer-device keys-device space-y-3 rounded-md border border-border p-3">
        <KeysHeader />
        <p className="text-sm text-muted-foreground">Pick a style to bring a session keyboard player into your song. They comp chords in any key, play basslines with the left hand, take runs on cue, and you can print what they play onto the timeline as editable notes.</p>
        <StylePicker group={group} setGroup={setGroup} current={null} onPick={bringIn} />
      </section>
    );
  }
  return <KeysDesk track={track} players={players} snap={snap} group={group} setGroup={setGroup}
    update={(patch) => updateTrack(track.id, { keyboardist: { ...track.keyboardist!, ...patch } })}
    updateTrack={updateTrack} addTrack={addTrack} transport={transport} setTransport={setTransport} togglePlay={togglePlay} pause={pause} onNew={bringIn} />;
}

function KeysHeader({ name }: { name?: string }) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <Piano className="size-5 text-primary" />
      <h2 className="drummer-brand">SYNCLAB <b>Live Keys</b></h2>
      {name && <span className="font-mono text-[11px] text-muted-foreground">· {name}</span>}
    </header>
  );
}

function StylePicker({ group, setGroup, current, onPick }: { group: KeysGroup; setGroup: (g: KeysGroup) => void; current: string | null; onPick: (id: string) => void }) {
  return (
    <div className="drummer-picker space-y-2">
      <div className="drummer-tabs flex flex-wrap gap-1.5" role="tablist" aria-label="Keyboard genre groups">
        {KEYS_GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
            className={`drummer-chip ${group === g ? "is-on" : ""}`}>{g} <span className="opacity-60">{KEYS_STYLES.filter((x) => x.group === g).length}</span></button>
        ))}
      </div>
      <div className="drummer-genres" role="radiogroup" aria-label="Keyboard style">
        {KEYS_STYLES.filter((x) => x.group === group).map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={current === x.id} onClick={() => onPick(x.id)} className={`drummer-genre ${current === x.id ? "is-on" : ""}`}>
            <span className="block text-sm font-semibold leading-tight">{x.label}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">{x.bpm} BPM · {soundById(x.sound).label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface DeskProps {
  track: Track; players: Track[]; snap: KeysSnapshot; group: KeysGroup; setGroup: (g: KeysGroup) => void;
  update: (patch: Partial<KeysSettings>) => void;
  updateTrack: ReturnType<typeof useStudio>["updateTrack"]; addTrack: ReturnType<typeof useStudio>["addTrack"];
  transport: ReturnType<typeof useStudio>["transport"]; setTransport: ReturnType<typeof useStudio>["setTransport"];
  togglePlay: () => void; pause: () => void;
  onNew: (style: string) => void;
}

function KeysDesk({ track, players, snap, group, setGroup, update, updateTrack, addTrack, transport, setTransport, togglePlay, pause, onNew }: DeskProps) {
  const phone = useIsLandscapePhone();
  const knobSize = phone ? 40 : 54;
  const [tab, setTab] = useState<"play" | "styles" | "print">("play");
  const show = (t: "play" | "styles" | "print") => !phone || tab === t;
  const settings = track.keyboardist!;
  const style = keysStyleById(settings.style);
  const sound = soundById(settings.sound);
  const player = getKeysPlayer();
  const spb = stepsPerBar();
  const [bars, setBars] = useState(8);
  const [startAt, setStartAt] = useState<"start" | "playhead">("start");
  const playing = snap.running && player.trackId === track.id;

  const previewAlone = () => {
    chooseKeys(track.id);
    if (transport.recording) { toast("Stop recording first", { description: "Preview alone pauses your song, which would end the take." }); return; }
    if (transport.playing) { pause(); toast("Song paused", { description: "You're hearing the keyboard player on their own. Press Play with song to bring the song back in." }); }
    player.stop();
    player.start("alone");
  };
  const playWithSong = () => {
    chooseKeys(track.id);
    if (!transport.playing) togglePlay();
    if (!player.snapshot().running) player.start("song");
  };

  const pickStyle = (id: string) => {
    const next = keysStyleById(id);
    update({ style: id, tonic: next.tonic, prog: "", sound: next.sound, patchRev: KEYS_PATCH_REV });
    updateTrack(track.id, { patch: keysPatch(next.sound), name: trackName(next.label) });
  };
  const pickSound = (id: KeysSoundId) => {
    update({ sound: id, patchRev: KEYS_PATCH_REV });
    updateTrack(track.id, { patch: keysPatch(id) });
  };

  const print = (source: "groove" | "performance") => {
    const perf = player.performance();
    const startBar = startAt === "playhead" ? Math.floor(getPlayStep() / spb) : 0;
    const list = source === "performance" ? perf : keysBars(settings, startBar, bars, spb);
    if (!list.length || !list.some((b) => b.notes.length)) { toast("Nothing captured yet", { description: "Play the keyboard player along with your song first, then print the performance." }); return; }
    player.stop();
    const { notes, steps } = keysToNotes(list, spb);
    const first = list[0]!.bar, last = list[list.length - 1]!.bar;
    const id = addTrack("instrument", trackName(style.label), sound.preset, { keepPanel: true });
    updateTrack(id, {
      notes: notes.map((n) => ({ ...n, id: uid() })), steps,
      ...(track.patch ? { patch: structuredClone(track.patch) } : {}),
      ...(track.octave ? { octave: track.octave } : {}),
      ...(track.plugins?.length ? { plugins: structuredClone(track.plugins) } : {}),
    });
    if (last + 1 > (transport.bars ?? 0)) setTransport({ bars: last + 1 });
    if (source === "performance") player.clearPerformance();
    const count = last - first + 1;
    toast.success(source === "performance" ? "Performance printed" : "Part printed", { description: `${count} bar${count === 1 ? "" : "s"} of ${style.label} on a new instrument track from bar ${first + 1} — edit it in the piano roll. The live player stopped so you don't hear it twice.` });
  };

  const swingHint = Math.abs((transport.swing ?? 0) - style.swing) > 0.05;
  const tempoHint = transport.bpm !== style.bpm;
  const select = "min-h-11 rounded-md border border-border bg-surface-2 px-2 text-sm";

  const setup = (
    <div className="keys-setup">
      <label className="keys-field"><span>KEY</span>
        <select aria-label="Key" value={settings.tonic} onChange={(e) => update({ tonic: Number(e.target.value) })} className={select}>
          {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="keys-field"><span>CHORDS</span>
        <select aria-label="Chord progression" value={settings.prog} onChange={(e) => update({ prog: e.target.value })} className={select}>
          <option value="">{style.label}'s own</option>
          {KEYS_PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label className="keys-field"><span>SOUND</span>
        <select aria-label="Keyboard sound" value={settings.sound} onChange={(e) => pickSound(e.target.value as KeysSoundId)} className={select}>
          {KEYS_SOUNDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <div className="keys-field"><span>RANGE</span>
        <div className="flex gap-1">
          {([[-1, "Low"], [0, "Mid"], [1, "High"]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={settings.range === v} onClick={() => update({ range: v })} className={`drummer-chip ${settings.range === v ? "is-on" : ""}`}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section className="drummer-device keys-device space-y-3 rounded-md border border-border p-3">
      <div className="drummer-head"><KeysHeader name={track.name} /></div>
      {players.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold tracking-widest text-muted-foreground">PLAYER</span>
          <select aria-label="Keyboard player track" value={track.id} onChange={(e) => { player.stop(); chooseKeys(e.target.value); }} className={select}>
            {players.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}

      {phone && (
        <div className="drummer-pages" role="tablist" aria-label="Live Keys pages">
          {([["play", "Play"], ["styles", `Styles · ${style.label}`], ["print", "Print to timeline"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`drummer-chip ${tab === id ? "is-on" : ""}`}>{label}</button>
          ))}
        </div>
      )}

      {show("play") && (<>
        <div className="drummer-main">
          <div className="drummer-left">
            <div className="drummer-display keys-display" aria-live="polite">
              <span className="drummer-display-genre">{style.label.toUpperCase()}</span>
              <span className="keys-chord" aria-label={`Chord ${snap.chord || "none"}`}>{snap.chord || "—"}{snap.nextChord && <small> → {snap.nextChord}</small>}</span>
              <span className="drummer-display-meta">
                {playing ? (snap.waiting ? "STARTING SONG…" : snap.following ? "WITH SONG" : "ALONE") : "READY"} · BAR {snap.bar + 1} · {transport.bpm} BPM · KEY {NOTE_NAMES[settings.tonic]} · {sound.label.toUpperCase()}
              </span>
              <span className="drummer-display-flags">
                {snap.fillQueued && <b>RUN</b>}{snap.breakQueued && <b>BREAK</b>}{snap.hitQueued && <b>HIT</b>}
              </span>
            </div>

            <div className="drummer-perform">
              {playing ? (
                <Button size="lg" className="drummer-play min-h-14" variant="destructive" onClick={() => player.stop()} aria-label="Stop the keyboard player">
                  <Square className="size-5 fill-current" />Stop
                </Button>
              ) : (
                <Button size="lg" className="drummer-play min-h-14" onClick={previewAlone} title="Hear only the keyboard player, at the song tempo — your song pauses if it's playing">
                  <Play className="size-5 fill-current" />{phone ? "Alone" : "Preview alone"}
                </Button>
              )}
              <Button size="lg" variant={snap.following || snap.waiting ? "default" : "secondary"} className="drummer-with-song min-h-14" aria-pressed={playing && (snap.following || snap.waiting)}
                disabled={playing && (snap.following || snap.waiting)} onClick={playWithSong} title="Start your song and the keyboard player together, locked to the song's bars">
                <Music2 className="size-5" />{phone ? "With song" : "Play with song"}
              </Button>
              <Button size="lg" variant="secondary" className="min-h-14" disabled={!playing} onClick={() => player.fill()} aria-pressed={snap.fillQueued} title="A run or turnaround at the end of this bar"><Zap className="size-5" />Run</Button>
              <Button size="lg" variant="secondary" className="min-h-14" disabled={!playing} onClick={() => player.breakNext()} aria-pressed={snap.breakQueued} title="Lay out for a bar, then come back in"><PauseCircle className="size-5" />Break</Button>
              <Button size="lg" variant="secondary" className="min-h-14" disabled={!playing} onClick={() => player.hitNext()} aria-pressed={snap.hitQueued} title="A big chord on the next downbeat"><Disc className="size-5" />Hit</Button>
              <Button size="lg" variant="outline" className="min-h-14" onClick={() => update({ seed: settings.seed + 1 })}><Sparkles className="size-5" />{phone ? "Variation" : "New variation"}</Button>
            </div>

            {!phone && <KeyboardView track={track} settings={settings} running={playing} />}
            <CompDisplay snap={snap} spb={spb} playing={playing} />

            <div className="drummer-pieces flex flex-wrap gap-1.5" aria-label="Hands">
              {([["left", "Left hand · bass"], ["right", "Right hand · chords"]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={settings.hands[id] !== false} onClick={() => update({ hands: { ...settings.hands, [id]: settings.hands[id] === false } })}
                  className={`drummer-chip ${settings.hands[id] !== false ? "is-on" : ""}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="drummer-controls">
            {phone && <KeyboardView track={track} settings={settings} running={playing} />}
            <IntensityPad complexity={settings.complexity} loudness={settings.loudness} onChange={(complexity, loudness) => update({ complexity, loudness })} />
            <div className="drummer-knobs">
              <Knob label="RUNS" value={settings.fills} onChange={(v) => update({ fills: v })} format={(v) => (v <= 0.02 ? "OFF" : v <= 0.4 ? "8 BARS" : v <= 0.75 ? "4 BARS" : "2 BARS")} size={knobSize} />
              <Knob label="FEEL" value={settings.humanize} onChange={(v) => update({ humanize: v })} format={(v) => (v < 0.2 ? "TIGHT" : v < 0.6 ? "NATURAL" : "LOOSE")} size={knobSize} />
              <Knob label="SWING" value={transport.swing ?? 0} min={0} max={0.6} onChange={(v) => setTransport({ swing: v })} format={(v) => `${Math.round(v * 100)}%`} size={knobSize} />
              {!phone && setup}
            </div>
          </div>
        </div>
        <p className="drummer-note text-[11px] text-muted-foreground">The keys use your song's tempo and swing, so they lock with the Live Drummer and your drum machine. Edit the sound in the synth editor for this track.</p>
      </>)}

      {show("styles") && (tempoHint || swingHint) && (
        <div className="drummer-hint flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {style.label} usually plays at {style.bpm} BPM{style.swing ? ` with ${Math.round(style.swing * 100)}% swing` : ", straight"}.
          {tempoHint && <Button size="sm" variant="outline" onClick={() => setTransport({ bpm: style.bpm })}>Use {style.bpm} BPM</Button>}
          {swingHint && <Button size="sm" variant="outline" onClick={() => setTransport({ swing: style.swing })}>Use {Math.round(style.swing * 100)}% swing</Button>}
        </div>
      )}

      {phone && show("styles") && setup}
      {show("styles") && <StylePicker group={group} setGroup={setGroup} current={settings.style} onPick={pickStyle} />}

      {show("print") && (<>
        <div className="drummer-print">
          <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">PRINT TO TIMELINE</span>
          <select aria-label="Bars to print" value={bars} onChange={(e) => setBars(Number(e.target.value))} className={select}>
            {[1, 2, 4, 8, 16, 32].map((b) => <option key={b} value={b}>{b} bar{b === 1 ? "" : "s"}</option>)}
          </select>
          <select aria-label="Print from" value={startAt} onChange={(e) => setStartAt(e.target.value as "start" | "playhead")} className={select}>
            <option value="start">from bar 1</option><option value="playhead">from the playhead bar</option>
          </select>
          <Button className="min-h-11" onClick={() => print("groove")}>Print part</Button>
          <Button className="min-h-11" variant="secondary" disabled={!snap.captured} onClick={() => print("performance")} title="What the keyboard player played along with your song, runs and breaks included, at the bars they were played">
            Print my performance{snap.captured ? ` (${snap.captured} bar${snap.captured === 1 ? "" : "s"})` : ""}
          </Button>
        </div>
        <div className="drummer-foot flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="drummer-note">Printed parts go on a new instrument track you can edit in the piano roll. Want another keyboard player?</span>
          <Button size="sm" variant="ghost" onClick={() => onNew(settings.style)}>Add another keyboard player</Button>
        </div>
      </>)}
    </section>
  );
}

const LOW = 36, HIGH = 84;
const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * The keyboard player's instrument: the case follows the sound (grand, electric piano, organ…).
 * Keys light as the player actually plays them (player.onNote, timed to when you hear them),
 * and tapping a key plays it through the player's channel without recording.
 */
function KeyboardView({ track, settings, running }: { track: Track; settings: KeysSettings; running: boolean }) {
  const board = useRef<HTMLDivElement>(null);
  const sound = soundById(settings.sound);
  const whites = useMemo(() => { const w: number[] = []; for (let p = LOW; p <= HIGH; p++) if (!BLACK.has(p % 12)) w.push(p); return w; }, []);
  const blacks = useMemo(() => { const b: { pitch: number; left: number }[] = []; for (let p = LOW; p <= HIGH; p++) if (BLACK.has(p % 12)) b.push({ pitch: p, left: whites.indexOf(p - 1) + 1 }); return b; }, [whites]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const light = (pitch: number, seconds: number) => {
    let p = pitch;
    while (p < LOW) p += 12;
    while (p > HIGH) p -= 12;
    const el = board.current?.querySelector<HTMLElement>(`[data-pitch="${p}"]`);
    if (!el) return;
    el.classList.add("is-lit");
    const prev = timers.current.get(p);
    if (prev) clearTimeout(prev);
    timers.current.set(p, setTimeout(() => { el.classList.remove("is-lit"); timers.current.delete(p); }, Math.max(110, Math.min(1500, seconds * 1000))));
  };

  useEffect(() => {
    const player = getKeysPlayer();
    const all = timers.current;
    const off = player.onNote((pitch, _vel, seconds) => { if (player.trackId === track.id) light(pitch, seconds); });
    return () => { off(); all.forEach(clearTimeout); all.clear(); };
  }, [track.id]);

  const tap = (pitch: number) => {
    if (!track.patch) return;
    const engine = getEngine();
    engine.init();
    engine.playNote(track.id, track.patch, pitch + (track.octave ?? 0) * 12, 0.6, 0.85);
    light(pitch, 0.4);
  };
  const name = (p: number) => `${NOTE_NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

  return (
    <div className="keys-rig" data-look={sound.look}>
      <div className="keys-rig-top">
        <span className={`keys-rig-led${running ? " is-on" : ""}`} aria-hidden="true" />
        <span className="keys-rig-name">SYNCLAB {sound.label.toUpperCase()}</span>
        <span className="keys-rig-hint">tap a key to hear it</span>
      </div>
      <div ref={board} className="keys-board" role="group" aria-label={`${sound.label} — tap a key to hear it`} style={{ "--keys-whites": whites.length } as CSSProperties}>
        {whites.map((p) => (
          <button key={p} type="button" tabIndex={-1} data-pitch={p} aria-label={name(p)} className="keys-white"
            onPointerDown={(e) => { e.preventDefault(); tap(p); }}>{p % 12 === 0 && <span>{name(p)}</span>}</button>
        ))}
        {blacks.map(({ pitch, left }) => (
          <button key={pitch} type="button" tabIndex={-1} data-pitch={pitch} aria-label={name(pitch)} className="keys-black"
            style={{ "--keys-at": left } as CSSProperties} onPointerDown={(e) => { e.preventDefault(); tap(pitch); }} />
        ))}
      </div>
    </div>
  );
}

function CompDisplay({ snap, spb, playing }: { snap: KeysSnapshot; spb: number; playing: boolean }) {
  const rows = useMemo(() => (["R", "L"] as const).map((hand) => {
    const cells = Array<number>(spb).fill(0);
    for (const n of snap.notes) if (n.hand === hand) { const s = Math.floor(n.step); if (s < spb) cells[s] = Math.max(cells[s]!, n.vel); }
    return { label: hand === "R" ? "CHORDS" : "BASS", cells };
  }), [snap.notes, spb]);
  return (
    <div className="drummer-grid keys-grid" role="img" aria-label={`Bar ${snap.bar + 1} of the keyboard part`} style={{ "--drummer-steps": spb } as CSSProperties}>
      {rows.map((row) => (
        <div key={row.label} className="drummer-grid-row">
          <span className="drummer-grid-label">{row.label}</span>
          {row.cells.map((v, i) => (
            <span key={i} className={`drummer-cell${v ? " is-on" : ""}${playing && i === snap.step ? " is-now" : ""}${i % 4 === 0 ? " is-beat" : ""}`}
              style={v ? ({ "--cell-level": String(0.3 + v * 0.7) } as CSSProperties) : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}
